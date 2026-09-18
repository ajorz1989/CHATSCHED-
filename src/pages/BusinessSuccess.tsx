import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { SUCCESS_ARTICLES } from "../lib/businessSuccessArticles";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function BusinessSuccess() {
  const [featured, ...rest] = SUCCESS_ARTICLES;

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo title="Business Success Centre · ChatSched" description="Practical guides on getting your first campaign, choosing publishers, budgets, ROI, local growth, avoiding mistakes, and building a repeat campaign rhythm." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Business Success Centre</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">Practical guidance for every stage of your campaigns.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">From your first campaign to your fiftieth — straightforward guides on choosing publishers, budgeting, measuring results, and growing locally.</p>

      {/* Featured article */}
      <Link
        to={`/business-success/${featured.slug}`}
        className="group block border-[3px] border-billboard-ink rounded-lg bg-billboard-green text-white p-7 md:p-10 mb-10 transition hover:-translate-y-1 hover:shadow-block"
      >
        <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-white px-2.5 py-1 rounded mb-4">{featured.tag}</span>
        <h2 className="font-display text-2xl md:text-3xl mb-3 max-w-2xl">{featured.title}</h2>
        <p className="text-white/85 max-w-xl mb-4">{featured.excerpt}</p>
        <div className="flex items-center gap-3 font-mono text-xs text-white/80">
          <span>{formatDate(featured.date)}</span>
          <span>·</span>
          <span>{featured.readMins} min read</span>
          <span className="ml-auto font-bold text-white group-hover:gap-2 inline-flex items-center gap-1 transition-all">Read →</span>
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
            <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded mb-3 self-start">{a.tag}</span>
            <h3 className="font-bold mb-2 leading-snug">{a.title}</h3>
            <p className="text-sm text-billboard-inkSoft mb-4">{a.excerpt}</p>
            <div className="mt-auto flex items-center gap-2.5 font-mono text-[10px] text-billboard-inkSoft">
              <span>{formatDate(a.date)}</span>
              <span>·</span>
              <span>{a.readMins} min read</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 pt-14 border-t-[3px] border-billboard-ink/15 text-center">
        <h2 className="font-display text-xl mb-3">Ready to put this into practice?</h2>
        <p className="text-billboard-inkSoft max-w-md mx-auto mb-6">Find a local page, creator or channel your customers already trust, and submit your first feature request.</p>
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">Browse Advertising →</Link>
      </div>
    </div>
  );
}
