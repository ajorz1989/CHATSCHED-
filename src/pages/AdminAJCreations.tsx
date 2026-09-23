import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Layers3, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import PublisherApply from "./PublisherApply";
import { getAllChannels, getEnabledChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";

const ALL_CHANNELS = getAllChannels();
const LIVE_CHANNELS = new Set(getEnabledChannels().map((c) => c.definition.slug));

// Listings created in this browser session. Kept in sessionStorage so the list
// survives switching admin tabs (which unmounts this page) but not closing the tab.
const SESSION_LOG_KEY = "aj_creations_session_log";

interface CreatedEntry {
  id: string;
  slug: ChannelSlug;
  at: string;
}

function loadSessionLog(): CreatedEntry[] {
  try {
    const raw = sessionStorage.getItem(SESSION_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CreatedEntry =>
        !!entry && typeof entry.id === "string" && typeof entry.slug === "string" && typeof entry.at === "string"
    );
  } catch {
    return [];
  }
}

function saveSessionLog(entries: CreatedEntry[]) {
  try {
    sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode / quota) — the on-screen list still works.
  }
}

function channelName(slug: ChannelSlug): string {
  return ALL_CHANNELS.find((c) => c.definition.slug === slug)?.definition.name ?? slug;
}

function channelEmoji(slug: ChannelSlug): string {
  return ALL_CHANNELS.find((c) => c.definition.slug === slug)?.definition.emoji ?? "";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminAJCreations() {
  const [selected, setSelected] = useState<ChannelSlug>("social-media");
  const [formOpen, setFormOpen] = useState(true);
  const [created, setCreated] = useState<CreatedEntry[]>(loadSessionLog);
  const [justCreated, setJustCreated] = useState<CreatedEntry | null>(null);
  const [scrollTick, setScrollTick] = useState(0);

  const pickerRef = useRef<HTMLElement | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  // True once the admin has typed into the current form, so switching channel
  // can warn before throwing their work away.
  const formTouchedRef = useRef(false);

  const selectedModule = useMemo(
    () => ALL_CHANNELS.find((channel) => channel.definition.slug === selected) ?? ALL_CHANNELS[0],
    [selected]
  );

  useEffect(() => {
    saveSessionLog(created);
  }, [created]);

  // After picking a channel the form is a long way down the page — bring it into view.
  useEffect(() => {
    if (scrollTick > 0) formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollTick]);

  useEffect(() => {
    if (justCreated) successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justCreated]);

  function chooseChannel(slug: ChannelSlug) {
    if (slug !== selected && formTouchedRef.current && !justCreated) {
      const ok = window.confirm(
        `Switch channel? What you've entered for ${channelName(selected)} hasn't been published and will be lost.`
      );
      if (!ok) return;
    }
    formTouchedRef.current = false;
    setJustCreated(null);
    setSelected(slug);
    setFormOpen(true);
    setScrollTick((n) => n + 1);
  }

  function handleCreated(publisherId: string, channelSlug: ChannelSlug) {
    const entry: CreatedEntry = { id: publisherId, slug: channelSlug, at: new Date().toISOString() };
    setCreated((prev) => [entry, ...prev].slice(0, 50));
    formTouchedRef.current = false;
    setJustCreated(entry);
    setFormOpen(true);
  }

  function createAnother() {
    formTouchedRef.current = false;
    setJustCreated(null);
    setScrollTick((n) => n + 1);
  }

  function backToPicker() {
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!selectedModule) {
    return <div className="rounded-xl border border-billboard-red/30 bg-billboard-ink p-8 text-billboard-red">No channel definitions are available.</div>;
  }

  return (
    <div className="space-y-6">
      <section ref={pickerRef} className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.16)] scroll-mt-4">
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
                <div className="font-display text-2xl">{created.length}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">Created this session</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-7 bg-black/10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Step 1</p>
              <h2 className="font-display text-xl">Choose the channel inventory to create</h2>
              <p className="text-xs text-white/40 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-billboard-green shrink-0" aria-hidden="true" />
                Green = channel is publicly enabled. Any channel can still be created here.
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase text-white/35 shrink-0">{ALL_CHANNELS.length} available to admins</span>
          </div>

          <div role="group" aria-label="Channel inventory" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {ALL_CHANNELS.map((channel) => {
              const active = selected === channel.definition.slug;
              const publicLive = LIVE_CHANNELS.has(channel.definition.slug);
              const createdCount = created.filter((entry) => entry.slug === channel.definition.slug).length;
              return (
                <button
                  key={channel.definition.slug}
                  type="button"
                  aria-pressed={active}
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
                    <span
                      className={
                        "w-2 h-2 rounded-full shrink-0 mt-1.5 " +
                        (publicLive ? "bg-billboard-green" : active ? "bg-billboard-ink" : "bg-white/20")
                      }
                      aria-hidden="true"
                    />
                  </div>
                  <p className={`text-[10px] mt-1.5 line-clamp-2 ${active ? "text-billboard-inkSoft" : "text-white/40"}`}>
                    {channel.definition.tagline}
                  </p>
                  <div className={`font-mono text-[9px] uppercase tracking-wider mt-2 ${active ? "text-billboard-inkSoft" : "text-white/30"}`}>
                    {createdCount > 0
                      ? `${createdCount} created this session`
                      : publicLive
                        ? "Public channel enabled"
                        : "Admin creation available · public launch flag off"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section ref={formSectionRef} className="rounded-xl border border-billboard-yellow/30 bg-billboard-ink text-white overflow-hidden scroll-mt-4">
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          aria-expanded={formOpen}
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
          <ChevronDown className={`shrink-0 transition-transform ${formOpen ? "rotate-180" : ""}`} size={18} />
        </button>

        {/*
          The form sits on a white surface, but this section is `text-white`. The onboarding
          questionnaire doesn't set its own text colour on headings, labels or inputs — it
          inherits — so without `text-billboard-ink` here every question and typed value
          rendered white-on-white.

          The body is hidden rather than unmounted when collapsed, so collapsing the panel
          never discards a half-filled form.
        */}
        <div
          hidden={!formOpen}
          onInput={() => { formTouchedRef.current = true; }}
          className="border-t border-white/10 bg-white text-billboard-ink"
        >
          {justCreated ? (
            <div ref={successRef} role="status" className="p-5 md:p-8">
              <div className="rounded-lg border-2 border-billboard-greenDeep bg-billboard-green/10 p-5 md:p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-billboard-greenDeep shrink-0 mt-0.5" size={22} />
                  <div className="min-w-0">
                    <h3 className="font-display text-xl">{channelName(justCreated.slug)} listing published</h3>
                    <p className="text-sm text-billboard-inkSoft mt-1.5 leading-relaxed">
                      Saved as approved and verified.{" "}
                      {LIVE_CHANNELS.has(justCreated.slug)
                        ? "It is live in the ChatSched directory."
                        : "This channel's public launch flag is still off, so the listing won't show on the public channel page until the channel is enabled."}
                    </p>
                    <div className="flex flex-wrap gap-2.5 mt-4">
                      <button
                        type="button"
                        onClick={createAnother}
                        className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition"
                      >
                        <Plus size={15} /> Create another {channelName(justCreated.slug)} listing
                      </button>
                      <button
                        type="button"
                        onClick={backToPicker}
                        className="border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:bg-billboard-paperDim transition"
                      >
                        Choose a different channel
                      </button>
                      <Link
                        to={`/channels/${justCreated.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border-2 border-billboard-ink rounded px-3 py-2.5 text-sm font-bold bg-white"
                      >
                        View channel <ExternalLink size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 md:p-5 bg-billboard-yellow/10 border-b border-billboard-yellow/30 flex flex-wrap items-center justify-between gap-3 text-billboard-ink">
                <div className="text-xs leading-relaxed max-w-3xl">
                  <strong>Admin publish mode:</strong> the fields below are fully editable. Public eligibility and manual review are bypassed. The completed listing is saved as approved + verified and carries an <code>aj_creations</code> source marker for auditability.
                </div>
                <Link
                  to={`/channels/${selectedModule.definition.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border-2 border-billboard-ink rounded px-3 py-2 text-xs font-bold bg-white shrink-0"
                >
                  View channel <ExternalLink size={13} />
                </Link>
              </div>
              <PublisherApply
                key={selected}
                adminMode
                forcedChannel={selected}
                startStep="details"
                onAdminCreated={handleCreated}
              />
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-billboard-ink text-white p-5 md:p-6">
        {created.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="font-display text-lg">Created this session</h2>
              <button
                type="button"
                onClick={() => setCreated([])}
                className="font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white transition"
              >
                Clear list
              </button>
            </div>
            <ul className="divide-y divide-white/10">
              {created.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span aria-hidden="true">{channelEmoji(entry.slug)}</span>
                    <span className="truncate">{channelName(entry.slug)}</span>
                    <span className="font-mono text-[10px] text-white/30 shrink-0">{entry.id.slice(0, 8)}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <time dateTime={entry.at} className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                      {formatTime(entry.at)}
                    </time>
                    <Link
                      to={`/channels/${entry.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-billboard-yellow text-xs font-bold hover:underline"
                    >
                      View
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-billboard-green shrink-0 mt-0.5" size={19} />
            <div>
              <h2 className="font-display text-lg">How AJ: Creations differs from normal creator signup</h2>
              <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                Regular creators enter a review queue. AJ: Creations writes the same profile fields and the selected channel's typed metadata, but the listing is set to approved and verified immediately. This is an admin control, not a public bypass.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
