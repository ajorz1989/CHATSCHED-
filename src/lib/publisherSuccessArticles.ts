export interface SuccessArticle {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  readMins: number;
  tag: string;
  paragraphs: string[];
}

// Eight practical guides for publishers/creators — grounded in how the
// platform's own tools actually work (Suggested Price, trust score,
// authenticity review, the request/approve/schedule flow), not generic
// influencer-blog filler.
export const PUBLISHER_SUCCESS_ARTICLES: SuccessArticle[] = [
  {
    slug: "how-to-price-your-advertising",
    title: "How to price your advertising without guessing",
    excerpt: "A simple, transparent way to land on a number you can defend to any business that asks.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Pricing",
    paragraphs: [
      "Pricing a placement doesn't have to be a guessing game. Your Suggested Price starts from a simple base — a rate per 1,000 followers — then adjusts up or down based on your engagement relative to a typical baseline, and your trust score once you've built one up. Every input in that number is something you can already see about your own page, so it's worth understanding rather than treating as a black box.",
      "Followers set the floor, but engagement is what actually moves the number. A smaller, highly engaged audience will often price higher than a much bigger, quieter one — which is exactly how it should work, since engagement is the thing a business is really paying for.",
      "Treat your Suggested Price as a strong starting point, not a rule. It's reasonable to price slightly above it for a business asking for something more involved — a longer post, extra creative work, a specific time slot — and reasonable to come in slightly under it while you're still building trust score and case studies. What matters is that the number is defensible, and grounded in numbers you can point to.",
    ],
  },
  {
    slug: "building-a-media-kit-that-converts",
    title: "Building a media kit that actually gets requests approved",
    excerpt: "You don't need a design agency — you need three or four facts, stated clearly.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Media Kit",
    paragraphs: [
      "A good media kit answers one question fast: who is this audience, and why should a business trust that it's real? Lead with your niche and location, your follower count and engagement rate, and one or two lines about who actually follows you — their interests, their age range, their area — rather than generic stats with no context.",
      "Screenshots of genuine engagement — comments, shares, saves — usually do more work than a polished slide deck. A business browsing publishers is trying to picture their own post in your feed getting that same kind of response, so make that easy to imagine.",
      "Keep it current. A media kit with stale follower counts or a case study from over a year ago undercuts the very trust it's trying to build. Update it whenever your numbers move meaningfully, and treat your ChatSched profile as the living version of it — it's often the first, and sometimes only, media kit a business will actually see.",
    ],
  },
  {
    slug: "increasing-engagement-that-businesses-can-see",
    title: "Increasing engagement in ways businesses can actually see",
    excerpt: "Not every engagement tactic helps you get booked — here's what does.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Engagement",
    paragraphs: [
      "Engagement matters here for a specific reason: it's one of the biggest levers in your own Suggested Price, and it's the first thing a business checks before sending a request. That means engagement tactics that boost vanity numbers without boosting real interaction — engagement pods, giveaway-only spikes — don't actually help you, and can even work against you if they push your rate above what your real audience supports.",
      "The engagement that moves the needle is the kind tied to genuine interest: asking a real question in your caption, replying to every comment instead of just the first few, and posting consistently enough that your audience develops a habit of checking in. None of that requires a bigger budget — it requires consistency.",
      "It's also worth engaging with the kind of content you want to be known for. If you want local businesses to picture their product in your feed, post about local businesses and local life often enough that it's obviously part of who you are, not a one-off when a sponsored post comes in.",
    ],
  },
  {
    slug: "responding-to-campaign-requests-well",
    title: "Responding to campaign requests in a way that builds repeat business",
    excerpt: "How you respond to a request matters almost as much as whether you accept it.",
    date: "2026-08-20",
    readMins: 3,
    tag: "Responding to Requests",
    paragraphs: [
      "Every request that lands in your dashboard is a chance to build a relationship, even the ones you decline. Respond promptly — a business that hears nothing for days is likely to move on to another publisher, even if you'd have been the better fit.",
      "If a request isn't quite right, say so specifically rather than leaving it to expire silently. 'This isn't the right audience for a product like this' or 'I'm booked that week, but I have space the following one' gives a business something to act on, and it's far more likely to bring them back with a better-fitting request next time.",
      "Once you accept, confirm the details clearly — what's being posted, when, and anything you need from the business to make it happen. Ambiguity at this stage is where most avoidable disputes start; a short, specific confirmation message prevents most of them before they happen.",
    ],
  },
  {
    slug: "avoiding-fake-followers-and-inflated-numbers",
    title: "Why fake followers cost you more than they earn you",
    excerpt: "Inflated numbers might get you approved once — they won't get you booked again.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Authenticity",
    paragraphs: [
      "It can be tempting to inflate a follower count or buy engagement before applying, especially early on. Resist it. Every publisher on the platform is reviewed, and numbers that don't add up — engagement far outside a normal range for your audience size, or reach that vastly exceeds your follower count — are exactly the kind of thing that gets a second look during review.",
      "Even when inflated numbers slip through, they create a problem you'll have to live with: your Suggested Price gets calculated off numbers your real audience can't back up, so businesses that book you end up disappointed with results that don't match what they paid for. That's the fastest way to lose a repeat customer.",
      "The alternative is slower but far more durable: grow a real, engaged audience, keep your stated numbers honest, and let your trust score build over time as businesses have good experiences with you. A smaller, authentic audience with a strong trust score will consistently out-earn a bigger, inflated one that can't deliver.",
    ],
  },
  {
    slug: "improving-your-publisher-profile",
    title: "Improving your profile so businesses choose you first",
    excerpt: "A few specific details make the difference between being skipped and being requested.",
    date: "2026-08-20",
    readMins: 3,
    tag: "Profiles",
    paragraphs: [
      "Businesses browse dozens of publishers before sending a request, and most decide in seconds whether to click into a profile at all. A clear, specific description of your niche and audience — not a generic one-liner — is what earns that click, especially when it's obvious at a glance who you're a good fit for.",
      "Fill in every field you can. An incomplete profile — missing location, no monthly reach figure, no recent examples — reads as either new or inactive, even if neither is true. Every extra detail you provide is one less thing a business has to guess at before deciding to request you.",
      "Keep your profile current the same way you'd keep a shopfront tidy. Update your numbers as they change, swap in recent examples instead of old ones, and revisit your description periodically as your audience or niche shifts — a profile that looks actively maintained signals a publisher who's actually paying attention.",
    ],
  },
  {
    slug: "negotiating-campaigns-with-businesses",
    title: "Negotiating a campaign without underselling yourself",
    excerpt: "Negotiation isn't a fight over price — it's matching what's asked to what it's worth.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Negotiation",
    paragraphs: [
      "Most negotiation on a platform like this isn't adversarial — it's clarifying what's actually being asked for. If a request is vague about scope, ask before quoting: one post is a very different price to a post plus a story plus a follow-up mention, and getting that clear upfront avoids an awkward renegotiation later.",
      "Your Suggested Price is a legitimate anchor to negotiate from. If a business pushes back on price, it's reasonable to explain what the number reflects — your engagement, your audience fit, your trust score — rather than simply dropping it. A business that understands why a rate is what it is will often accept it rather than one that thinks it's arbitrary.",
      "It's also fine to negotiate on scope instead of price. If a business's budget is genuinely below what a full placement is worth, offering a smaller version — one post instead of a full package — protects your rate while still finding a way to say yes.",
    ],
  },
  {
    slug: "creating-sponsored-content-that-performs",
    title: "Creating sponsored content your audience doesn't scroll past",
    excerpt: "The best-performing sponsored posts don't look like a break from your usual content — they look like more of it.",
    date: "2026-08-20",
    readMins: 4,
    tag: "Sponsored Content",
    paragraphs: [
      "The sponsored posts that perform best are the ones that don't announce themselves as a departure from everything else you post. If your audience is used to your voice, your format and your usual tone, a sponsored post that keeps all three — just about a different business — will land far better than one that suddenly reads like a corporate ad.",
      "Be specific instead of generic. 'Great coffee, check them out' does far less work than describing an actual detail — what you ordered, what stood out, why you'd go back. Specificity is what makes sponsored content feel like a genuine recommendation instead of a paid mention, and audiences can tell the difference.",
      "Disclose clearly, every time. Being upfront that a post is sponsored doesn't hurt performance the way creators sometimes fear — what actually hurts performance, and trust, is an audience feeling like they were tricked into thinking a paid post was organic. Clear disclosure paired with content that's genuinely good is what keeps both your audience and the businesses who book you coming back.",
    ],
  },
];

export function getPublisherSuccessArticleBySlug(slug: string): SuccessArticle | undefined {
  return PUBLISHER_SUCCESS_ARTICLES.find((a) => a.slug === slug);
}
