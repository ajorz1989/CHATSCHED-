// Generates ready-to-post copy across up to 9 formats from a photo and/or a
// text brief. Server-side because the Anthropic API key must never reach
// the browser, and this costs real money per call — so it's gated behind
// one of two paid-for tiers AND rate-limited on top of that, not just
// behind login.
//
// TWO TIERS (schema_phase103 — see that migration's header comment for
// the full reasoning on why this is two tiers, not the single
// `activation_fee_paid` gate originally briefed):
//   - free_activation: unlocked the moment a business's ChatSched Business
//     once-off R399 activation fee is active (business_subscriptions,
//     schema_phase86). No extra payment. Cheaper model, lower limits.
//   - subscription: the existing R99/month content_studio_subscriptions
//     product (schema_phase22). Better model, higher limits. A business
//     with BOTH gets the subscription tier's better limits — the free
//     tier is a floor for activated-only businesses, not a ceiling for
//     paying ones.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Content Studio's outputs are short, formulaic marketing copy, not deep
// reasoning, so the free tier stays on the cheapest current Claude model.
// The paid subscription tier gets the requested model upgrade — real
// current model string, not the fictional "claude-5-sonnet-20241022" /
// "claude opus-latest" named in the brief (verified against Anthropic's
// current lineup rather than guessed).
const FREE_MODEL = "claude-haiku-4-5-20251001";
const SUBSCRIPTION_MODEL = "claude-sonnet-5";

// Keep in sync with the matching constants in src/lib/constants.ts (Deno
// can't import from the Vite app).
const FREE_MONTHLY_LIMIT = 15;
const FREE_DAILY_LIMIT = 5;
const SUBSCRIPTION_DAILY_LIMIT = 15;
const SUBSCRIPTION_MONTHLY_LIMIT = 150;
// Basic anti-spam-click floor, independent of the limits above, applies
// to both tiers.
const MIN_SECONDS_BETWEEN_CALLS = 8;

const VALID_FORMAT_IDS = [
  "facebook", "instagram", "linkedin", "tiktok", "whatsapp",
  "x", "google_business", "blog", "email",
] as const;

