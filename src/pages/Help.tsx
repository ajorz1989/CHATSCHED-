import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";

const ROLE_SECTIONS = [
  {
    title: "I'm a business",
    links: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "For Businesses", to: "/for-businesses" },
      { label: "Business Success Centre", to: "/business-success" },
    ],
  },
  {
    title: "I'm a publisher",
    links: [
      { label: "For Publishers", to: "/for-publishers" },
      { label: "Publisher Success Centre", to: "/publisher-success" },
      { label: "Media kit", to: "/media-kit" },
      { label: "Earnings dashboard", to: "/dashboard/earnings" },
    ],
  },
  {
    title: "Account & billing",
    links: [
      { label: "How payment works", to: "/how-payment-works" },
      { label: "Account settings", to: "/account" },
      { label: "Reset your password", to: "/forgot-password" },
      { label: "Set up two-factor authentication", to: "/mfa-setup" },
    ],
  },
  {
    title: "Trust & safety",
    links: [
      { label: "Trust Centre", to: "/trust" },
      { label: "How disputes get resolved", to: "/trust#disputes" },
      { label: "Compliance Centre", to: "/compliance" },
      { label: "Security", to: "/security" },
    ],
  },
];

const COMMON_TASKS = [
  { label: "Reset a forgotten password", to: "/forgot-password" },
  { label: "Set up or change two-factor authentication", to: "/mfa-setup" },
  { label: "Update or delete your account", to: "/account" },
  { label: "Report a dispute", to: "/trust#disputes" },
  { label: "Understand a payout or fee", to: "/how-payment-works" },
];

export default function Help() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/faq?q=${encodeURIComponent(trimmed)}` : "/faq");
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <Seo title="Help Centre · ChatSched" description="Find what you need fast — search the FAQ, jump to account and billing help, or get a real answer from the team." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Help Centre</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">Find your answer fast — or talk to a real person if you can't.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-8">Search the FAQ, jump straight to the thing you're trying to do, or reach a real person.</p>

      <form onSubmit={handleSearch} className="relative mb-14">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — e.g. &ldquo;payout&rdquo;, &ldquo;dispute&rdquo;, &ldquo;reset password&rdquo;"
          className="w-full border-[3px] border-billboard-ink rounded-lg px-4 py-3.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-billboard-yellow"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold uppercase bg-billboard-yellow border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-1/2 hover:brightness-95 transition">
          Search
        </button>
      </form>

      <div className="grid sm:grid-cols-2 gap-5 mb-14">
        {ROLE_SECTIONS.map((section) => (
          <div key={section.title} className="border-[3px] border-billboard-ink rounded p-5">
            <h2 className="font-bold mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-billboard-inkSoft hover:text-billboard-ink hover:underline">{l.label} →</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mb-14">
        <h2 className="font-display text-lg mb-4">Common tasks</h2>
        <div className="border-[3px] border-billboard-ink rounded divide-y-2 divide-billboard-ink/10">
          {COMMON_TASKS.map((t) => (
            <Link key={t.to} to={t.to} className="flex items-center justify-between px-5 py-3.5 hover:bg-billboard-paperDim transition-colors text-sm font-semibold">
              {t.label}
              <span className="font-display text-billboard-inkSoft">→</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg mb-1">Still stuck?</h2>
          <p className="text-sm text-billboard-inkSoft">Browse the full <Link to="/faq" className="underline">FAQ</Link>, or reach us directly at {CONTACT_EMAIL} — real people read every message.</p>
        </div>
        <Link to="/contact" className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center">
          Contact us →
        </Link>
      </div>
    </div>
  );
}
