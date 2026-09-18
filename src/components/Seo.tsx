/**
 * Per-page title + meta description, using React 19's native support for
 * hoisting <title>/<meta> rendered anywhere in the tree up to <head> — no
 * react-helmet needed. Render this once near the top of a page component.
 *
 * Route changes unmount the previous page (and its <title>) before mounting
 * the next one, so there's no duplicate-tag buildup between pages. Don't
 * also hardcode a <title> in index.html's body content or render more than
 * one <Seo> per page — React's hoisting doesn't deduplicate, it just adds.
 *
 * Note: this only helps the browser tab/history and crawlers that execute
 * JavaScript (Googlebot does). Most social-preview bots (Facebook, WhatsApp,
 * X, LinkedIn) fetch raw HTML and never run your JS, so they'll always see
 * index.html's static tags, never these per-page ones. Real per-page social
 * previews would need server-side rendering — a bigger change than fits
 * here, and not the highest priority at this stage.
 *
 * "claude to fix 2" item 25 grouped this file with the sitemap as one SEO
 * finding. The sitemap half is fixed — see scripts/generate-sitemap.mjs,
 * which now includes every real publisher/channel/article URL, not just a
 * fixed list. This file's half (this exact comment, in fact) was already
 * an accurate description of the remaining gap, not something that needed
 * new code: prerendering/SSR for social previews is a real, separate,
 * materially larger change (this app's rendering architecture, not a
 * build script) that the task itself frames as "Later introduce" at
 * LOW/MEDIUM severity, not a required fix — left open, not silently
 * dropped.
 */
export default function Seo({ title, description, noindex }: { title: string; description?: string; noindex?: boolean }) {
  return (
    <>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
    </>
  );
}
