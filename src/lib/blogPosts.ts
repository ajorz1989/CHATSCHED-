export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  readMins: number;
  tag: string;
  paragraphs: string[];
}

// Ten short posts on why advertising matters more than ever in the modern
// world — written from ChatSched' angle (small SA businesses,
// real local audiences) rather than as generic marketing-blog filler.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "attention-is-the-scarcest-resource",
    title: "Attention is the scarcest resource your business has to compete for",
    excerpt: "Shelf space used to be the battleground. Today it's someone's scrolling thumb, and it moves fast.",
    date: "2026-07-02",
    readMins: 3,
    tag: "Why advertising matters",
    paragraphs: [
      "A generation ago, getting noticed meant a good shopfront, a listing in the phone book, or a flyer on the right pole. Today, every business — yours included — is competing for the same few seconds of someone's attention on a screen they check over a hundred times a day.",
      "That shift changes what advertising is for. It's no longer just about announcing that you exist. It's about being the thing that actually breaks through a feed built to reward whatever's loudest, funniest, or most relevant right now. Businesses that treat advertising as optional are quietly betting that customers will find them anyway. In a modern, noisy market, that bet rarely pays off.",
      "This is exactly why where you show up matters as much as what you say. A post from a page your customer already follows and trusts cuts through in a way a random ad never will — because it's not fighting for attention from a stranger, it's arriving through a relationship that already exists.",
    ],
  },
  {
    slug: "local-trust-beats-global-reach",
    title: "Local trust beats global reach, every time",
    excerpt: "A small audience that believes you beats a huge one that's never heard of you.",
    date: "2026-07-05",
    readMins: 3,
    tag: "Local marketing",
    paragraphs: [
      "It's tempting to think bigger reach always wins. But reach without trust is just noise — a big number that doesn't convert into a single customer walking through your door.",
      "Modern advertising works best when it borrows trust that already exists. A local Facebook group, a neighbourhood page, or a community-focused creator has spent months or years earning the confidence of the people who follow them. When your business shows up there, some of that trust transfers to you — instantly, and far more convincingly than any billboard on a highway ever could.",
      "This is the whole logic behind advertising through real local publishers instead of anonymous ad platforms: you're not just buying impressions, you're borrowing credibility from someone your future customer already listens to.",
    ],
  },
  {
    slug: "word-of-mouth-isnt-enough-anymore",
    title: "Word-of-mouth built your business. It won't scale it alone.",
    excerpt: "Referrals are still gold — but they travel slower than the businesses competing with you online.",
    date: "2026-07-09",
    readMins: 3,
    tag: "Small business growth",
    paragraphs: [
      "Plenty of small South African businesses were built entirely on word-of-mouth — a happy customer telling a friend, a friend telling a neighbour. That's still one of the most powerful forms of marketing there is. But it has a ceiling, and in a modern market that ceiling is lower than it used to be.",
      "Word-of-mouth used to travel through a small, physical circle — your street, your suburb, your regulars' friend groups. Now, your competitors are advertising directly into people's phones every day, expanding their circle far faster than one satisfied customer telling one friend ever could.",
      "Advertising doesn't replace word-of-mouth — it amplifies it. A feature on a trusted local page reaches, in one post, the kind of audience that would otherwise take months of organic recommendations to build.",
    ],
  },
  {
    slug: "social-proof-and-modern-trust",
    title: "Why 'someone I follow posted about it' beats any slogan",
    excerpt: "Modern audiences trust people over brands. Advertising through the right person closes that gap.",
    date: "2026-07-14",
    readMins: 3,
    tag: "Consumer behaviour",
    paragraphs: [
      "Advertising used to mean writing the cleverest slogan and hoping it stuck. Today's audiences are far more skeptical of brands talking about themselves — and far more receptive to a page, creator or community they already follow doing the talking instead.",
      "That's social proof, and it's become one of the most important forces in modern buying decisions. Seeing your product mentioned by a page someone already trusts does more work than any amount of self-promotion, because it doesn't feel like an ad — it feels like a recommendation.",
      "This is why the format matters as much as the message. A quiet mention on the right community page, or a host's own words on a local podcast, often outperforms a polished campaign that nobody asked to see.",
    ],
  },
  {
    slug: "niche-audiences-beat-mass-audiences",
    title: "The age of the mass audience is over — niche wins now",
    excerpt: "You don't need everyone to see your ad. You need the right few hundred people to see it.",
    date: "2026-07-18",
    readMins: 3,
    tag: "Targeting",
    paragraphs: [
      "For most small businesses, reaching everyone was never realistic — and it was never necessary. What matters is reaching the specific people who are actually likely to become customers: people in your suburb, people who care about your category, people who follow the kind of pages your ideal customer follows.",
      "Modern advertising has made this kind of precision the norm rather than the exception. A pet grooming business doesn't need a billboard seen by a hundred thousand people driving past — it needs the two thousand pet owners in its own area who already follow a local pets page.",
      "That's a fundamentally different, more efficient way to think about advertising: not 'how many people can see this', but 'how many of the right people can see this'.",
    ],
  },
  {
    slug: "consistency-beats-one-off-ads",
    title: "One great ad won't do it. Showing up consistently will.",
    excerpt: "Modern customers need to see you more than once before they trust you enough to buy.",
    date: "2026-07-22",
    readMins: 2,
    tag: "Advertising strategy",
    paragraphs: [
      "It's a common mistake to treat advertising as a single event — one post, one campaign, then back to waiting for customers to arrive. In a modern market with this much competition for attention, that rarely works.",
      "Most people need to come across a business several times, in a few different places, before it registers enough to act on. That's not a flaw in advertising — it's just how trust gets built when there's this much else competing for the same attention.",
      "This is why an ongoing presence across a few well-chosen local channels tends to outperform a single big push. Consistency is what turns 'I think I've seen that before' into 'I know exactly who that is'.",
    ],
  },
  {
    slug: "showing-up-where-your-customers-already-are",
    title: "Stop trying to pull customers in. Show up where they already are.",
    excerpt: "Modern advertising works with people's habits, not against them.",
    date: "2026-07-26",
    readMins: 3,
    tag: "Multi-channel presence",
    paragraphs: [
      "Customers today move between a handful of familiar places — the social pages they check daily, the podcast they listen to on their commute, the local radio station in the background at work, the websites they trust for local news. Trying to pull them away from those habits toward your business is hard work. Meeting them inside those habits is far easier.",
      "That's the real advantage of advertising across multiple everyday channels rather than betting everything on one. A message that reaches someone through their podcast, their social feed, and their local radio station over the course of a month feels less like an interruption and more like familiarity.",
      "Modern advertising isn't about shouting louder than everyone else. It's about being present in the ordinary moments where your customers already are.",
    ],
  },
  {
    slug: "advertising-doesnt-need-a-big-budget-anymore",
    title: "You don't need a big-brand budget to advertise well anymore",
    excerpt: "Direct partnerships with real local creators have levelled the playing field for small businesses.",
    date: "2026-07-30",
    readMins: 3,
    tag: "Small business budgets",
    paragraphs: [
      "For a long time, real advertising — the kind that reaches thousands of people — felt like something only bigger businesses could afford. Billboards, radio slots and print ads all came with costs that put them out of reach for most small, local businesses.",
      "That's changed. Direct partnerships with local pages, influencers, podcasters and radio hosts mean a small business can now buy exactly the placement it needs, from a creator whose audience already matches its customers, without the overhead of a traditional agency campaign.",
      "This is the shift that makes modern advertising genuinely more important than ever for small businesses specifically: the tools that used to belong to big brands are now available directly, at a scale that actually fits a small business's budget and goals.",
    ],
  },
  {
    slug: "proof-over-promises",
    title: "Modern advertising runs on proof, not just promises",
    excerpt: "Today's audiences want to see it's real before they believe it.",
    date: "2026-08-02",
    readMins: 3,
    tag: "Transparency",
    paragraphs: [
      "Older advertising often asked people to simply take a brand's word for it. Modern audiences are more skeptical, and more used to checking — reading reviews, watching for how a business actually shows up, noticing whether a claim holds up in practice.",
      "That raises the bar for advertising, but it's also an opportunity. A campaign that runs through a real, verifiable local page or creator carries proof built in — an existing audience, an existing track record, real engagement that anyone can see for themselves.",
      "In a market where trust has to be earned before it's given, advertising through channels with a real, checkable presence does more than reach people. It gives them a reason to believe what they're seeing.",
    ],
  },
  {
    slug: "advertising-is-a-relationship-not-a-broadcast",
    title: "The best modern advertising doesn't feel like advertising",
    excerpt: "It feels like a recommendation from someone your customer already trusts.",
    date: "2026-08-05",
    readMins: 3,
    tag: "The bigger picture",
    paragraphs: [
      "Advertising used to be mostly one-directional — a business broadcasting a message and hoping it landed. The most effective advertising today works differently: it's built on a relationship between a business, a publisher or creator, and the audience that creator has earned over time.",
      "When that relationship is direct and genuine, the resulting ad doesn't feel like an interruption. It feels like a local page telling its followers about a business worth knowing, because that's exactly what it is.",
      "That's ultimately why advertising matters more now than it used to — not because there's more of it, but because doing it well means understanding that people don't want to be sold to. They want to be introduced to something worth their attention, by someone they already trust to make that call.",
    ],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
