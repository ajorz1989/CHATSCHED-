import { useEffect, useState } from "react";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { getTransparencyStats, type TransparencyStats } from "../lib/transparencyStats";
import { CONTACT_EMAIL } from "../lib/constants";
import Button from "../components/Button";

const PALETTE = [
  { name: "Billboard Yellow", hex: "#F5B700", swatch: "bg-billboard-yellow" },
  { name: "Billboard Green", hex: "#1C6B45", swatch: "bg-billboard-green" },
  { name: "Billboard Red", hex: "#D4451F", swatch: "bg-billboard-red" },
  { name: "Ink", hex: "#1A1712", swatch: "bg-billboard-ink" },
  { name: "Paper", hex: "#FAF9F5", swatch: "bg-billboard-paper border border-billboard-ink" },
];

const BOILERPLATE = "ChatSched is a South African advertising marketplace that connects local businesses directly with the publishers, creators and channels their customers already follow — social media, influencers, websites, podcasts and radio. Every publisher is manually reviewed before being listed, and every placement runs through a transparent request-and-approve process between the business and the publisher.";

export default function Press() {
  const [publisherCount, setPublisherCount] = useState<number | null>(null);
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [copied, setCopied] = useState(false);

  // Same "real numbers or say there aren't enough yet" approach as
  // /about and /transparency — a press page is exactly the place a fake
  // or stale number would do the most damage if it got quoted somewhere.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // publishers_public (schema_phase82) — same reasoning as About.tsx.
    supabase.from("publishers_public").select("id", { count: "exact", head: true }).then(({ count }) => {
      setPublisherCount(count ?? 0);
    });
    getTransparencyStats().then(setStats);
  }, []);

  function copyBoilerplate() {
    navigator.clipboard?.writeText(BOILERPLATE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasCompletionData = stats && stats.total_requests > 0 && stats.completion_rate !== null;

  return (
    <div>
      <Seo title="Press · ChatSched" description="Company boilerplate, brand assets, and media contact for journalists covering ChatSched." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Press</span>
          <h1 className="text-3xl md:text-4xl mb-5">Everything a journalist needs, in one place.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">Company boilerplate, real numbers, brand assets, and a direct line to the team — no press office required.</p>
        </div>
      </section>

      {/* Boilerplate */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-4">Boilerplate</h2>
        <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <p className="text-billboard-inkSoft mb-4">{BOILERPLATE}</p>
          <Button onClick={copyBoilerplate} variant="outline" size="md">
            {copied ? "Copied ✓" : "Copy text"}
          </Button>
        </div>
      </section>

      {/* By the numbers */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-2">By the numbers</h2>
          <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Pulled live from the platform — the same figures shown on <a href="/transparency" className="underline">/transparency</a>, not press-release estimates.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper text-center">
              <div className="font-display text-2xl mb-1">{publisherCount !== null ? publisherCount : "—"}</div>
              <div className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">Approved publishers</div>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper text-center">
              <div className="font-display text-2xl mb-1">5</div>
              <div className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">Channels supported</div>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper text-center">
              <div className="font-display text-2xl mb-1">{hasCompletionData ? `${stats!.completion_rate}%` : "—"}</div>
              <div className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">Campaign completion rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand assets */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">Brand assets</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">The current brand mark, colour palette, and typefaces. For a different format or a higher-resolution asset, reach out below.</p>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="/favicon.svg" alt="ChatSched brand mark" className="w-16 h-16" />
            </div>
            <div className="flex gap-2">
              <a href="/favicon.svg" download className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition">SVG</a>
              <a href="/icons/icon-512.png" download className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition">PNG (512px)</a>
            </div>
          </div>
          <div className="border-[3px] border-billboard-ink rounded p-6">
            <h3 className="font-bold mb-2 text-sm">Typefaces</h3>
            <p className="text-sm text-billboard-inkSoft mb-1"><span className="font-display">Archivo Black</span> — display / headings</p>
            <p className="text-sm text-billboard-inkSoft mb-1">IBM Plex Sans — body text</p>
            <p className="text-sm text-billboard-inkSoft font-mono">IBM Plex Mono — labels & data</p>
          </div>
        </div>

        <h3 className="font-bold mb-3 text-sm">Colour palette</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PALETTE.map((c) => (
            <div key={c.name} className="border-[3px] border-billboard-ink rounded overflow-hidden">
              <div className={`h-16 ${c.swatch}`} />
              <div className="p-2 bg-white">
                <p className="text-xs font-bold">{c.name}</p>
                <p className="font-mono text-[10px] text-billboard-inkSoft">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Media contact */}
      <section className="max-w-3xl mx-auto px-5 pb-20">
        <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Media enquiries</h2>
            <p className="text-sm text-billboard-inkSoft">For interviews, comment, or anything else — reach us directly at {CONTACT_EMAIL}.</p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Press%20enquiry`} className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center">
            Email the team →
          </a>
        </div>
      </section>
    </div>
  );
}
