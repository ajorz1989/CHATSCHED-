import { useMemo, useState } from "react";
import Seo from "../components/Seo";
import Button from "../components/Button";
import { VisualAvatar, VisualCover, ChatSchedMark } from "../components/VisualIdentitySystem";
import { VisualSystemProvider, useVisualSystem } from "../contexts/VisualSystemContext";
import { VISUAL_SYSTEMS, type VisualSystem } from "../lib/publisherVisual";
import { makePublisher } from "../test/fixtures";
import type { Publisher } from "../lib/types";

/**
 * Visual Identity Studio — admin-only.
 *
 * Ported from a separate concept workspace (three branded directions for
 * how a publisher's avatar + cover should look: Yellow Plate, Channel
 * Crest, Publisher Storefront), then merged with a second, more complete
 * implementation of the same three directions from a later concept
 * workspace — see VisualIdentitySystem.tsx, publisherVisual.ts, and
 * VisualSystemContext.tsx. That merge is what added real channel icons,
 * real verified/featured/level badge placement per system, and the
 * "current" system as a fourth, directly-selectable tab alongside the
 * three new directions, so today's baseline sits in the same switcher
 * instead of a separate, differently-built preview above it.
 *
 * Still preview and documentation only, exactly as before the merge: it
 * renders its own local mock publishers (built with the same makePublisher
 * test fixture the test suite uses, so they always match the real
 * Publisher shape) and its own locally-scoped VisualSystemProvider. It
 * does not import or modify PublisherCard.tsx, PublisherProfile.tsx,
 * Browse.tsx, or anything else that renders a real publisher today, and
 * VisualSystemProvider is deliberately not mounted anywhere in App.tsx —
 * see that file's own comment. Nothing here changes what a business or
 * publisher sees anywhere else in the product; adopting one of these
 * systems for real, including wiring a live "apply to Browse & profiles"
 * toggle into the actual shared components, is a separate, deliberately
 * out-of-scope follow-up.
 *
 * Admin-only because it's an internal design-review tool, not a
 * marketplace feature — same posture as AdminCareers/AdminTools having
 * their own standalone route rather than living inside Admin.tsx's tab
 * bar. Gated the same way: <RequireAuth role="admin"> in App.tsx.
 */

const CONCEPTS: VisualSystem[] = ["current", "plate", "crest", "storefront"];

