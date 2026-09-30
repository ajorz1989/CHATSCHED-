// Turns the publisher's own self-reported numbers (followers, engagement,
// platforms — entered at application time, see PublisherApply.tsx) plus
// their bio into a short, natural-language audience summary. Used to read
// from publisher_platform_stats (OAuth-imported data via
// ConnectSocialAccounts.tsx); that whole path is gone as of migration
// 20260929120000_social_bio_code_verification.sql — see that file for why
// (OAuth required per-platform developer-app approval that never actually
// cleared, and only ever covered 4 of the platforms this marketplace needs).
//
// Numbers here are exactly as trustworthy as they were before this change:
// self-reported either way. What's new is social_verification_confirmed —
// an admin has checked a bio code and a screenshot for this publisher — so
// the prompt is told which case it's in and asked to word the summary
// honestly rather than imply verification that hasn't happened.
//
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
      .select("id, user_id, name, category, city, province, bio, audience, followers, engagement, platforms, social_verification_links, social_verification_confirmed, ai_audience_summary_generated_at")
      .eq("id", publisher_id)
      .maybeSingle();
    if (!publisher || publisher.user_id !== user.id) return json({ error: "Not your listing" }, 403);

    if (publisher.ai_audience_summary_generated_at) {
      const secondsSince = (Date.now() - new Date(publisher.ai_audience_summary_generated_at).getTime()) / 1000;
      if (secondsSince < MIN_SECONDS_BETWEEN_CALLS) {
        return json({ error: "Give it a moment before regenerating." }, 429);
      }
    }

    if (!publisher.followers || publisher.followers <= 0) {
      return json({ error: "Add your follower count on your profile first — nothing to summarize yet." }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Not set up yet — ask the platform owner to add an Anthropic API key." }, 501);

    const platformsLine = (publisher.platforms ?? []).length > 0 ? (publisher.platforms as string[]).join(", ") : "not specified";
    const links = (publisher.social_verification_links ?? []) as { platform: string; url: string }[];
    const linksLine = links.length > 0 ? links.map((l) => l.platform).join(", ") : "none submitted";
    const verificationLine = publisher.social_verification_confirmed
      ? "ChatSched has confirmed this publisher controls the profiles listed above (bio-code + screenshot review)."
      : "These numbers are self-reported by the publisher and have not yet been independently confirmed by ChatSched.";

    const promptText = `You are writing a short, factual audience summary for a creator's marketplace listing, based only on the real data given here — never invent numbers, engagement rates, or demographics that weren't provided.

Creator: ${publisher.name}, category: ${publisher.category}, based in ${publisher.city}, ${publisher.province}.
${publisher.bio ? `Their own bio: "${publisher.bio}"` : ""}
${publisher.audience ? `Their own description of their audience: "${publisher.audience}"` : ""}

Platforms: ${platformsLine}
Reported followers: ${publisher.followers.toLocaleString()}
${publisher.engagement ? `Reported engagement: ${publisher.engagement}` : ""}
Profile links submitted for review: ${linksLine}
${verificationLine}

Write ONE short paragraph (2-3 sentences, under 60 words) summarizing their audience reach for businesses browsing this marketplace — factual and specific to the numbers given, no generic filler, no invented demographics or engagement claims that weren't provided. ${publisher.social_verification_confirmed ? "You may note ChatSched has verified this publisher." : "Do not imply these numbers have been independently verified — phrase it as reported by the publisher."}

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
    const { error: saveError } = await admin.from("publishers").update({ ai_audience_summary: summary, ai_audience_summary_generated_at: new Date().toISOString() }).eq("id", publisher_id);
    if (saveError) {
      console.error("summarize-publisher-audience: could not save summary", saveError);
      return json({ error: "Generated a summary but couldn't save it — try again shortly." }, 500);
    }

    return json({ summary });
  } catch (err) {
    console.error("summarize-publisher-audience: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
