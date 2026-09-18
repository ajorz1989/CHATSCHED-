import { Link, useParams, Navigate } from "react-router-dom";
import Seo from "../components/Seo";
import { PUBLISHER_SUCCESS_ARTICLES, getPublisherSuccessArticleBySlug } from "../lib/publisherSuccessArticles";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function PublisherSuccessArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getPublisherSuccessArticleBySlug(slug) : undefined;

  if (!article) return <Navigate to="/publisher-success" replace />;

  const index = PUBLISHER_SUCCESS_ARTICLES.findIndex((a) => a.slug === article.slug);
  const next = PUBLISHER_SUCCESS_ARTICLES[(index + 1) % PUBLISHER_SUCCESS_ARTICLES.length];

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title={`${article.title} · Publisher Success Centre`} description={article.excerpt} />
      <Link to="/publisher-success" className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-billboard-inkSoft hover:text-billboard-ink mb-6">← Back to Publisher Success Centre</Link>

      <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2.5 py-1 rounded mb-4">{article.tag}</span>
      <h1 className="text-3xl md:text-4xl mb-4 leading-tight">{article.title}</h1>
      <div className="flex items-center gap-3 font-mono text-xs text-billboard-inkSoft mb-10 pb-8 border-b-2 border-billboard-ink/15">
        <span>{formatDate(article.date)}</span>
        <span>·</span>
        <span>{article.readMins} min read</span>
      </div>

      <div className="space-y-5 text-billboard-inkSoft leading-relaxed">
        {article.paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "text-lg text-billboard-ink" : ""}>{p}</p>
        ))}
      </div>

      <div className="mt-14 pt-8 border-t-2 border-billboard-ink/15">
        <Link
          to={`/publisher-success/${next.slug}`}
          className="group block border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim transition hover:-translate-y-1 hover:shadow-blockSm"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Next up</span>
          <h3 className="font-bold mt-1 group-hover:underline">{next.title}</h3>
        </Link>
      </div>

      <div className="mt-10 text-center">
        <Link to="/dashboard" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">Go to Dashboard →</Link>
      </div>
    </div>
  );
}
