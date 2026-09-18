import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";
import { getTransparencyStats, type TransparencyStats } from "../lib/transparencyStats";
import { isSupabaseConfigured } from "../lib/supabase";

const LINKS = [
  { title: "Dispute handling", body: "How a disagreement between a business and a publisher gets reviewed and resolved.", to: "/trust#disputes" },
  { title: "Verification process", body: "What every publisher goes through before they're listed — manual review, not just a signup form.", to: "/trust#verification" },
  { title: "Trust Centre", body: "The full picture — creator standards, business standards, safety, and fraud prevention.", to: "/trust" },
  { title: "Platform rules", body: "Disclosure requirements and restrictions ChatSched tracks for every supported channel.", to: "/platform-rules" },
];

function StatCard({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 text-center">
      <div className="font-display text-3xl mb-1">{value}</div>
      <div className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">{label}</div>
      {note && <div className="text-xs text-billboard-inkSoft mt-1.5">{note}</div>}
    </div>
  );
}

export default function Transparency() {
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    getTransparencyStats().then((s) => { setStats(s); setLoading(false); });
  }, []);

  const channels = getEnabledChannels();
  const hasCompletionData = stats && stats.total_requests > 0 && stats.completion_rate !== null;
  const hasResponseData = stats && stats.responded_requests > 0 && stats.avg_response_hours !== null;

  return (
    <div>
      <Seo title="Marketplace Transparency · ChatSched" description="Real, platform-wide numbers on campaign completion, response time, dispute handling, verification, and the rules the marketplace runs on." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Marketplace Transparency</span>
          <h1 className="text-3xl md:text-4xl mb-5">The numbers, the rules, and how disagreements get handled.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">Not a brochure — real, platform-wide figures, updated as the marketplace runs, alongside the actual rules and processes behind them.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">Live marketplace stats</h2>
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border-[3px] border-billboard-ink rounded p-5 h-24 animate-pulse bg-billboard-paperDim" />
            <div className="border-[3px] border-billboard-ink rounded p-5 h-24 animate-pulse bg-billboard-paperDim" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <StatCard
              value={hasCompletionData ? `${stats!.completion_rate}%` : "—"}
              label="Campaign completion rate"
              note={hasCompletionData ? `${stats!.completed_requests} of ${stats!.total_requests} requests completed` : "Not enough data yet"}
            />
            <StatCard
              value={hasResponseData ? `${stats!.avg_response_hours}h` : "—"}
              label="Average response time"
              note={hasResponseData ? "From request submitted to publisher's first response" : "Not enough data yet"}
            />
          </div>
        )}
        <p className="text-xs text-billboard-inkSoft mt-4">Calculated directly from every request submitted through the platform — not a marketing estimate.</p>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="font-display text-xl mb-2">Supported channels</h2>
          <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Every channel currently open on the platform.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {channels.map((m) => (
              <Link
                key={m.definition.slug}
                to={`/channels/${m.definition.slug}`}
                className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper hover:-translate-y-0.5 transition"
              >
                <div className="mb-3"><ChannelIcon slug={m.definition.slug} /></div>
                <h3 className="font-bold mb-1">{m.definition.name}</h3>
                <p className="text-sm text-billboard-inkSoft">{m.definition.tagline}</p>
              </Link>
            ))}
          </div>
          <Link to="/channels" className="inline-block mt-6 font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition">
            View full channel directory →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">How the marketplace is governed</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">The processes behind those numbers — how disputes get handled, how publishers get verified, and the rules everyone runs on.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {LINKS.map((l) => (
            <Link key={l.title} to={l.to} className="border-[3px] border-billboard-ink rounded p-5 hover:-translate-y-0.5 transition">
              <h3 className="font-bold mb-1.5">{l.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{l.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
