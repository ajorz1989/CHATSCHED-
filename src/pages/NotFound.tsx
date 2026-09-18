import { Link } from "react-router-dom";
import { whatsappLink } from "../lib/constants";
import Seo from "../components/Seo";

/**
 * The catch-all 404 route (App.tsx). Used to render <ComingSoon
 * title="Page not found" /> — reusing a component whose actual copy
 * ("This page is next on the list — we're building it out") is written
 * for a specific, named, forthcoming feature, not a genuine 404. A
 * mistyped URL or a dead link told the visitor their destination was on
 * the roadmap, which is simply untrue for most 404s, plus two smaller
 * issues: no <Seo> tag at all (a 404 should be noindex, not silently
 * inherit whatever <title> the previous route left mounted... though
 * React unmounts that anyway — the real gap is that it was never marked
 * noindex for crawlers), and its buttons had no hover state, unlike
 * every other CTA in the app (see the shared hover:-translate-x-0.5
 * hover:-translate-y-0.5 / hover:-translate-y-0.5 convention, e.g.
 * ForBusinesses.tsx). ComingSoon.tsx itself is now unused (grepped: only
 * this route ever rendered it) — replaced outright rather than kept
 * alongside an equivalent, since ChannelPage.tsx already has its own
 * purpose-built ComingSoonDetail for actual "this feature is coming"
 * messaging.
 */
export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-24 text-center">
      <Seo title="Page not found — ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">404</span>
      <h1 className="text-3xl mb-3">Page not found.</h1>
      <p className="text-billboard-inkSoft mb-7">That link's broken or the page has moved — nothing to see here. Try the directory, or reach us on WhatsApp if you were looking for something specific.</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">Browse Publishers</Link>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">WhatsApp us</a>
      </div>
    </div>
  );
}
