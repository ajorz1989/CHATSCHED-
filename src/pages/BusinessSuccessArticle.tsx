import { Link, useParams, Navigate } from "react-router-dom";
import Seo from "../components/Seo";
import { SUCCESS_ARTICLES, getSuccessArticleBySlug } from "../lib/businessSuccessArticles";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function BusinessSuccessArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getSuccessArticleBySlug(slug) : undefined;

  if (!article) return <Navigate to="/business-success" replace />;

  const index = SUCCESS_ARTICLES.findIndex((a) => a.slug === article.slug);
  const next = SUCCESS_ARTICLES[(index + 1) % SUCCESS_ARTICLES.length];

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title={`${article.title} \u00b7 Business Success Centre`} description={article.excerpt} />
      <Link
        to="/business-success"
        className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-billboard-inkSoft hover:text-billboard-ink mb-6"
      >
        \u2190 Back to Business Success Centre
      </Link>

      <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2.5 py-1 rounded mb-4">
        {article.tag}
      </span>
      <h1 className="text-3xl md:text-4xl mb-4 leading-tight">{article.title}</h1>
      <div className="flex items-center gap-3 font-mono text-xs text-billboard-inkSoft mb-10 pb-8 border-b-2 border-billboard-ink/15">
        <span>{formatDate(article.date)}</span>
        <span>\u00b7</span>
        <span>{article.readMins} min read</span>
      </div>

      {/* Article body */}
      <div className="space-y-5 text-billboard-inkSoft leading-relaxed">
        {article.paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "text-lg text-billboard-ink" : ""}>{p}</p>
        ))}
      </div>

      {/* Author Bio */}
      <div className="mt-12 pt-8 border-t-[3px] border-billboard-ink/15">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-billboard-inkSoft mb-4">
          Author Bio
        </h2>
        <div className="flex items-center gap-4">
          {/* Circle avatar placeholder — swap for <img> when photo is ready */}
          <div className="w-14 h-14 rounded-full border-2 border-billboard-ink bg-billboard-paperDim flex items-center justify-center shrink-0 overflow-hidden">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-billboard-inkSoft">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-billboard-ink">
              {article.author?.name ?? "[Author Name]"}
            </p>
            <p className="text-sm text-billboard-inkSoft">
              {article.author?.title ?? "[Job Title] at ChatSched"}
            </p>
          </div>
        </div>
      </div>

      {/* Next article */}
      <div className="mt-10 pt-8 border-t-2 border-billboard-ink/15">
        <Link
          to={`/business-success/${next.slug}`}
          className="group block border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim transition hover:-translate-y-1 hover:shadow-blockSm"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Next up</span>
          <h3 className="font-bold mt-1 group-hover:underline">{next.title}</h3>
        </Link>
      </div>

      <div className="mt-10 text-center">
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