// Full Publisher-shaped mock samples — built with the test suite's own
// fixture helper rather than a hand-rolled object literal, so this page
// can never silently drift out of sync with the real Publisher type the
// way a second, hand-maintained mock shape eventually would. Badge states
// (verified/featured/level) are deliberately varied across the three so
// the merged CoverBadges rendering has something real to show per system.
const SAMPLE_PUBLISHERS: Publisher[] = [
  makePublisher({
    id: "sample-spaza",
    name: "Orlando Spaza Grid",
    city: "Soweto",
    province: "Gauteng",
    category: "Informal Retail",
    channel_slug: "informal-retail",
    initials: "OS",
    swatch: "from-orange-500 to-amber-600",
    level: "verified",
    verified: true,
  }),
  makePublisher({
    id: "sample-touchline",
    name: "Highveld Touchline",
    city: "Benoni",
    province: "Gauteng",
    category: "Sports",
    channel_slug: "sports",
    initials: "HT",
    swatch: "from-billboard-green to-billboard-greenDeep",
    level: "premium",
    featured: true,
    featured_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  makePublisher({
    id: "sample-taxi",
    name: "Cape Taxi Media",
    city: "Khayelitsha",
    province: "Western Cape",
    category: "Transport",
    channel_slug: "transport",
    initials: "CT",
    swatch: "from-yellow-500 to-billboard-yellow",
    level: "rising",
  }),
];

const CONCEPT_META: Record<VisualSystem, { name: string; blurb: string }> = {
  current: {
    name: "Current",
    blurb: "What ships today — initials on a yellow circle, over the assigned gradient swatch.",
  },
  plate: {
    name: "Yellow Plate",
    blurb: "Issued enamel plate, name on the billboard, ChatSched as the stamp.",
  },
  crest: {
    name: "Channel Crest",
    blurb: "Thirteen channels, thirteen fills. Colour is how you scan Browse.",
  },
  storefront: {
    name: "Publisher Storefront",
    blurb: "Yellow lintel, window pane, hanging sign. ChatSched is the street.",
  },
};

const CONCEPT_COPY: Record<Exclude<VisualSystem, "current">, { n: string; title: string; body: string; coexist: string; mood: string }> = {
  plate: {
    n: "01",
    title: "Yellow Plate",
    body: "Every publisher is issued a ChatSched plate — rounded-square, yellow enamel, initials in Archivo Black, the billboard mark riveted to the corner. The cover is an ink billboard: the publisher's name is the poster, \u201cListed on ChatSched\u201d is the stamp at top-left, city and channel sit on the kick panel.",
    coexist: "ChatSched is the issuer (stamp + rivet). The publisher is the headline on the board. Neither name is decorative; they have different jobs.",
    mood: "/visual-identity/plate-mood.jpg",
  },
  crest: {
    n: "02",
    title: "Channel Crest",
    body: "Informal retail is terracotta, sports is deep green, transport is billboard yellow, radio is forest. The avatar is a circular crest with the channel mark watermarked behind the initials. The banner is that same fill, with ChatSched in the corner and the publisher's name set as a masthead. Browse becomes scannable by channel colour before you read a single word.",
    coexist: "ChatSched is the small running mark. The publisher's name is the masthead. The channel is the colour of the whole surface.",
    mood: "/visual-identity/crest-mood.jpg",
  },
  storefront: {
    n: "03",
    title: "Publisher Storefront",
    body: "Treat every profile like a shop on a ChatSched street. A yellow lintel carries the ChatSched wordmark. A window pane is the cover — their gradient (or, later, their photograph) lives in the glass. A hanging-sign avatar carries the initials. The publisher's name is the fascia board.",
    coexist: "ChatSched is the architecture (lintel, ring, pane). The publisher is the tenant: name on the fascia, art in the glass.",
    mood: "/visual-identity/storefront-mood.jpg",
  },
};

const SCENARIO_ROWS = [
  {
    k: "What it is",
    a: "Publishers upload any photo and any cover, free crop.",
    b: "ChatSched generates every avatar and every banner. No uploads.",
    c: "ChatSched owns the template. Publishers may place a logo or photo inside reserved slots.",
  },
  {
    k: "Pros",
    a: "Feels like their brand. Fast to ship.",
    b: "Perfect grid cohesion. Zero moderation.",
    c: "Cohesion of B with the identity of A. Works on day one with initials.",
  },
  {
    k: "Cons",
    a: "Inconsistent crops, selfies, unreadable type. Trust looks cheap.",
    b: "Publishers feel stamped, not listed. Does not scale as art.",
    c: "Needs a short template spec. Slightly more product surface than A.",
  },
  {
    k: "Fit for ChatSched",
    a: "Poor. The promise is managed advertising — not an open social profile.",
    b: "Strong for chrome, weak where the publisher is the product.",
    c: "Best fit. ChatSched is the billboard owner. The publisher is the poster.",
  },
];

function AdminVisualIdentityInner() {
  const [preview, setPreview] = useState<VisualSystem>("plate");
  const { system, setSystem } = useVisualSystem();
  const featured = SAMPLE_PUBLISHERS[0];
  const meta = useMemo(() => (preview === "current" ? null : CONCEPT_COPY[preview]), [preview]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 min-w-0">
      <Seo title="Visual Identity Studio · Admin · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Admin
      </span>
      <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-greenDeep mb-2">
        Visual identity studio
      </p>
      <h1 className="text-3xl sm:text-4xl md:text-5xl max-w-3xl mb-4">How a publisher should look on ChatSched.</h1>
      <p className="text-billboard-inkSoft max-w-2xl mb-10">
        A design-review sandbox: three branded directions for the avatar + cover system, previewed against sample
        publishers, alongside today's baseline. This page previews only — it does not read or write real publisher
        data, and nothing here changes what renders on Browse or a live profile today. Adopting a direction is a
        separate follow-up.
      </p>

      {/* 01 — Audit */}
      <section className="mb-16">
        <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-greenDeep mb-2">01 · Audit</p>
        <h2 className="text-2xl mb-3">What's live today</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-8">
          Identity today is initials on a yellow circle, over whatever gradient swatch the publisher was assigned. It
          works, but every publisher reads the same way at a glance.
        </p>
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold mb-3">Browse card — 48×48 avatar on a 112px banner</h3>
            <div className="border-[3px] border-billboard-ink rounded bg-white overflow-hidden max-w-sm">
              <VisualCover publisher={featured} size="card" system="current" />
              <div className="pt-8 pb-4 px-4">
                <h3 className="font-bold text-base leading-snug">{featured.name}</h3>
                <p className="text-xs text-billboard-inkSoft mt-0.5">{featured.city}, {featured.province}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-billboard-inkSoft">
              <li><strong className="text-billboard-ink">48px circle</strong> — the only signal in a 3-column grid is two letters on the same yellow fill every publisher gets.</li>
              <li><strong className="text-billboard-ink">The gradient banner</strong> is real (Publisher.swatch), but it's unbranded — nothing on it says ChatSched or the publisher's name.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">Profile hero</h3>
            <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden bg-white">
              <VisualCover publisher={featured} size="profile" system="current" />
              <div className="px-5 pt-14 pb-6">
                <p className="font-display text-2xl">{featured.name}</p>
                <p className="text-sm text-billboard-inkSoft">{featured.city} · {featured.category}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-billboard-inkSoft">
              <li><strong className="text-billboard-ink">Same gradient, larger.</strong> The 96px avatar overlaps the banner, but carries no more information than the card version.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 02 — Strategy */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-12 sm:py-16 -mx-4 sm:-mx-5 px-4 sm:px-5 mb-16">
        <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-greenDeep mb-2">02 · Strategy</p>
        <h2 className="text-2xl mb-6 max-w-2xl">Custom avatars vs. brand graphics</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
            <h3 className="font-display text-lg mb-3">Should avatars be a ChatSched system?</h3>
            <p className="text-sm text-billboard-inkSoft">
              Yes — as a system, not a wall of identical yellow circles. Mandate the frame (plate, crest, or hanging
              sign). Allow a logo or photo inside that frame once a publisher has one. Initials remain the honest
              fallback.
            </p>
          </div>
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
            <h3 className="font-display text-lg mb-3">Should banners be proprietary ChatSched art?</h3>
            <p className="text-sm text-billboard-inkSoft">
              Yes for the structure. No for a single locked illustration reused thousands of times. The banner
              carries both names: ChatSched as the issuer, the publisher as the headline.
            </p>
          </div>
        </div>
      </section>

      {/* 03 — Four directions (current + three new) */}
      <section className="mb-16" id="concepts">
        <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-greenDeep mb-2">03 · Four directions</p>
        <h2 className="text-2xl mb-3">How ChatSched and the publisher share the same surface</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-6">
          Each direction is rendered against the same three sample publishers — Orlando Spaza Grid, Highveld
          Touchline, Cape Taxi Media — not a static mockup, including today's baseline for direct comparison.
        </p>
        <div className="flex flex-wrap gap-2 mb-8">
          {CONCEPTS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreview(id)}
              className={`font-mono text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-md border-[3px] border-billboard-ink transition min-h-11 ${
                preview === id ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"
              }`}
            >
              {CONCEPT_META[id].name}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 sm:gap-8 mb-10">
          <div>
            {meta ? (
              <>
                <img
                  src={meta.mood}
                  alt=""
                  className="w-full aspect-video object-cover border-[3px] border-billboard-ink rounded-lg mb-4"
                />
                <p className="font-mono text-2xs uppercase tracking-wider text-billboard-inkSoft mb-1">Concept {meta.n}</p>
                <h3 className="font-display text-2xl mb-2">{meta.title}</h3>
                <p className="text-billboard-inkSoft mb-4">{meta.body}</p>
                <p className="text-sm border-l-[3px] border-billboard-yellow pl-3 text-billboard-inkSoft">{meta.coexist}</p>
              </>
            ) : (
              <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim h-full">
                <p className="font-mono text-2xs uppercase tracking-wider text-billboard-inkSoft mb-1">Baseline</p>
                <h3 className="font-display text-2xl mb-2">Current</h3>
                <p className="text-billboard-inkSoft">
                  {VISUAL_SYSTEMS.current.headline} No ChatSched mark, no publisher name on the art, no badge system
                  beyond what already overlays the card today. This is the direction every other tab is measured against.
                </p>
              </div>
            )}
          </div>
          <div>
            <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden bg-white mb-4">
              <VisualCover publisher={featured} size="profile" system={preview} />
              <div className="px-5 pt-14 pb-5">
                <p className="text-xs font-mono uppercase text-billboard-inkSoft mb-1">Profile hero · {featured.name}</p>
                <p className="text-sm text-billboard-inkSoft">
                  {preview === "current"
                    ? "Avatar overlaps the banner, but the banner carries no name, mark, or badge placement rules of its own."
                    : "Avatar overlaps the board by design. Name lives on the art, so the composition still reads if the avatar is cropped off in a share card."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <h4 className="font-bold mb-4">Browse grid in this system</h4>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 mb-8">
          {SAMPLE_PUBLISHERS.map((p) => (
            <div key={`${preview}-${p.id}`} className="border-[3px] border-billboard-ink rounded bg-white overflow-hidden">
              <VisualCover publisher={p} size="card" system={preview} />
              <div className="pt-8 pb-4 px-4">
                <h3 className="font-bold text-base leading-snug">{p.name}</h3>
                <p className="text-xs text-billboard-inkSoft mt-0.5">{p.city}, {p.province}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <VisualAvatar publisher={featured} size="lg" system={preview} />
            <VisualAvatar publisher={featured} size="md" system={preview} />
            <VisualAvatar publisher={featured} size="sm" system={preview} />
          </div>
          <p className="text-xs text-billboard-inkSoft max-w-sm">
            Same mark at profile / card / compact. If it fails at 36px it is not a system.
          </p>
        </div>

        {preview !== "current" && (
          <Button
            type="button"
            variant={system === preview ? "dark" : "primary"}
            onClick={() => setSystem(system === preview ? "current" : preview)}
          >
            {system === preview ? "Previewing this tab's system ✓ — click to reset" : `Preview ${VISUAL_SYSTEMS[preview].name} across this page`}
          </Button>
        )}
        {system !== "current" && (
          <p className="text-xs text-billboard-inkSoft mt-3 max-w-md">
            This toggle only affects this browser and only the components on this page — it's stored in
            localStorage, not the database, and nothing outside this studio reads it.
          </p>
        )}
      </section>

      {/* 04 — Outcomes */}
      <section className="bg-billboard-ink text-billboard-paper -mx-4 sm:-mx-5 px-4 sm:px-5 py-12 sm:py-16 mb-16">
        <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-yellow mb-2">04 · Outcomes</p>
        <h2 className="text-2xl mb-6">Open, locked, or hybrid</h2>
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-sm border-[3px] border-billboard-paper/20 min-w-[720px]">
            <thead>
              <tr className="font-mono text-2xs uppercase tracking-wider text-billboard-yellow">
                <th className="text-left p-4 border-b border-billboard-paper/20"> </th>
                <th className="text-left p-4 border-b border-billboard-paper/20">A · Open upload</th>
                <th className="text-left p-4 border-b border-billboard-paper/20">B · Fully locked</th>
                <th className="text-left p-4 border-b border-billboard-paper/20 bg-billboard-yellow/10">C · Hybrid templates</th>
              </tr>
            </thead>
            <tbody className="text-billboard-paper/80">
              {SCENARIO_ROWS.map((row) => (
                <tr key={row.k} className="border-b border-billboard-paper/10">
                  <td className="p-4 font-semibold text-billboard-paper align-top whitespace-nowrap">{row.k}</td>
                  <td className="p-4 align-top">{row.a}</td>
                  <td className="p-4 align-top">{row.b}</td>
                  <td className="p-4 align-top bg-billboard-yellow/10 text-billboard-paper">{row.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 05 — Recommendation */}
      <section>
        <p className="font-mono text-2xs font-semibold uppercase tracking-widest text-billboard-greenDeep mb-2">05 · Recommendation</p>
        <h2 className="text-2xl mb-5 max-w-2xl">Ship Yellow Plate as the default, once adopted.</h2>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <ol className="space-y-4 text-sm text-billboard-inkSoft list-decimal pl-5">
            <li><strong className="text-billboard-ink">Adopt Scenario C.</strong> ChatSched authors the plate, the masthead type, and the stamp. Publishers may later drop a logo into the plate.</li>
            <li><strong className="text-billboard-ink">Default the look to Yellow Plate.</strong> It's uniquely ChatSched and it solves the unbranded-banner problem in one move.</li>
          </ol>
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim">
            <p className="font-mono text-2xs font-semibold uppercase tracking-widest mb-2">Current status</p>
            <h3 className="font-display text-xl mb-3">Preview-only, by design</h3>
            <p className="text-sm text-billboard-inkSoft mb-4">
              This studio doesn't touch PublisherCard, PublisherProfile, Browse, or any stored publisher data — the
              live product is unchanged. The toggle above only affects your own browser, only on this page. Applying
              a direction to Browse and real profiles for everyone is a separate implementation phase once one is
              chosen.
            </p>
            <Button to="/admin" variant="outline">Back to Admin</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-billboard-inkSoft">
          <ChatSchedMark className="w-5 h-4" />
          <span>The plate, the stamp, and the name on the board — ChatSched as issuer, the publisher as the headline.</span>
        </div>
      </section>
    </div>
  );
}

export default function AdminVisualIdentity() {
  return (
    <VisualSystemProvider>
      <AdminVisualIdentityInner />
    </VisualSystemProvider>
  );
}
