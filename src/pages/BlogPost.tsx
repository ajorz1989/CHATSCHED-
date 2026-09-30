import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import Seo from "../components/Seo";
import { BLOG_POSTS, getBlogPostBySlug } from "../lib/blogPosts";
import { getTeamMemberForArticle, TEAM_SPRITE_SRC } from "../lib/teamMembers";

type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const EXPANSION_FILES: Record<string, string> = {
  "attention-is-the-scarcest-resource": "01-attention-is-the-scarcest-resource.md",
  "proof-over-promises": "02-modern-advertising-runs-on-proof-not-just-promises.md",
  "niche-audiences-beat-mass-audiences": "03-the-age-of-the-mass-audience-is-over-niche-wins-now.md",
  "local-trust-beats-global-reach": "04-local-trust-beats-global-reach-every-time.md",
  "social-proof-and-modern-trust": "05-why-someone-i-follow-posted-about-it-beats-any-slogan.md",
  "showing-up-where-your-customers-already-are": "06-stop-trying-to-pull-customers-in-show-up-where-they-already-are.md",
  "advertising-is-a-relationship-not-a-broadcast": "07-the-best-modern-advertising-doesnt-feel-like-a-broadcast.md",
  "word-of-mouth-isnt-enough-anymore": "08-word-of-mouth-built-your-business-it-wont-scale-it-alone.md",
  "advertising-doesnt-need-a-big-budget-anymore": "09-you-dont-need-a-big-brand-budget-to-advertise-well-anymore.md",
  "consistency-beats-one-off-ads": "10-one-great-ad-wont-do-it-showing-up-consistently-will.md",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

function parseSupplementalMarkdown(markdown: string): ArticleBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ArticleBlock[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
      continue;
    }
    const bullet = line.match(/^(?:[-*])\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      listItems.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    blocks.push({ type: "paragraph", text: line });
  }

  flushList();
  return blocks;
}

function renderExpansionParagraph(text: string, key: string) {
  const isCta = text.startsWith("**CTA:**");
  if (isCta) {
    return (
      <div key={key} className="border-[3px] border-billboard-ink bg-billboard-yellow rounded-lg p-5 mt-2">
        <p className="font-semibold text-billboard-ink leading-relaxed">
          <span className="font-mono text-[11px] uppercase tracking-wider mr-2">CTA</span>
          {text.replace(/^\*\*CTA:\*\*\s*/, "")}
        </p>
      </div>
    );
  }

  return (
    <p key={key} className="text-billboard-inkSoft leading-relaxed">
      {text}
    </p>
  );
}


export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const [expandedMarkdown, setExpandedMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;

    const filename = EXPANSION_FILES[post.slug];
    if (!filename) {
      setExpandedMarkdown(null);
      return;
    }

    const controller = new AbortController();

    fetch(`/blog-content/${filename}`, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => setExpandedMarkdown(text))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setExpandedMarkdown(null);
      });

    return () => controller.abort();
  }, [post?.slug]);

  if (!post) return <Navigate to="/blog" replace />;

  const index = BLOG_POSTS.findIndex((p) => p.slug === post.slug);
  const next = BLOG_POSTS[(index + 1) % BLOG_POSTS.length];
  const author = getTeamMemberForArticle(post.slug);

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title={`${post.title} · ChatSched Blog`} description={post.excerpt} />
      <Link to="/blog" className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-billboard-inkSoft hover:text-billboard-ink mb-10">← Back to blog</Link>

      <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2.5 py-1 rounded mb-4">{post.tag}</span>
      <h1 className="text-3xl md:text-4xl mb-4 leading-tight">{post.title}</h1>
      <div className="flex items-center gap-3 font-mono text-xs text-billboard-inkSoft mb-10 pb-8 border-b-2 border-billboard-ink/15">
        <span>{formatDate(post.date)}</span>
        <span>·</span>
        <span>{post.readMins} min read</span>
      </div>

      {/* Article body */}
      <div className="space-y-5 text-billboard-inkSoft leading-relaxed">
        {post.paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "text-lg text-billboard-ink" : ""}>{p}</p>
        ))}
      </div>

      {/* Supplied long-form article content is additive; the original copy above remains unchanged. */}
      {expandedMarkdown && (
        <section className="mt-12 pt-10 border-t-[3px] border-billboard-ink/15" aria-label="Extended article">
          <div className="mb-7">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-billboard-inkSoft">
              Extended article
            </span>
            <h2 className="font-display text-2xl md:text-3xl mt-2">More detail for this topic</h2>
          </div>
          <div className="space-y-6">
            {parseSupplementalMarkdown(expandedMarkdown).map((block, index) => {
              if (block.type === "heading") {
                return (
                  <h2 key={`h-${index}`} className="font-display text-xl md:text-2xl text-billboard-ink pt-2">
                    {block.text}
                  </h2>
                );
              }

              if (block.type === "list") {
                return (
                  <ul key={`l-${index}`} className="space-y-2 pl-5 list-disc text-billboard-inkSoft leading-relaxed">
                    {block.items.map((item, itemIndex) => (
                      <li key={`${index}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                );
              }

              return renderExpansionParagraph(block.text, `p-${index}`);
            })}
          </div>
        </section>
      )}

      {/* Author Bio */}
      <div className="mt-12 pt-8 border-t-[3px] border-billboard-ink/15">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-billboard-inkSoft mb-4">Author Bio</h2>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-billboard-ink bg-billboard-paperDim shrink-0 overflow-hidden">
            <div
              role="img"
              aria-label={`Photo of ${author.name}`}
              className="w-full h-full bg-cover bg-no-repeat"
              style={{
                backgroundImage: `url(${TEAM_SPRITE_SRC})`,
                backgroundSize: "200% 200%",
                backgroundPosition: author.imagePosition,
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-billboard-ink">{author.name}</p>
            <p className="text-sm text-billboard-inkSoft">{author.title} · ChatSched</p>
            <p className="text-sm text-billboard-inkSoft mt-1 leading-relaxed">{author.bio}</p>
          </div>
        </div>
      </div>

      {/* Next post */}
      <div className="mt-10 pt-8 border-t-2 border-billboard-ink/15">
        <Link
          to={`/blog/${next.slug}`}
          className="group block border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim transition hover:-translate-y-1 hover:shadow-blockSm"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Next up</span>
          <h3 className="font-bold mt-1 group-hover:underline">{next.title}</h3>
        </Link>
      </div>

      <div className="mt-10 text-center">
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">Browse Advertising →</Link>
      </div>
    </div>
  );
}