const FORMAT_RULES: Record<(typeof VALID_FORMAT_IDS)[number], string> = {
  facebook: "Facebook Post — a natural, friendly feed post, 2-4 short sentences, one clear call to action, 1-3 relevant hashtags at most.",
  instagram: "Instagram Caption — engaging and a little more casual than Facebook, include a line break before 5-10 relevant hashtags at the end.",
  linkedin: "LinkedIn Post — slightly more professional tone, can be a touch longer, no more than 1-2 hashtags, avoid being salesy.",
  tiktok: "TikTok Caption — short, punchy, conversational, 3-6 trend-relevant hashtags.",
  whatsapp: "WhatsApp Status — must be under 140 characters total, punchy, one emoji at most.",
  x: "X Post — must be under 280 characters total, direct and to the point, at most 1-2 hashtags.",
  google_business: "Google Business Profile Update — clear, factual, states the offer/news plainly with one clear call to action, under 1500 characters, no hashtags.",
  blog: "Blog Article — a short article of roughly 250-400 words. The FIRST LINE must be just the title (no markdown #), then a blank line, then the article body in a few short paragraphs.",
  email: "Email Newsletter — the FIRST LINE must be exactly 'Subject: ' followed by a short compelling subject line, then a blank line, then the email body (a friendly, brief newsletter-style message with a clear call to action).",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json() as {
      prompt?: string;
      formats?: string[];
      imageBase64?: string;
      imageMediaType?: string;
      businessName?: string;
      industry?: string;
    };

    const prompt = (body.prompt ?? "").trim();
    const formats = Array.from(new Set((body.formats ?? []).filter((f) => (VALID_FORMAT_IDS as readonly string[]).includes(f))));

    if (formats.length === 0) return json({ error: "Pick at least one format to generate." }, 400);
    if (!prompt && !body.imageBase64) return json({ error: "Upload a photo or tell us what you'd like posted." }, 400);
    if (prompt.length > 1000) return json({ error: "Keep the brief under 1000 characters." }, 400);

    // Images arrive as data URLs or raw base64 from the client — cap size
    // (base64 is ~4/3 the byte size) so a huge upload can't blow out the
    // request or the Anthropic call.
    if (body.imageBase64 && body.imageBase64.length > 7_000_000) {
      return json({ error: "That photo is too large — try one under about 5MB." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Log in to use Content Studio" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "business") return json({ error: "Content Studio is available to business accounts only" }, 403);

    const [{ data: subscription }, { data: activation }] = await Promise.all([
      supabase.from("content_studio_subscriptions").select("*").eq("business_id", user.id).maybeSingle(),
      supabase.from("business_subscriptions").select("status").eq("business_id", user.id).maybeSingle(),
    ]);

    const isSubscribed = subscription?.status === "active" && subscription.current_period_end && new Date(subscription.current_period_end) > new Date();
    const isActivated = activation?.status === "active";

    if (!isSubscribed && !isActivated) {
      return json(
        { error: "Content Studio needs an active ChatSched Business activation (free tier) or a Content Studio subscription — R99/month for more.", needsActivation: true },
        402
      );
    }

    // A subscribed business gets the better tier even if also activated —
    // activation is a floor, not a cap.
    const tier: "subscription" | "free_activation" = isSubscribed ? "subscription" : "free_activation";
    const model = tier === "subscription" ? SUBSCRIPTION_MODEL : FREE_MODEL;
    const dailyLimit = tier === "subscription" ? SUBSCRIPTION_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const monthlyLimit = tier === "subscription" ? SUBSCRIPTION_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

    // Rate limiting — service-role client so a business can't dodge this
    // by racing their own client-side count. Counted against THIS tier's
    // own generations only (schema_phase103's tier column) — an activated
    // business that later subscribes starts the subscription's 150/month
    // fresh rather than inheriting whatever it used on the free tier.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sinceMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: lastCall }, { count: dayCount }, { count: monthCount }] = await Promise.all([
      admin.from("content_studio_generations").select("created_at").eq("business_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("content_studio_generations").select("id", { count: "exact", head: true }).eq("business_id", user.id).eq("tier", tier).gte("created_at", since24h),
      admin.from("content_studio_generations").select("id", { count: "exact", head: true }).eq("business_id", user.id).eq("tier", tier).gte("created_at", sinceMonthStart),
    ]);

    if (lastCall?.created_at) {
      const secondsSince = (now.getTime() - new Date(lastCall.created_at).getTime()) / 1000;
      if (secondsSince < MIN_SECONDS_BETWEEN_CALLS) {
        return json({ error: `Give it a few seconds between generations — try again shortly.` }, 429);
      }
    }
    if ((dayCount ?? 0) >= dailyLimit) {
      return json({ error: `You've reached today's limit of ${dailyLimit} generations — try again tomorrow.`, tier }, 429);
    }
    if ((monthCount ?? 0) >= monthlyLimit) {
      const resetsOn = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("en-ZA", { day: "numeric", month: "long" });
      return json({ error: `You've used ${monthlyLimit} of ${monthlyLimit} monthly AI credits. Resets on ${resetsOn}.`, tier }, 429);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Content Studio isn't set up yet — ask the platform owner to add an Anthropic API key." }, 501);

    const businessLine = body.businessName
      ? `The business is called "${body.businessName}"${body.industry ? `, in the ${body.industry} industry` : ""}.`
      : body.industry ? `The business is in the ${body.industry} industry.` : "";

    const formatSpec = formats.map((f) => `"${f}": ${FORMAT_RULES[f as (typeof VALID_FORMAT_IDS)[number]]}`).join("\n");

    const promptText = `You are a South African small-business marketing copywriter. ${businessLine}

${prompt ? `Brief from the business:\n"""\n${prompt}\n"""` : "Base everything on the attached photo."}

Generate ready-to-post content for EXACTLY these formats, following each format's own rules exactly:
${formatSpec}

Write naturally, avoid generic filler ("Are you looking for..."), and don't invent specific facts (prices, dates, addresses) that weren't given to you — write around them generically if needed instead of making them up.

Respond with ONLY a JSON object, no markdown fences, no other text, keyed by the exact format ids above, e.g.:
{"facebook": "...", "instagram": "..."}`;

    const content: Record<string, unknown>[] = [];
    if (body.imageBase64 && body.imageMediaType) {
      content.push({ type: "image", source: { type: "base64", media_type: body.imageMediaType, data: body.imageBase64 } });
    }
    content.push({ type: "text", text: promptText });

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiRes.ok) {
      console.error("content-studio-generate: Anthropic API error", await aiRes.text());
      return json({ error: "The content generator is temporarily unavailable — try again shortly." }, 502);
    }

    const aiData = await aiRes.json();
    const rawText = (aiData.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let results: Record<string, string>;
    try {
      results = JSON.parse(cleaned);
    } catch {
      console.error("content-studio-generate: could not parse model output", rawText);
      return json({ error: "Couldn't make sense of the generated content — try again." }, 502);
    }

    // Usage log — never stores the photo or the generated copy itself, just
    // enough to enforce the limits above next time, tagged with which
    // tier this call was billed against.
    await admin.from("content_studio_generations").insert({
      business_id: user.id,
      formats,
      input_mode: body.imageBase64 && prompt ? "photo_and_text" : body.imageBase64 ? "photo" : "text",
      tier,
    });

    return json({ results, tier, usage: { today: (dayCount ?? 0) + 1, dailyLimit, month: (monthCount ?? 0) + 1, monthlyLimit } });
  } catch (err) {
    console.error("content-studio-generate: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
