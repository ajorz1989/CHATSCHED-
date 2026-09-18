import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { getAllChannels, getChannelBySlug } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";

interface Question {
  prompt: string;
  options: { label: string; scores: Partial<Record<ChannelSlug, number>> }[];
}

const QUESTIONS: Question[] = [
  {
    prompt: "What's the main goal for this campaign?",
    options: [
      { label: "More foot traffic, soon", scores: { "social-media": 2, influencer: 1 } },
      { label: "Long-term brand awareness", scores: { website: 2, radio: 1 } },
      { label: "Reach a specific interest group", scores: { podcast: 2, influencer: 1 } },
      { label: "Get local word of mouth going", scores: { "social-media": 1, radio: 2 } },
    ],
  },
  {
    prompt: "How would you describe your customers?",
    options: [
      { label: "Scrolling social media constantly", scores: { "social-media": 2 } },
      { label: "Listening to podcasts or audio", scores: { podcast: 2 } },
      { label: "Reading local websites or news", scores: { website: 2 } },
      { label: "Tuned into local radio", scores: { radio: 2 } },
      { label: "Following specific creators they trust", scores: { influencer: 2 } },
    ],
  },
  {
    prompt: "How quickly do you need results?",
    options: [
      { label: "Within days", scores: { "social-media": 2 } },
      { label: "A few weeks is fine", scores: { influencer: 1, podcast: 1 } },
      { label: "I'm playing the long game", scores: { website: 2, radio: 1 } },
    ],
  },
  {
    prompt: "What kind of message are you sending?",
    options: [
      { label: "A quick visual offer or promo", scores: { "social-media": 2 } },
      { label: "An in-depth story or review", scores: { podcast: 2, influencer: 1 } },
      { label: "Steady, ongoing brand presence", scores: { website: 2 } },
      { label: "Something broad, community-wide", scores: { radio: 2 } },
    ],
  },
  {
    prompt: "What's your budget comfort for a first campaign?",
    options: [
      { label: "Small — testing the waters", scores: { "social-media": 1, influencer: 1 } },
      { label: "Medium", scores: { podcast: 1, website: 1 } },
      { label: "Willing to invest more for reach", scores: { radio: 1, website: 1 } },
    ],
  },
];

export default function ChannelQuiz() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Partial<Record<ChannelSlug, number>>>({});
  const [result, setResult] = useState<ChannelSlug | null>(null);

  function answer(optionScores: Partial<Record<ChannelSlug, number>>) {
    const next: Partial<Record<ChannelSlug, number>> = { ...scores };
    for (const [slug, pts] of Object.entries(optionScores)) {
      next[slug as ChannelSlug] = (next[slug as ChannelSlug] ?? 0) + (pts ?? 0);
    }
    setScores(next);

    if (step + 1 < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      const winner = (Object.entries(next) as [ChannelSlug, number][])
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "social-media";
      setResult(winner);
    }
  }

  function restart() {
    setStep(0);
    setScores({});
    setResult(null);
  }

  const resultModule = result ? getChannelBySlug(result) : undefined;
  const allChannels = getAllChannels();

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title="Which Channel Fits Your Business? · ChatSched" description="A five-question quiz that matches your business to the right advertising channel — social media, influencer, website, podcast, or radio." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Business Tools</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Which channel fits your business?</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">Two minutes, five questions — get matched to the channel your customers actually pay attention to.</p>

      {!result ? (
        <div className="border-[3px] border-billboard-ink rounded p-6">
          <div className="flex gap-1.5 mb-6">
            {QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-billboard-yellow" : "bg-billboard-paperDim"}`} />
            ))}
          </div>
          <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-2">Question {step + 1} of {QUESTIONS.length}</p>
          <h2 className="font-display text-xl mb-6">{QUESTIONS[step].prompt}</h2>
          <div className="space-y-2.5">
            {QUESTIONS[step].options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => answer(opt.scores)}
                className="w-full text-left border-2 border-billboard-ink rounded px-4 py-3 hover:bg-billboard-paperDim hover:-translate-y-0.5 transition font-semibold text-sm"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-[3px] border-billboard-ink rounded p-7 bg-billboard-green text-white text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-white/80 mb-3">Your best fit</p>
            <div className="flex justify-center mb-3">
              {resultModule && <ChannelIcon slug={resultModule.definition.slug} />}
            </div>
            <p className="font-display text-3xl mb-2">{resultModule?.definition.name ?? "Social Media"}</p>
            <p className="text-white/85 max-w-sm mx-auto">{resultModule?.definition.tagline}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Link to={resultModule ? `/channels/${resultModule.definition.slug}` : "/channels"} className="text-center border-[3px] border-billboard-ink rounded px-4 py-3 font-bold hover:-translate-y-0.5 transition">
              Learn more about this channel
            </Link>
            <Link to={resultModule ? `/browse?channel=${resultModule.definition.slug}` : "/browse"} className="text-center bg-billboard-yellow border-[3px] border-billboard-ink rounded px-4 py-3 font-bold hover:-translate-y-0.5 transition">
              Browse matching publishers
            </Link>
          </div>

          <button onClick={restart} className="block mx-auto font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink underline">
            Retake the quiz
          </button>
        </div>
      )}

      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10">
        <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-3 text-center">All channels, for reference</p>
        <div className="flex flex-wrap justify-center gap-2">
          {allChannels.map((m) => (
            <Link key={m.definition.slug} to={`/channels/${m.definition.slug}`} className="font-mono text-xs font-semibold border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition">
              {m.definition.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
