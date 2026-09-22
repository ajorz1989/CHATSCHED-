/**
 * Channel Hub
 *
 * The advertising channel directory — shows every channel registered in the
 * marketplace, grouped by category. Live channels link to their booking flow;
 * disabled channels show a "Coming Soon" badge but are still visible so
 * advertisers can see what's on the roadmap.
 *
 * This page never needs to change when a new channel is added. It reads
 * directly from the channel registry.
 */

import { Link } from "react-router-dom";
import { getAllChannels, getChannelsByCategory } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";
import type { ChannelModule } from "../lib/channelTypes";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";

// ─── Channel card ──────────────────────────────────────────────────────────────

function ChannelCard({ module }: { module: ChannelModule }) {
  const { definition: ch } = module;
  const enabled = isChannelEnabled(ch.slug);

  return (
    <div
      className={`relative border-[3px] rounded overflow-hidden flex flex-col transition-shadow
        ${enabled
          ? "border-billboard-ink bg-billboard-paper hover:shadow-[4px_4px_0_0_#1a1a1a] hover:-translate-y-0.5"
          : "border-billboard-inkSoft/40 bg-billboard-paperDim opacity-75"
        }`}
    >
      {/* Status badge — only for channels not yet open */}
      {!enabled && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 border border-billboard-inkSoft/50 text-billboard-inkSoft font-mono text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-white/60">
            Coming soon
          </span>
        </div>
      )}

      {/* Header block */}
      <div className="p-5 pb-4 border-b border-billboard-ink/10">
        <div className="mb-3"><ChannelIcon slug={ch.slug} /></div>
        <h3 className="font-display text-lg leading-tight mb-1">{ch.name}</h3>
        <p className="text-billboard-inkSoft text-sm leading-snug">{ch.tagline}</p>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Key benefits — top 3 */}
        <ul className="space-y-1.5">
          {ch.advertiserBenefits.slice(0, 3).map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-billboard-ink">
              <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        {enabled ? (
          ch.isLive && ch.bookingFlow === "directory" ? (
            // Fix: directory channels previously only showed "Explore live inventory"
            // with no way to reach the channel's own detail page. Now shows both:
            // primary = browse inventory, secondary = view channel page.
            <>
              <Link
                to="/browse"
                className="block w-full text-center border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold text-sm px-4 py-2.5 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
              >
                Explore live inventory →
              </Link>
              <Link
                to={`/channels/${ch.slug}`}
                className="block w-full text-center border-[3px] border-billboard-ink text-billboard-ink font-semibold text-sm px-4 py-2 rounded hover:bg-billboard-paperDim transition"
              >
                View channel page →
              </Link>
            </>
          ) : ch.isLive && ch.bookingFlow === "request" ? (
            // Fix: request-flow channels (podcast, website, radio, etc.) previously
            // showed a single "Explore inventory" button pointing at the channel's
            // own detail page, with no separate way to jump straight to browsing
            // that channel's creators. Now shows both, matching the directory
            // channels above: primary = browse this channel's creators (pre-filtered
            // /browse), secondary = view channel page (the detail page itself).
            <>
              <Link
                to={`/browse?channel=${ch.slug}`}
                className="block w-full text-center border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold text-sm px-4 py-2.5 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
              >
                Explore inventory →
              </Link>
              <Link
                to={`/channels/${ch.slug}`}
                className="block w-full text-center border-[3px] border-billboard-ink text-billboard-ink font-semibold text-sm px-4 py-2 rounded hover:bg-billboard-paperDim transition"
              >
                View channel page →
              </Link>
            </>
          ) : (
            <Link
              to={`/channels/${ch.slug}`}
              className="block w-full text-center border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold text-sm px-4 py-2.5 rounded hover:bg-billboard-inkSoft transition hover:-translate-y-0.5"
            >
              Learn more →
            </Link>
          )
        ) : (
          <Link
            to={`/channels/${ch.slug}`}
            className="block w-full text-center border-[3px] border-billboard-inkSoft/40 text-billboard-inkSoft font-semibold text-sm px-4 py-2.5 rounded cursor-pointer hover:border-billboard-inkSoft transition"
          >
            View details →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ label, channels }: { label: string; channels: ChannelModule[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-display text-xl">{label}</h2>
        <div className="flex-1 h-[3px] bg-billboard-ink/10 rounded" />
        <span className="font-mono text-xs text-billboard-inkSoft">{channels.length} channel{channels.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map((m) => (
          <ChannelCard key={m.definition.slug} module={m} />
        ))}
      </div>
    </section>
  );
}

// ─── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar() {
  const all = getAllChannels();
  const enabled = all.filter((m) => isChannelEnabled(m.definition.slug)).length;
  const live = enabled;
  const coming = all.length - enabled;

  return (
    <div className="grid grid-cols-3 border-[3px] border-billboard-ink rounded divide-x-[3px] divide-billboard-ink mb-10">
      {[
        { value: all.length, label: "Total channels" },
        { value: live, label: "Open now" },
        { value: coming, label: "In development" },
      ].map(({ value, label }) => (
        <div key={label} className="py-5 text-center">
          <div className="font-display text-3xl">{value}</div>
          <div className="text-billboard-inkSoft text-xs font-mono uppercase tracking-wide mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function ChannelHub() {
  const groups = getChannelsByCategory();

  return (
    <>
      <Seo
        title="Advertising Channels — ChatSched"
        description="Every advertising channel available on ChatSched — social media, influencer campaigns, website advertising, podcast sponsorships, and radio."
      />

      <div className="max-w-6xl mx-auto px-5 py-16">
        {/* Page header */}
        <div className="mb-10">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-4">
            Channel directory
          </span>
          <h1 className="text-4xl mb-3">Every board your customers already look at.</h1>
          <p className="text-billboard-inkSoft text-lg max-w-2xl">
            Browse the advertising inventory available through ChatSched. The live channel count updates automatically from the marketplace registry. Only Minibus Taxi &amp; Transport Media and Spaza Shops &amp; Township Traders remain in development.
          </p>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Channel groups */}
        <div className="space-y-12">
          {groups.map((g) => (
            <CategorySection key={g.label} label={g.label} channels={g.channels} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 border-[3px] border-billboard-ink rounded p-8 bg-billboard-paperDim text-center">
          <h2 className="font-display text-2xl mb-2">Ready to advertise?</h2>
          <p className="text-billboard-inkSoft mb-6 max-w-lg mx-auto">
            Browse the live publisher inventory available now and choose the channel that fits your audience. Eleven channel types are live today; only the two development channels remain outside the live marketplace.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
            >
              Explore live inventory →
            </Link>
            <Link
              to="/audience-finder"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-paperDim transition"
            >
              Audience Finder
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
