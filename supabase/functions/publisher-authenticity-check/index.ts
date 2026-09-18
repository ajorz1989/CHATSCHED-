// Admin-triggered, cached AI second opinion on a publisher application's
// internal consistency — NOT a verification of real follower counts, which
// this function has no way to check. It reads only the self-reported text
// and numbers an admin reviewer already sees, and looks for things a busy
// reviewer might skim past (a bio that doesn't match the claimed category,
// vague or generic audience descriptions, numbers that don't add up
// against each other). Same honest-framing approach as
// content-studio-generate's own comment header.
//
// Runs on Cloudflare Workers AI rather than Anthropic — this is the one
// "other AI" feature on the site kept off Anthropic; the business-facing
// AI Content Studio (content-studio-generate) is the deliberate exception
// and stays on Claude. Still deployed as a Supabase Edge Function (same
// auth/RLS integration as everything else here), just calling out to
// Cloudflare's REST API instead of Anthropic's for the actual model call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { publisher_id } = (await req.json()) as { publisher_id?: string };
    if (!publisher_id) return json({ error: "publisher_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "admin") return json({ error: "Admin only" }, 403);

    const { data: publisher, error: pubError } = await supabase.from("publishers").select("*").eq("id", publisher_id).maybeSingle();
    if (pubError || !publisher) return json({ error: "Publisher not found" }, 404);

    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    if (!cfToken || !cfAccountId) return json({ error: "Not set up yet — ask the platform owner to add Cloudflare Workers AI credentials." }, 501);

    const profileText = `Name: ${publisher.name}
Category: ${publisher.category}
Channel: ${publisher.channel_slug}
Location: ${publisher.city}, ${publisher.province}${publisher.suburb ? ", " + publisher.suburb : ""}
Platforms: ${(publisher.platforms ?? []).join(", ") || "none listed"}
Followers: ${publisher.followers}
Engagement: ${publisher.engagement}%
Monthly reach: ${publisher.monthly_reach ?? "not given"}
Price per post: R${publisher.price_per_post}
Account age (months): ${publisher.account_age_months ?? "not given"}
Posting frequency: ${publisher.posting_frequency ?? "not given"}
Languages: ${(publisher.languages ?? []).join(", ") || "not given"}
Bio: ${publisher.bio || "(empty)"}
Audience description: ${publisher.audience || "(empty)"}
Business name on file: ${publisher.business_name || "not given"}
Email verified: ${publisher.email_verified}, Phone verified: ${publisher.phone_verified}`;

    const prompt = `You are helping an admin at a South African advertising marketplace review a new publisher/creator application before approving it.

You CANNOT verify real follower counts, browse the internet, or confirm any claim independently — you only have the text below, exactly as the applicant entered it. Your job is narrow: point out internal inconsistencies or vague/generic patterns in THIS text that a careful human reviewer might miss on a quick skim. Do not speculate about things not in the text. Do not assume fraud — most applicants are legitimate small businesses and creators.

Application:
"""
${profileText}
"""

Respond with ONLY a JSON object, no markdown fences, no other text, in this exact shape:
{"risk": "low" | "medium" | "high", "notes": "2-3 sentences, specific to what's actually inconsistent or notably vague in this text, or stating there's nothing notable"}`;

    const aiRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfToken}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      }
    );

    if (!aiRes.ok) {
      console.error("publisher-authenticity-check: Cloudflare Workers AI error", await aiRes.text());
      return json({ error: "The check is temporarily unavailable — try again shortly." }, 502);
    }

    const aiData = await aiRes.json();
    if (aiData.success === false) {
      console.error("publisher-authenticity-check: Cloudflare Workers AI reported failure", aiData.errors);
      return json({ error: "The check is temporarily unavailable — try again shortly." }, 502);
    }
    const rawText: string = aiData.result?.response ?? "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let result: { risk: "low" | "medium" | "high"; notes: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("publisher-authenticity-check: could not parse model output", rawText);
      return json({ error: "Couldn't make sense of the check result — try again." }, 502);
    }
    if (!["low", "medium", "high"].includes(result.risk)) {
      return json({ error: "Unexpected result from the check — try again." }, 502);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const checkedAt = new Date().toISOString();
    await admin.from("publishers").update({
      authenticity_risk: result.risk,
      authenticity_notes: result.notes,
      authenticity_checked_at: checkedAt,
    }).eq("id", publisher_id);

    return json({ risk: result.risk, notes: result.notes, checked_at: checkedAt });
  } catch (err) {
    console.error("publisher-authenticity-check: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
