// Turns whatever's been imported via OAuth (follower counts per platform,
// usernames) plus the publisher's own bio into a short, natural-language
// audience summary — the last step in:
//   OAuth import → Supabase stores it → ChatSched calculates scores → THIS
// Same Anthropic call shape as content-studio-generate (see that function
// for the fuller reasoning on model choice) — cheap model, short output,
// no case for anything pricier here either. Free to the publisher; the
// "free AI service" the platform owner wanted is Claude Haiku, the
// cheapest current Anthropic model, not a $0 API — there's no such thing
// as a genuinely free hosted LLM API worth relying on in production, and
// pretending otherwise would just mean this silently breaks later.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MODEL = "claude-haiku-4-5-20251001";
const MIN_SECONDS_BETWEEN_CALLS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { publisher_id } = (await req.json()) as { publisher_id?: string };
    if (!publisher_id) return json({ error: "Missing publisher_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Log in to generate a summary" }, 401);

    const { data: publisher } = await supabase
      .from("publishers")
      .select("id, user_id, name, category, city, province, bio, ai_audience_summary_generated_at")
      .eq("id", publisher_id)
      .maybeSingle();
    if (!publisher || publisher.user_id !== user.id) return json({ error: "Not your listing" }, 403);

    if (publisher.ai_audience_summary_generated_at) {
      const secondsSince = (Date.now() - new Date(publisher.ai_audience_summary_generated_at).getTime()) / 1000;
      if (secondsSince < MIN_SECONDS_BETWEEN_CALLS) {
        return json({ error: "Give it a moment before regenerating." }, 429);
      }
    }

    const { data: stats } = await supabase.from("publisher_platform_stats").select("platform, follower_count, platform_username").eq("publisher_id", publisher_id);
    if (!stats || stats.length === 0) {
      return json({ error: "Connect at least one platform first — nothing to summarize yet." }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Not set up yet — ask the platform owner to add an Anthropic API key." }, 501);

    const statsLines = stats.map((s) => `- ${s.platform}: ${s.follower_count.toLocaleString()} followers${s.platform_username ? ` (@${s.platform_username})` : ""}`).join("\n");
    const promptText = `You are writing a short, factual audience summary for a creator's marketplace listing, based only on real imported platform data — never invent numbers not given here.

Creator: ${publisher.name}, category: ${publisher.category}, based in ${publisher.city}, ${publisher.province}.
${publisher.bio ? `Their own bio: "${publisher.bio}"` : ""}

Connected platforms and real follower counts:
${statsLines}

Write ONE short paragraph (2-3 sentences, under 60 words) summarizing their audience reach for businesses browsing this marketplace — factual and specific to the numbers given, no generic filler, no invented demographics or engagement claims that weren't provided.

Respond with ONLY the paragraph text, no quotes, no markdown, no preamble.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: "user", content: promptText }] }),
    });
    if (!aiRes.ok) {
      console.error("summarize-publisher-audience: Anthropic API error", await aiRes.text());
      return json({ error: "The summary generator is temporarily unavailable — try again shortly." }, 502);
    }
    const aiData = await aiRes.json();
    const summary = (aiData.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
    if (!summary) return json({ error: "Couldn't generate a summary — try again." }, 502);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("publishers").update({ ai_audience_summary: summary, ai_audience_summary_generated_at: new Date().toISOString() }).eq("id", publisher_id);

    return json({ summary });
  } catch (err) {
    console.error("summarize-publisher-audience: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
