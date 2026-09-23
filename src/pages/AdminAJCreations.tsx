import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Layers3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import PublisherApply from "./PublisherApply";
import { getAllChannels, getEnabledChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";

const ALL_CHANNELS = getAllChannels();
const LIVE_CHANNELS = new Set(getEnabledChannels().map((c) => c.definition.slug));

export default function AdminAJCreations() {
  const [selected, setSelected] = useState<ChannelSlug>("social-media");
  const [openForm, setOpenForm] = useState<ChannelSlug | null>("social-media");
  const [completedChannels, setCompletedChannels] = useState<Set<ChannelSlug>>(new Set());

  const selectedModule = useMemo(
    () => ALL_CHANNELS.find((channel) => channel.definition.slug === selected) ?? ALL_CHANNELS[0],
    [selected]
  );

  function chooseChannel(slug: ChannelSlug) {
    setSelected(slug);
    setOpenForm(slug);
  }

  if (!selectedModule) {
    return <div className="rounded-xl border border-billboard-red/30 bg-billboard-ink p-8 text-billboard-red">No channel definitions are available.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
        <div className="p-5 md:p-7 border-b border-white/10">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider font-bold text-billboard-yellow border border-billboard-yellow/30 bg-billboard-yellow/10 rounded-full px-2.5 py-1 mb-3">
                <Sparkles size={12} /> Super Tool
              </div>
              <h1 className="font-display text-3xl md:text-4xl">AJ: Creations</h1>
              <p className="text-sm md:text-base text-white/55 mt-2 leading-relaxed">
                Create verified publisher inventory from inside the admin workspace. This uses the exact publisher onboarding questionnaire and channel-specific metadata model already used by public creator signup, but admin-created listings skip the public review queue and can go live immediately.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="font-display text-2xl">{ALL_CHANNELS.length}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">Channel types</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="font-display text-2xl">{completedChannels.size}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">Published now</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-7 bg-black/10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Step 1</p>
              <h2 className="font-display text-xl">Choose the channel inventory to create</h2>
            </div>
            <span className="font-mono text-[10px] uppercase text-white/35">{ALL_CHANNELS.length} available to admins</span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {ALL_CHANNELS.map((channel) => {
              const active = selected === channel.definition.slug;
              const publicLive = LIVE_CHANNELS.has(channel.definition.slug);
              const completed = completedChannels.has(channel.definition.slug);
              return (
                <button
                  key={channel.definition.slug}
                  type="button"
                  onClick={() => chooseChannel(channel.definition.slug)}
                  className={
                    "text-left rounded-lg border px-4 py-3 transition " +
                    (active
                      ? "border-billboard-yellow bg-billboard-yellow text-billboard-ink shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.05]")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base" aria-hidden="true">{channel.definition.emoji}</span>
                      <span className="font-bold text-sm truncate">{channel.definition.name}</span>
                    </div>
                    <span className={
                      "w-2 h-2 rounded-full shrink-0 mt-1.5 " +
                      (publicLive ? "bg-billboard-green" : active ? "bg-billboard-ink" : "bg-white/20")
                    } aria-label={publicLive ? "Public channel enabled" : "Public channel not enabled by feature flag"} />
                  </div>
                  <p className={`text-[10px] mt-1.5 line-clamp-2 ${active ? "text-billboard-inkSoft" : "text-white/40"}`}>
                    {channel.definition.tagline}
                  </p>
                  <div className={`font-mono text-[9px] uppercase tracking-wider mt-2 ${active ? "text-billboard-inkSoft" : "text-white/30"}`}>
                    {completed ? "Published this session · live listing created" : publicLive ? "Public channel enabled" : "Admin creation available · public launch flag off"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-billboard-yellow/30 bg-billboard-ink text-white overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenForm((current) => current === selected ? null : selected)}
          aria-expanded={openForm === selected}
          className="w-full p-5 md:p-6 flex items-center justify-between gap-4 text-left hover:bg-white/[0.03] transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex w-10 h-10 rounded-lg bg-billboard-yellow text-billboard-ink items-center justify-center shrink-0">
              <Layers3 size={19} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow">Step 2</p>
              <h2 className="font-display text-xl truncate">Create {selectedModule.definition.name}</h2>
              <p className="text-xs text-white/40 mt-1">Same onboarding fields as /apply · immediate admin publishing</p>
            </div>
          </div>
          <ChevronDown className={`shrink-0 transition-transform ${openForm === selected ? "rotate-180" : ""}`} size={18} />
        </button>

        {openForm === selected && (
          <div className="border-t border-white/10 bg-white">
            <div className="p-3 md:p-5 bg-billboard-yellow/10 border-b border-billboard-yellow/30 flex flex-wrap items-center justify-between gap-3 text-billboard-ink">
              <div className="text-xs leading-relaxed max-w-3xl">
                <strong>Admin publish mode:</strong> the fields below are fully editable. Public eligibility and manual review are bypassed. The completed listing is saved as approved + verified and carries an <code>aj_creations</code> source marker for auditability.
              </div>
              <Link to={`/channels/${selectedModule.definition.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-billboard-ink rounded px-3 py-2 text-xs font-bold bg-white shrink-0">
                View channel <ExternalLink size={13} />
              </Link>
            </div>
            <PublisherApply
              key={selected}
              adminMode
              forcedChannel={selected}
              startStep="details"
              onAdminCreated={() => {
                setCompletedChannels((prev) => {
                  const next = new Set(prev);
                  next.add(selected);
                  return next;
                });
                setOpenForm(null);
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-billboard-ink text-white p-5 md:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-billboard-green shrink-0 mt-0.5" size={19} />
          <div>
            <h2 className="font-display text-lg">How AJ: Creations differs from normal creator signup</h2>
            <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
              Regular creators enter a review queue. AJ: Creations writes the same common profile fields and the selected channel's typed metadata, but the admin action sets the listing to approved and verified immediately. This is an admin control, not a public bypass.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
