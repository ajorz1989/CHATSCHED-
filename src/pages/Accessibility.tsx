import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";
import { supabase } from "../lib/supabase";

// ─── Static content ───────────────────────────────────────────────────────────

const IN_PLACE = [
  {
    title: "Keyboard operable",
    body: "Every interactive element — forms, FAQ accordions, filters, menus, modals, and booking flows — is built on standard HTML controls. Tab order is logical and focus indicators are always visible. Nothing requires a mouse.",
  },
  {
    title: "Respects reduced motion",
    body: "Animations and reveal effects check for prefers-reduced-motion and disable themselves for anyone who has that set at the OS or browser level. This applies to page transitions, hover effects, and loading spinners.",
  },
  {
    title: "Screen-reader labelled",
    body: "Interactive elements and status changes carry ARIA labels, roles, and live-region announcements where a visual cue alone (colour, icon) wouldn't be enough. Modals trap focus correctly and restore it on close.",
  },
  {
    title: "Meaningful alt text",
    body: "All images carry descriptive alt text. Decorative images use empty alt attributes so screen readers skip them. Publisher logos include the publisher name.",
  },
  {
    title: "Colour contrast",
    body: "Text and interactive elements meet WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text and UI components). The billboard design system was audited specifically for this.",
  },
  {
    title: "Multi-language interface",
    body: "The platform is available in English, Afrikaans, isiZulu, and isiXhosa. Language selection persists across sessions. All translated strings are reviewed for meaning, not just machine-translated.",
  },
  {
    title: "Responsive at every size",
    body: "Layouts reflow correctly from 320 px mobile up to wide desktop. No horizontal scrolling. Touch targets meet the 44 × 44 px minimum. The booking and campaign flows work fully on mobile.",
  },
  {
    title: "Forms with clear errors",
    body: "Validation errors are associated with their fields via aria-describedby, not just indicated by colour. Error messages appear inline next to the field that needs attention, not only at the top of the form.",
  },
  {
    title: "Subscription & payment flows",
    body: "The PayFast checkout integration and subscription upgrade gates are keyboard-navigable. Grace-period warnings and activation-fee modals are announced to assistive technology.",
  },
  {
    title: "Opportunity & campaign tools",
    body: "The opportunity feed, bulk-accept flow, campaign workspace, and counter-offer modals have all been audited for keyboard access and screen-reader clarity as part of recent platform phases.",
  },
];

const STILL_IMPROVING = [
  "No formal third-party WCAG 2.1 AA audit has been completed yet — this page describes deliberate design choices, not a certified compliance review.",
  "Some rich data tables (admin analytics, earnings dashboard) don't yet have full caption and summary markup.",
  "Complex drag-and-drop interactions in the campaign builder don't yet have keyboard-only alternatives.",
  "PDF exports (invoices, campaign briefs) are not yet screen-reader tagged.",
];

// ─── Live stats from Supabase ─────────────────────────────────────────────────

interface AccessibilityStats {
  publisherCount: number | null;
  bookingCount: number | null;
  languageCount: number;
}

