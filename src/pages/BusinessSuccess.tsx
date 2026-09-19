import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { SUCCESS_ARTICLES } from "../lib/businessSuccessArticles";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function BusinessSuccess() {
  const [featured, ...rest] = SUCCESS_ARTICLES;
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    window.location.href = `mailto:info@chatsched.com?subject=Newsletter subscription&body=Please add me to the ChatSched Business Success newsletter: ${encodeURIComponent(email)}`;
    setSubscribed(true);
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Business Success Centre \u00b7 ChatSched"
        description="Practical guides on getting your first campaign, choosing publishers, budgets, ROI, local growth, avoiding mistakes, and building a repeat campaign rhythm."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">
        Business Success Centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">
        Practical guidance for every stage of your campaigns.
      </h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">
        From your first campaign to your fiftieth \u2014 straightforward guides on choosing publishers,
        budgeting, measuring results, and growing locally.
      </p>

      {/* Featured article */}
      <Link
        to={`/business-success/${featured.slug}`}
        className="group block border-[3px] border-billboard-ink rounded-lg bg-billboard-green text-white p-7 md:p-10 mb-10 transition hover:-translate-y-1 hover:shadow-block"
      >
        <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-white px-2.5 py-1 rounded mb-4">
          {featured.tag}
        </span>
        <h2 className="font-display text-2xl md:text-3xl mb-3 max-w-2xl">{featured.title}</h2>
        <p className="text-white/85 max-w-xl mb-4">{featured.excerpt}</p>
        <div className="flex items-center gap-3 font-mono text-xs text-white/80">
          <span>{formatDate(featured.date)}</span>
          <span>\u00b7</span>
          <span>{featured.readMins} min read</span>
          <span className="ml-auto font-bold text-white group-hover:gap-2 inline-flex items-center gap-1 transition-all">
            Read \u2192
          </span>
        </div>
      </Link>

      {/* Rest of articles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rest.map((a) => (
          <Link
            key={a.slug}
            to={`/business-success/${a.slug}`}
            className="group flex flex-col border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm"
          >
            <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded mb-3 self-start">
              {a.tag}
            </span>
            <h3 className="font-bold mb-2 leading-snug">{a.title}</h3>
            <p className="text-sm text-billboard-inkSoft mb-4">{a.excerpt}</p>
            <div className="mt-auto flex items-center gap-2.5 font-mono text-[10px] text-billboard-inkSoft">
              <span>{formatDate(a.date)}</span>
              <span>\u00b7</span>
              <span>{a.readMins} min read</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Email Newsletter Box */}
      <div className="mt-16 border-[3px] border-billboard-ink rounded-lg bg-billboard-green text-white p-8 md:p-10">
        <div className="max-w-xl">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-white/60 px-3 py-1 rounded mb-4">
            Newsletter
          </span>
          <h2 className="font-display text-xl md:text-2xl mb-2">
            Get campaign tips in your inbox.
          </h2>
          <p className="text-white/80 text-sm mb-6">
            Practical guides on local advertising, budgeting, and growing your business through
            ChatSched \u2014 delivered straight to you. No spam.
          </p>
          {subscribed ? (
            <div className="border-2 border-white/40 bg-white/10 rounded p-4 text-sm font-semibold">
              Thanks! Check your email to confirm your subscription.
            </div>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 border-2 border-white/60 rounded px-4 py-2.5 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                type="submit"
                className="border-2 border-white bg-white text-billboard-greenDeep font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0"
              >
                Subscribe
              </button>
            </form>
          )}
          <p className="text-white/60 text-xs mt-3">
            Or email us at{" "}
            <a href="mailto:info@chatsched.com" className="underline hover:text-white transition">
              info@chatsched.com
            </a>
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 pt-14 border-t-[3px] border-billboard-ink/15 text-center">
        <h2 className="font-display text-xl mb-3">Ready to put this into practice?</h2>
        <p className="text-billboard-inkSoft max-w-md mx-auto mb-6">
          Find a local page, creator or channel your customers already trust, and submit your first
          feature request.
        </p>
        <Link
          to="/browse"
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
        >
          Browse Advertising \u2192
        </Link>
      </div>
    </div>
  );
}
