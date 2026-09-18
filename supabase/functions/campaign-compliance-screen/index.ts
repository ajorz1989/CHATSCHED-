// AI-assisted campaign screening (brief section 6/7). Reads a campaign's
// own brief text (requests.campaign_message / channel_requests.campaign_message)
// plus the platform/category it was assigned, and looks for things a human
// reviewer might want to double-check before the campaign goes live —
// missing disclosure, unsupported claims, unclear instructions.
//
// What this explicitly does NOT do, on purpose (do not change without
// re-reading brief section 6/33):
//   - It never sets campaign_compliance.status. Only
//     recompute_campaign_compliance() (schema_phase39_compliance.sql) does this — this
//     function only writes risk_score/risk_level and rows into
//     campaign_risk_flags, i.e. it assists a human reviewer, it doesn't
//     decide eligibility itself.
//   - It never claims a platform has approved anything. The prompt below
//     is written so the model can't produce that framing, and the code
//     path never surfaces a bare "approved" string to campaign_risk_flags.
//   - It has no ability to browse the actual platform or verify a claim
//     against reality — it's reading the campaign brief text a business
//     already typed, nothing else.
//
// Stays on the main Claude/Anthropic path this codebase defaults to (see
// content-studio-generate) rather than the Cloudflare Workers AI exception
// carved out for publisher-authenticity-check — compliance language
// analysis benefits from the stronger model, and this isn't a
// per-click-cheap high-volume feature the way that one is.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MODEL = "claude-haiku-4-5-20251001";

type Flag = { flag_type: string; severity: "info" | "low" | "medium" | "high"; description: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { campaign_compliance_id } = (await req.json()) as { campaign_compliance_id?: string };
    if (!campaign_compliance_id) return json({ error: "campaign_compliance_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    const { data: cc, error: ccError } = await supabase.from("campaign_compliance").select("*").eq("id", campaign_compliance_id).maybeSingle();
    if (ccError || !cc) return json({ error: "Campaign compliance record not found" }, 404);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "admin";
    if (!isAdmin && cc.business_id !== user.id) {
      return json({ error: "Only the campaign's business (or an admin) can run a compliance screening." }, 403);
    }
    if (!cc.platform || !cc.category) {
      return json({ error: "Set the campaign's platform and category before screening it." }, 400);
    }

    // Pull the brief text from whichever flow this campaign came from.
    let campaignMessage = "";
    if (cc.request_id) {
      const { data } = await supabase.from("requests").select("campaign_message").eq("id", cc.request_id).maybeSingle();
      campaignMessage = data?.campaign_message ?? "";
    } else if (cc.channel_request_id) {
      const { data } = await supabase.from("channel_requests").select("campaign_message").eq("id", cc.channel_request_id).maybeSingle();
      campaignMessage = data?.campaign_message ?? "";
    }
    if (!campaignMessage.trim()) return json({ error: "This campaign has no brief text to screen yet." }, 400);

    const { data: platformRule } = await supabase.from("platform_compliance_rules").select("*").eq("platform", cc.platform).maybeSingle();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Compliance screening isn't set up yet — ask the platform owner to add an Anthropic API key." }, 501);

    const promptText = `You are helping an advertising marketplace flag things a human compliance reviewer should look at before a sponsored campaign goes live. You are NOT the final decision-maker — a human reviews everything you flag — and you have no ability to browse the internet or verify any claim, you only have the text below.

Campaign platform: ${cc.platform}
Campaign category: ${cc.category}
Platform disclosure required: ${platformRule?.disclosure_required ? "yes" : "not marked as required"}
Campaign brief, exactly as the business wrote it:
"""
${campaignMessage.slice(0, 4000)}
"""

Look for: potentially misleading or unsupported performance/health/financial claims, missing or unclear disclosure instructions, requests that a creator do something that sounds like it would bypass a platform's ad-disclosure tools, external payment instructions, suspicious or unrelated links, or anything else a careful reviewer should double check. Do not assume bad intent — most campaigns are ordinary and should get few or no flags. Never state or imply that any platform (TikTok, Instagram, YouTube, Facebook, X, LinkedIn, or any other) has approved or would approve this campaign — that is not something you can know.

Respond with ONLY a JSON object, no markdown fences, no other text, in this exact shape:
{"risk_score": <integer 0-100, 100 = no concerns at all>, "risk_level": "low" | "medium" | "high", "flags": [{"flag_type": "<short_snake_case_id>", "severity": "info" | "low" | "medium" | "high", "description": "<one plain sentence, specific to this brief>"}]}
Use an empty flags array if there's nothing worth a reviewer's attention.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: "user", content: promptText }] }),
    });

    if (!aiRes.ok) {
      console.error("campaign-compliance-screen: Anthropic API error", await aiRes.text());
      return json({ error: "Screening is temporarily unavailable — try again shortly." }, 502);
    }

    const aiData = await aiRes.json();
    const rawText = (aiData.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let result: { risk_score: number; risk_level: "low" | "medium" | "high"; flags: Flag[] };
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("campaign-compliance-screen: could not parse model output", rawText);
      return json({ error: "Couldn't make sense of the screening result — try again." }, 502);
    }
    if (!["low", "medium", "high"].includes(result.risk_level) || typeof result.risk_score !== "number") {
      return json({ error: "Unexpected result from screening — try again." }, 502);
    }
    const flags = Array.isArray(result.flags) ? result.flags.filter((f) => f && typeof f.description === "string") : [];

    // Service role from here — writing risk data and (possibly) opening a
    // review queue entry is a system action, not something the caller's
    // own RLS grants should need to cover directly.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await admin.from("campaign_compliance").update({
      risk_score: Math.max(0, Math.min(100, Math.round(result.risk_score))),
      risk_level: result.risk_level,
    }).eq("id", campaign_compliance_id);

    if (flags.length > 0) {
      await admin.from("campaign_risk_flags").insert(
        flags.map((f) => ({
          campaign_compliance_id,
          flag_type: (f.flag_type || "unspecified").slice(0, 64),
          severity: ["info", "low", "medium", "high"].includes(f.severity) ? f.severity : "info",
          description: f.description,
          source: "ai" as const,
        }))
      );
    }

    // A high-severity flag opens a review automatically — mirrors brief
    // section 16's queue; a human still makes the actual call via
    // decide_compliance_review, this just gets it in front of one.
    const hasHighSeverity = flags.some((f) => f.severity === "high");
    if (hasHighSeverity) {
      const { data: existingOpen } = await admin
        .from("compliance_reviews")
        .select("id")
        .eq("campaign_compliance_id", campaign_compliance_id)
        .in("status", ["pending", "in_review"])
        .maybeSingle();
      if (!existingOpen) {
        await admin.from("compliance_reviews").insert({
          campaign_compliance_id,
          status: "pending",
          flagged_reasons: flags.filter((f) => f.severity === "high").map((f) => f.description),
        });
      }
    }

    // recompute_campaign_compliance reads campaign_risk_flags/compliance_reviews
    // fresh, so call it after the writes above land.
    await admin.rpc("recompute_campaign_compliance", { p_campaign_compliance_id: campaign_compliance_id });

    return json({ risk_score: result.risk_score, risk_level: result.risk_level, flags });
  } catch (err) {
    console.error("campaign-compliance-screen: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
