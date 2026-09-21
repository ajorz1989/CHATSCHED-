/**
 * Channel Page — /channels/:slug
 *
 * Dynamic route for individual advertising channels. Reads the slug from the
 * URL, looks it up in the channel registry, checks the feature flag, and:
 *
 *  - If the channel has a custom BrowsePage component → renders it.
 *  - Otherwise → renders the generic channel detail page (works for all channels,
 *    including placeholders that haven't been built out yet).
 *
 * This file never needs to change when a new channel is added.
 */

import { useParams, Link } from "react-router-dom";
import { getChannelBySlug, isSlugEnabled } from "../lib/channelRegistry";
import type { ChannelDefinition, AnalyticsMetric } from "../lib/channelTypes";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { whatsappLink } from "../lib/constants";
import CampaignCostCalculator from "../components/CampaignCostCalculator";
import LiveInventoryBanner from "../components/LiveInventoryBanner";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricRow({ metric }: { metric: AnalyticsMetric }) {
  const methodBadge: Record<string, string> = {
    automated: "bg-billboard-green/15 text-billboard-greenDeep",
    manual:    "bg-billboard-yellow/30 text-billboard-ink",
    estimated: "bg-billboard-inkSoft/15 text-billboard-inkSoft",
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-billboard-ink/10 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{metric.label}</div>
        <div className="text-billboard-inkSoft text-xs mt-0.5">{metric.description}</div>
      </div>
      <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${methodBadge[metric.reportingMethod]}`}>
        {metric.reportingMethod}
      </span>
    </div>
  );
}

// ─── Coming soon placeholder content ─────────────────────────────────────────

function ComingSoonDetail({ ch }: { ch: ChannelDefinition }) {
  return (
    <div className="space-y-10">
      {/* Notice banner */}
      <div className="border-[3px] border-billboard-yellow bg-billboard-yellow/10 rounded p-5 flex gap-4 items-start">
        <span className="text-2xl shrink-0">🚧</span>
        <div>
          <div className="font-bold mb-1">This channel is in development</div>
          <p className="text-sm text-billboard-inkSoft">
            We're building out the {ch.name} channel. It isn't open for bookings or publisher onboarding yet.{" "}
            If you want to supply this channel,{" "}
            <a href={whatsappLink(`I want to join the ${ch.name} publisher waitlist`)} target="_blank" rel="noopener noreferrer" className="underline hover:text-billboard-ink">
              join the waitlist
            </a>{" "}
            and we'll contact you when onboarding opens. Advertisers can{" "}
            <Link to="/browse" className="underline hover:text-billboard-ink">
              browse our live inventory
            </Link>{" "}
            or{" "}
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="underline hover:text-billboard-ink">
              WhatsApp us
            </a>{" "}
            to discuss your campaign.
          </p>
        </div>
      </div>

      {/* Development-channel waitlist callout — these channels are intentionally not part of public onboarding yet. */}}
      <div className="border-[3px] border-billboard-ink bg-billboard-green/10 rounded p-5 flex gap-4 items-start">
        <span className="text-2xl shrink-0">🌱</span>
        <div>
          <div className="font-bold mb-1">Be one of the first {ch.name} publishers on ChatSched</div>
          <p className="text-sm text-billboard-inkSoft mb-3">
            Early publishers on a new channel get first pick of the businesses browsing it once it launches — no competition yet, no queue.
          </p>
          <a
            href={whatsappLink(`I want to be one of the first ${ch.name} publishers on ChatSched`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition"
          >
            Get early access →
          </a>
        </div>
      </div>

      {/* Use cases */}
      <section>
        <h2 className="font-display text-xl mb-4">When to use this channel</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {ch.exampleUseCases.map((uc, i) => (
            <li key={i} className="border-[2px] border-billboard-ink/20 rounded p-4 text-sm text-billboard-inkSoft">
              "{uc}"
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── Live / enabled channel content ──────────────────────────────────────────

function LiveChannelDetail({ ch }: { ch: ChannelDefinition }) {
  return (
    <div className="space-y-10">
      {/* Use cases */}
      <section>
        <h2 className="font-display text-xl mb-4">Example campaigns</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {ch.exampleUseCases.map((uc, i) => (
            <li key={i} className="border-[2px] border-billboard-ink/20 rounded p-4 text-sm text-billboard-inkSoft">
              "{uc}"
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── Shared detail sections (always shown) ────────────────────────────────────

function SharedSections({ ch }: { ch: ChannelDefinition }) {
  const isRequestFlow = ch.bookingFlow === "request";

  return (
    <>
      {/* Advertising methods — only channels with a request-based booking flow define these */}
      {ch.advertisingMethods && ch.advertisingMethods.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-1">Advertising methods</h2>
          <p className="text-billboard-inkSoft text-sm mb-4">Pick one of these when you submit a request — each creator's page shows exactly this list.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {ch.advertisingMethods.map((m) => (
              <div key={m.id} className="border-[3px] border-billboard-ink rounded p-4">
                <div className="font-bold text-sm mb-1">{m.label}</div>
                <div className="text-billboard-inkSoft text-sm">{m.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Benefits + requirements side by side */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h3 className="font-display text-lg mb-4">{isRequestFlow ? "Benefits for Businesses" : "Why advertise here"}</h3>
          <ul className="space-y-2">
            {ch.advertiserBenefits.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-[3px] border-billboard-ink/30 rounded p-5 bg-billboard-paperDim">
          <h3 className="font-display text-lg mb-4">{isRequestFlow ? "Information for Creators to Apply" : "Publisher requirements"}</h3>
          <ul className="space-y-2">
            {ch.publisherRequirements.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-billboard-inkSoft">
                <span className="mt-0.5 shrink-0">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {isRequestFlow && (
            <p className="text-sm text-billboard-inkSoft mt-3 pt-3 border-t border-billboard-ink/10">
              Every application is reviewed by hand, typically within a few days. Once approved, you'll respond to
              business requests from your own dashboard — see payment terms on the application form.
            </p>
          )}
        </div>
      </section>

      {/* Booking details */}
      <section>
        <h2 className="font-display text-xl mb-4">Booking details</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: "Min. lead time", value: `${ch.availability.minLeadTimeDays} day${ch.availability.minLeadTimeDays !== 1 ? "s" : ""}` },
            { label: "Min. campaign", value: `${ch.availability.minCampaignDays} day${ch.availability.minCampaignDays !== 1 ? "s" : ""}` },
            { label: "Recurring bookings", value: ch.availability.supportsRecurring ? "Supported" : "Single-run only" },
          ].map(({ label, value }) => (
            <div key={label} className="border-[2px] border-billboard-ink/20 rounded p-4">
              <div className="font-mono text-xs text-billboard-inkSoft uppercase tracking-wide mb-1">{label}</div>
              <div className="font-bold">{value}</div>
            </div>
          ))}
        </div>
        {ch.availability.schedulingNotes && (
          <p className="mt-4 text-sm text-billboard-inkSoft border-l-4 border-billboard-ink/20 pl-4">
            {ch.availability.schedulingNotes}
          </p>
        )}
      </section>

      {/* Analytics */}
      <section>
        <h2 className="font-display text-xl mb-1">What you can measure</h2>
        <p className="text-billboard-inkSoft text-sm mb-4">
          Metrics available for campaigns on this channel.
          <span className="ml-2 inline-flex gap-2 text-xs">
            <span className="bg-billboard-green/15 text-billboard-greenDeep px-1.5 py-0.5 rounded font-mono">automated</span>
            <span className="bg-billboard-yellow/30 text-billboard-ink px-1.5 py-0.5 rounded font-mono">manual</span>
            <span className="bg-billboard-inkSoft/15 text-billboard-inkSoft px-1.5 py-0.5 rounded font-mono">estimated</span>
          </span>
        </p>
        <div className="border-[3px] border-billboard-ink rounded divide-y divide-billboard-ink/10 overflow-hidden">
          {ch.analyticsMetrics.map((m) => (
            <MetricRow key={m.key} metric={m} />
          ))}
        </div>
      </section>

      {/* Review dimensions */}
      <section>
        <h2 className="font-display text-xl mb-4">How campaigns are rated</h2>
        <div className="flex flex-wrap gap-2">
          {ch.reviewDimensions.map((d) => (
            <div
              key={d.key}
              className="border-2 border-billboard-ink/20 rounded px-3 py-2 text-sm"
              title={d.description}
            >
              {d.label}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();

  // Unknown slug — same class of gap the shared 404 route (NotFound.tsx)
  // had: no noindex for a page that genuinely doesn't exist, and the
  // recovery link was missing the site's usual hover state.
  const module = getChannelBySlug(slug ?? "");
  if (!module) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <Seo title="Channel not found — ChatSched" noindex />
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">
          Not found
        </span>
        <h1 className="text-3xl mb-3">Channel not found</h1>
        <p className="text-billboard-inkSoft mb-7">
          That channel doesn't exist in this marketplace.
        </p>
        <Link to="/channels" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">
          ← Back to all channels
        </Link>
      </div>
    );
  }

  const { definition: ch } = module;
  const enabled = isSlugEnabled(ch.slug);

  // If the module ships its own BrowsePage, hand off to it
  if (module.BrowsePage && enabled) {
    return <module.BrowsePage />;
  }

  const categoryLabels: Record<string, string> = {
    digital:      "Digital & Social",
    direct:       "Direct & Messaging",
    broadcast:    "Broadcast",
    outdoor:      "Out-of-Home",
    print:        "Print",
    programmatic: "Programmatic",
    sports:       "Sports Teams & Leagues",
    events:       "Events & Tournaments",
    community:    "Community Groups",
    transport:    "Minibus Taxi & Transport",
    "informal-retail": "Spaza Shops & Township Traders",
    associations: "Associations & Business Networks",
    "food-and-beverage": "Restaurants & Cafés",
  };

  return (
    <>
      <Seo
        title={`${ch.name} — ChatSched`}
        description={ch.tagline}
      />

      <div className="max-w-4xl mx-auto px-5 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-billboard-inkSoft mb-8 font-mono">
          <Link to="/channels" className="hover:text-billboard-ink transition-colors">Channels</Link>
          <span>/</span>
          <span>{ch.name}</span>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-start gap-4 mb-4">
            <ChannelIcon slug={ch.slug} size="lg" />
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink/40 text-billboard-inkSoft px-2 py-0.5 rounded">
                  {categoryLabels[ch.category]}
                </span>
                {!enabled && (
                  <span className="border border-billboard-inkSoft/40 text-billboard-inkSoft font-mono text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Coming soon
                  </span>
                )}
              </div>
              <h1 className="text-4xl">{ch.name}</h1>
            </div>
          </div>
          <p className="text-billboard-inkSoft text-lg max-w-2xl leading-relaxed">
            {ch.description}
          </p>
          {enabled && ch.isLive && <LiveInventoryBanner channelSlug={ch.slug} />}
        </div>

        {/* Channel-state-dependent content */}
        <div className="space-y-10">
          {enabled && !ch.isLive ? (
            <LiveChannelDetail ch={ch} />
          ) : !enabled ? (
            <ComingSoonDetail ch={ch} />
          ) : null}

          {/* 12-Channel Audit fix D1 — real, interactive cost estimate,
              shown regardless of live/coming-soon state (a "coming soon"
              channel still benefits from a business seeing what it will
              cost once it launches — see D6's own comment on why this
              matters for cold-starting the dormant channels). */}
          <CampaignCostCalculator ch={ch} />

          {/* Always-shown sections */}
          <SharedSections ch={ch} />
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 pt-8 border-t-[3px] border-billboard-ink/20">
          {enabled && ch.isLive && ch.bookingFlow === "directory" ? (
            <div className="flex flex-wrap gap-3">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
              >
                Browse {ch.name.toLowerCase()} publishers →
              </Link>
              <Link
                to="/audience-finder"
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-paperDim transition"
              >
                Audience Finder
              </Link>
            </div>
          ) : enabled && ch.isLive && ch.bookingFlow === "request" ? (
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/browse?channel=${ch.slug}`}
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
              >
                Browse {ch.name.toLowerCase()} creators →
              </Link>
              <Link
                to={`/register?role=publisher&channel=${ch.slug}`}
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-paperDim transition"
              >
                Apply as a creator →
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href={whatsappLink(`I want to join the ${ch.name} publisher waitlist`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition"
              >
                Join the waitlist →
              </a>
              <a
                href={whatsappLink(`I'm interested in the ${ch.name} channel`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-paperDim transition"
              >
                Ask about advertising here
              </a>
              <Link
                to="/channels"
                className="text-sm text-billboard-inkSoft hover:text-billboard-ink transition-colors font-semibold"
              >
                ← All channels
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