async function fetchStats(): Promise<AccessibilityStats> {
  const [publishersRes, bookingsRes] = await Promise.all([
    supabase.from("publishers").select("id", { count: "exact", head: true }),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }),
  ]);

  return {
    publisherCount: publishersRes.count ?? null,
    bookingCount: bookingsRes.count ?? null,
    languageCount: 4, // English, Afrikaans, isiZulu, isiXhosa
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Accessibility() {
  const [stats, setStats] = useState<AccessibilityStats>({
    publisherCount: null,
    bookingCount: null,
    languageCount: 4,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => {
        // Silently fail — stats are decorative, not critical
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const statItems = [
    {
      label: "Publishers on the platform",
      value: statsLoading ? "…" : stats.publisherCount !== null ? stats.publisherCount.toLocaleString() : "—",
    },
    {
      label: "Booking requests processed",
      value: statsLoading ? "…" : stats.bookingCount !== null ? stats.bookingCount.toLocaleString() : "—",
    },
    {
      label: "Interface languages",
      value: stats.languageCount.toString(),
    },
  ];

  return (
    <div>
      <Seo
        title="Accessibility · ChatSched"
        description="What ChatSched does today to be usable with a keyboard, a screen reader, or reduced motion — and how to report something that isn't working."
      />

      {/* ── Hero ── */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">
            Accessibility
          </span>
          <h1 className="text-3xl md:text-4xl mb-5">Built to be usable, not just to look right.</h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl">
            This isn't a certification — it's a plain account of what's actually in place today, and where there's still work to do.
          </p>
        </div>
      </section>

      {/* ── Live platform stats ── */}
      <section className="border-b-[3px] border-billboard-ink bg-billboard-paper">
        <div className="max-w-4xl mx-auto px-5 py-10">
          <p className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft mb-6">Live platform numbers</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {statItems.map((s) => (
              <div key={s.label} className="border-[3px] border-billboard-ink rounded p-5">
                <p
                  className="text-4xl font-display font-bold mb-1 tabular-nums"
                  aria-live="polite"
                  aria-label={`${s.label}: ${s.value}`}
                >
                  {s.value}
                </p>
                <p className="text-sm text-billboard-inkSoft">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's in place ── */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">What's in place</h2>
        <p className="text-billboard-inkSoft mb-8 max-w-2xl">
          These are deliberate, tested choices made while building each feature — not aspirational statements.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          {IN_PLACE.map((p) => (
            <div key={p.title} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5">{p.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Still improving ── */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-3">Where we're still improving</h2>
          <ul className="space-y-3 mt-4">
            {STILL_IMPROVING.map((item) => (
              <li key={item} className="flex gap-3 text-billboard-inkSoft">
                <span className="shrink-0 mt-1 text-billboard-ink font-bold">→</span>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-billboard-inkSoft mt-6">
            If something doesn't work with the tools you use to browse, that's a real gap worth knowing about — not an edge case to work around.
          </p>
        </div>
      </section>

      {/* ── Standards we follow ── */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">Standards we follow</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              standard: "WCAG 2.1 AA",
              description: "The target for all new features. We use axe-core in our CI pipeline to catch regressions automatically.",
            },
            {
              standard: "ARIA Authoring Practices",
              description: "Patterns for complex widgets (modals, accordions, live regions) follow the WAI-ARIA Authoring Practices Guide.",
            },
            {
              standard: "SA Constitution §9",
              description: "The right to equality includes language and cultural access. Our multi-language approach is rooted in this, not just a feature.",
            },
          ].map((s) => (
            <div key={s.standard} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5 font-mono text-sm">{s.standard}</h3>
              <p className="text-sm text-billboard-inkSoft">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent improvements ── */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-6">Recent product improvements</h2>
          <div className="space-y-4">
            {[
              { phase: "Subscription & grace period", detail: "Payment gate modals are keyboard-navigable and announce grace-period deadlines to screen readers via aria-live." },
              { phase: "Bulk opportunity accept", detail: "The multi-select accept flow uses fieldset/legend grouping and individual checkboxes, not custom click traps." },
              { phase: "Campaign workspace", detail: "Stage transitions and counter-offer dialogs use focus management so keyboard users don't lose their place." },
              { phase: "Publisher profiles", detail: "Media kit carousels include prev/next buttons with visible labels. Rating stars are announced as values, not just icons." },
              { phase: "Admin compliance tools", detail: "Sortable tables include aria-sort attributes that update on click so screen reader users know the current sort state." },
              { phase: "WhatsApp booking flow", detail: "Booking confirmation messages sent via WhatsApp are plain text — no image-only content that can't be read by assistive apps." },
            ].map((item) => (
              <div key={item.phase} className="flex gap-4">
                <span className="shrink-0 font-mono text-xs font-semibold bg-billboard-yellow border-2 border-billboard-ink rounded px-2 py-1 h-fit mt-0.5">
                  {item.phase}
                </span>
                <p className="text-sm text-billboard-inkSoft">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Report issue CTA ── */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Something not working for you?</h2>
            <p className="text-sm text-billboard-inkSoft">
              Tell us what happened and what you were trying to do. Reach us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                {CONTACT_EMAIL}
              </a>{" "}
              or use the{" "}
              <Link to="/contact" className="underline">
                contact form
              </Link>
              .
            </p>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Accessibility%20issue`}
            className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center"
          >
            Report an issue →
          </a>
        </div>
      </section>
    </div>
  );
}
