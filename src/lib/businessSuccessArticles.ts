export interface SuccessArticle {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  readMins: number;
  tag: string;
  paragraphs: string[];
}

// Seven practical guides, one per stage of a business's advertising
// journey on ChatSched — from a first campaign through to repeat ones.
// Written as how-to guidance grounded in how the platform actually works
// (request → publisher review → schedule → live → proof), not generic
// marketing-blog filler.
export const SUCCESS_ARTICLES: SuccessArticle[] = [
  {
    slug: "getting-your-first-campaign",
    title: "Getting your first campaign off the ground",
    excerpt: "The fastest path from 'never advertised before' to your first placement going live.",
    date: "2026-08-06",
    readMins: 4,
    tag: "Getting Started",
    paragraphs: [
      "Your first campaign doesn't need to be complicated. Start with one clear goal — more foot traffic this week, awareness for a new product, sign-ups for an event — and pick a single publisher whose audience matches the people you're trying to reach. Trying to do everything at once, across every channel, is the most common reason a first campaign stalls before it starts.",
      "From there, the process is simple: browse publishers by category and area, pick one that fits, and submit a feature request describing what you want promoted and roughly when. You don't need a media kit or a formal brief — a clear, specific description of the offer and the audience you're hoping to reach is enough for a publisher to decide if it's a good fit.",
      "Once a publisher accepts, they schedule the placement and mark it live — you'll be able to see it happen, not just take their word for it. Treat this first campaign as a test: small, specific, and easy to judge. What you learn from it — which audience responded, what kind of message landed — is what makes your second campaign better than your first.",
    ],
  },
  {
    slug: "choosing-the-right-publishers",
    title: "Choosing publishers your actual customers already follow",
    excerpt: "Bigger isn't always better — the right audience beats the biggest one, every time.",
    date: "2026-08-08",
    readMins: 4,
    tag: "Choosing Publishers",
    paragraphs: [
      "It's tempting to sort by follower count and go straight for the biggest page you can find. Resist that instinct. A publisher with a smaller, tightly relevant audience — a neighbourhood page, a niche creator, a local podcast in your exact category — will usually outperform a bigger, more generic one, because their audience already has a reason to care about businesses like yours.",
      "Start with category and location, not size. If you're a suburb-based business, a publisher whose audience spans the whole province is often a worse fit than one focused squarely on your suburb. Read the publisher's profile closely — what they post about, who follows them, and what kind of businesses they've featured before — before you send a request.",
      "It's also worth spreading a small budget across two or three well-matched publishers rather than putting everything behind one, especially early on. That gives you a real comparison: which audience actually responded, not just which page had the biggest number attached to it.",
    ],
  },
  {
    slug: "calculating-your-campaign-budget",
    title: "Calculating a campaign budget that actually makes sense",
    excerpt: "A simple way to work out what to spend, before you spend anything.",
    date: "2026-08-10",
    readMins: 4,
    tag: "Budgeting",
    paragraphs: [
      "Before you pick a number, work backwards from what a new customer is actually worth to your business. If a typical customer spends R400 and you'd happily pay R80 to acquire one, that ratio should shape how much you're willing to put behind a single placement — not a round number that felt safe.",
      "Because there's no minimum spend and no contract, the lowest-risk way to find your budget is to test small first. Run one modest campaign, see what it produces, then scale the number up for the publishers and messages that worked rather than guessing upfront at what a 'proper' campaign should cost.",
      "It also helps to budget per goal, not per month. A campaign built to fill tables on a quiet Tuesday needs a different budget logic to one building long-term brand awareness — the first should be judged on that week's results, the second needs a few campaigns running before you can judge it fairly at all.",
    ],
  },
  {
    slug: "measuring-roi-on-local-campaigns",
    title: "Measuring ROI without overcomplicating it",
    excerpt: "You don't need a dashboard full of metrics — you need the two or three numbers that actually matter.",
    date: "2026-08-12",
    readMins: 4,
    tag: "Measuring ROI",
    paragraphs: [
      "Before a campaign goes live, decide what 'it worked' will actually look like — more people through the door, more calls, more bookings, a specific promo code being used. Without that decision made in advance, it's very easy to convince yourself after the fact that any result counts as a win.",
      "For most small businesses, the simplest reliable signal is a trackable action: a unique discount code, a dedicated phone number, or asking new customers directly how they heard about you. These low-effort methods usually tell you more than trying to track vague brand-awareness metrics that are hard to attribute to any one placement.",
      "Judge return on investment against what the campaign cost, not against how it felt. A quiet campaign that brought in ten paying customers at a low cost each is a better result than a loud one that generated a lot of likes and very few sales — the goal is customers and revenue, not activity.",
    ],
  },
  {
    slug: "growing-your-business-locally",
    title: "Growing locally, one trusted audience at a time",
    excerpt: "Sustainable local growth looks less like a big splash and more like steady, repeated presence.",
    date: "2026-08-14",
    readMins: 3,
    tag: "Local Growth",
    paragraphs: [
      "Local growth rarely comes from one big campaign — it comes from becoming a familiar name across the handful of channels your community already pays attention to. Showing up consistently on two or three well-matched local publishers over a few months tends to build more trust than one large, one-off push ever will.",
      "As you grow, widen your reach deliberately rather than all at once — add one new publisher or one new neighbourhood at a time, and keep the ones that are already working for you. Local growth compounds: the customers you win from one campaign become the word-of-mouth that makes your next one land even better.",
      "It's also worth revisiting your publisher mix as your business changes. A publisher that was the right fit when you were opening your doors might not be the right one two years later once your customer base has shifted — treat your list of publishers as something to review, not something to set once and forget.",
    ],
  },
  {
    slug: "common-campaign-mistakes",
    title: "Campaign mistakes worth avoiding on your next one",
    excerpt: "The same handful of avoidable mistakes account for most disappointing campaigns.",
    date: "2026-08-16",
    readMins: 4,
    tag: "Common Mistakes",
    paragraphs: [
      "The single most common mistake is trying to say everything at once — the opening special, the new menu item, the loyalty programme, all in one post. A campaign with one clear message and one clear action almost always outperforms one trying to cover everything your business does.",
      "A close second is choosing a publisher by size instead of fit, then being surprised when a huge, generic audience doesn't convert into local customers. The audience needs to actually match who you're trying to reach — that matters far more than the raw number of people who'll see the post.",
      "The third is judging a campaign too early, or not judging it at all. Give a placement time to actually reach its audience before deciding it didn't work, but also make sure you've decided in advance what success looks like — a campaign without a defined goal is a campaign you can't honestly evaluate afterwards.",
    ],
  },
  {
    slug: "building-a-repeat-campaign-rhythm",
    title: "Turning one campaign into a repeatable rhythm",
    excerpt: "The businesses that see the best results treat advertising as an ongoing habit, not a one-off event.",
    date: "2026-08-18",
    readMins: 3,
    tag: "Repeat Campaigns",
    paragraphs: [
      "A single campaign can produce a good week. A repeated rhythm — the same reliable publishers, running on a regular cadence — is what produces a good year. Once you've found a publisher and a message that worked, the highest-leverage move is usually to repeat it, not to start over looking for something new.",
      "Build a simple, sustainable schedule rather than reacting campaign by campaign — for example, one placement a month with your best-performing publisher, topped up with an extra push around key dates for your business. Predictability makes budgeting easier too, since you're no longer guessing at costs from scratch each time.",
      "Keep a short record of what you ran, where, and what it produced. Over a handful of campaigns, that record becomes the clearest guide you'll have to where your next budget should go — far more reliable than starting from instinct every time.",
    ],
  },
];

export function getSuccessArticleBySlug(slug: string): SuccessArticle | undefined {
  return SUCCESS_ARTICLES.find((a) => a.slug === slug);
}
