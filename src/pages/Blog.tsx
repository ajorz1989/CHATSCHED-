import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { BLOG_POSTS } from "../lib/blogPosts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function Blog() {
  const [featured, ...rest] = BLOG_POSTS;
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // Opens mailto as a simple fallback until a backend subscription endpoint is wired up
    window.location.href = `mailto:info@chatsched.com?subject=Newsletter subscription&body=Please add me to the ChatSched newsletter: ${encodeURIComponent(email)}`;
    setSubscribed(true);
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Blog - ChatSched"
        description="Short reads on local trust, attention, and what it actually takes for a small South African business to get seen in a modern, noisy market."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Blog
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">
        Why advertising matters more than ever.
      </h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">
        Short reads on attention, trust, and what it actually takes for a small
        business to get seen in a modern, noisy market.
      </p>

      {/* Featured post */}
      <Link
        to={`/blog/${featured.slug}`}
        className="group block border-[3px] border-billboard-ink rounded-lg bg-billboard-yellow p-7 md:p-10 mb-10 transition hover:-translate-y-1 hover:shadow-block"
      >
        <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-white px-2.5 py-1 rounded mb-4">
          {featured.tag}
        </span>
        <h2 className="font-display text-2xl md:text-3xl mb-3 max-w-2xl">
          {featured.title}
        </h2>
        <p className="text-billboard-inkSoft max-w-xl mb-4">{featured.excerpt}</p>
        <div className="flex items-center gap-3 font-mono text-xs text-billboard-inkSoft">
          <span>{formatDate(featured.date)}</span>
          <span>-</span>
          <span>{featured.readMins} min read</span>
          <span className="ml-auto font-bold text-billboard-ink group-hover:gap-2 inline-flex items-center gap-1 transition-all">
            Read
          </span>
        </div>
      </Link>

      {/* Rest of posts */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rest.map((p) => (
          <Link
            key={p.slug}
            to={`/blog/${p.slug}`}
            className="group flex flex-col border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm"
          >
            <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded mb-3 self-start">
              {p.tag}
            </span>
            <h3 className="font-bold mb-2 leading-snug">{p.title}</h3>
            <p className="text-sm text-billboard-inkSoft mb-4">{p.excerpt}</p>
            <div className="mt-auto flex items-center gap-2.5 font-mono text-[10px] text-billboard-inkSoft">
              <span>{formatDate(p.date)}</span>
              <span>-</span>
              <span>{p.readMins} min read</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Email Newsletter Box */}
      <div className="mt-16 border-[3px] border-billboard-ink rounded-lg bg-billboard-yellow p-8 md:p-10">
        <div className="max-w-xl">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-white px-3 py-1 rounded mb-4">
            Newsletter
          </span>
          <h2 className="font-display text-xl md:text-2xl mb-2">
            Get ChatSched insights in your inbox.
          </h2>
          <p className="text-billboard-inkSoft text-sm mb-6">
            Short reads on local advertising, trust, and growing your business
            in South Africa. No spam, no filler.
          </p>
          {subscribed ? (
            <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-4 text-sm font-semibold">
              Thanks! Check your email to confirm your subscription.
            </div>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 border-2 border-billboard-ink rounded px-4 py-2.5 bg-white text-billboard-ink placeholder:text-billboard-inkSoft focus:outline-none focus:ring-2 focus:ring-billboard-ink"
              />
              <button
                type="submit"
                className="border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0"
              >
                Subscribe
              </button>
            </form>
          )}
          <p className="text-billboard-inkSoft text-xs mt-3">
            Or email us directly at{" "}
            <a
              href="mailto:info@chatsched.com"
              className="underline hover:text-billboard-ink transition"
            >
              info@chatsched.com
            </a>
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 pt-14 border-t-[3px] border-billboard-ink/15 text-center">
        <h2 className="font-display text-xl mb-3">
          Ready to put this into practice?
        </h2>
        <p className="text-billboard-inkSoft max-w-md mx-auto mb-6">
          Find a local page, creator or channel your customers already trust,
          and submit your first feature request.
        </p>
        <Link
          to="/browse"
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
        >
          Browse Advertising
        </Link>
      </div>
    </div>
  );
}
