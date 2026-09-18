/**
 * The ChatSched Media Network
 *
 * A brand/positioning page — deliberately distinct from the functional
 * /channels directory (ChannelHub.tsx). Where /channels is a working
 * directory advertisers browse and book from, /network tells the bigger
 * story: ChatSched as the single point of access to every kind of local
 * media supply.
 *
 * Still reads live from the channel registry (getChannelsByCategory) so
 * the category list can never overstate what's actually available —
 * a channel only appears here once it's a real, registered channel
 * module. Newsletters, for example, deliberately doesn't appear yet:
 * there's no newsletter channel module to read from.
 */

import { Link } from "react-router-dom";
import { getChannelsByCategory } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";

export default function MediaNetwork() {
  const groups = getChannelsByCategory();

  return (
    <div>
      <Seo
        title="The ChatSched Media Network"
        description="One point of access to every kind of local media supply — social publishers, influencers, podcasts, websites, radio, and local communities across South Africa."
      />

      {/* HERO */}
      <section className="bg-billboard-ink text-white border-b-[3px] border-billboard-ink py-16 md:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-billboard-yellow" /> The Media Network
          </span>
          <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mb-6">
            The ChatSched Media Network
          </h1>
          <p className="text-billboard-paperDim text-lg md:text-xl max-w-[52ch] mx-auto">
            Every audience your customers already trust, in one place. One request, one payment, one point of
            contact — instead of a different relationship for every publisher, creator, and channel.
          </p>
        </div>
      </section>

      {/* WHAT BUSINESSES CAN ACCESS */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl mb-3 text-center">Businesses can access</h2>
          <p className="text-billboard-inkSoft text-center max-w-xl mx-auto mb-12">
            Real supply, reviewed by hand before it's ever listed — not a self-serve ad exchange, not a black-box
            algorithm.
          </p>

          <div className="space-y-10">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-billboard-inkSoft mb-4 pb-2 border-b-2 border-billboard-ink/10">
                  {group.label}
                </h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {group.channels.map((m) => {
                    const enabled = isChannelEnabled(m.definition.slug);
                    return (
                      <Link
                        key={m.definition.slug}
                        to={`/channels/${m.definition.slug}`}
                        className={`relative block border-[3px] rounded p-4 transition ${
                          enabled
                            ? "border-billboard-ink bg-billboard-paper hover:-translate-y-0.5 hover:shadow-blockSm"
                            : "border-billboard-inkSoft/40 bg-billboard-paperDim opacity-75"
                        }`}
                      >
                        {!enabled && (
                          <span className="absolute top-3 right-3 font-mono text-[10px] font-semibold uppercase tracking-wide text-billboard-inkSoft bg-white/70 border border-billboard-inkSoft/40 rounded-full px-2 py-0.5">
                            Coming soon
                          </span>
                        )}
                        <div className="mb-2.5"><ChannelIcon slug={m.definition.slug} /></div>
                        <h4 className="font-bold text-sm mb-1">{m.definition.name}</h4>
                        <p className="text-xs text-billboard-inkSoft">{m.definition.tagline}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PULL QUOTE */}
      <section className="py-24 bg-billboard-yellow border-y-[3px] border-billboard-ink text-center">
        <div className="max-w-2xl mx-auto px-5">
          <p className="font-display text-3xl md:text-5xl leading-tight">
            Now you control the supply aggregation.
          </p>
          <p className="text-billboard-inkSoft mt-5 max-w-[48ch] mx-auto">
            Instead of separately sourcing, vetting, and paying every publisher, creator, and channel yourself,
            ChatSched aggregates the supply — you just tell us the goal.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-b-[3px] border-billboard-ink text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl mb-6">Ready to tap into the network?</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/build-my-campaign"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-6 py-3.5 rounded hover:-translate-y-0.5 transition shadow-block"
            >
              Build My Campaign →
            </Link>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3.5 rounded hover:bg-billboard-paperDim transition"
            >
              Browse the Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
