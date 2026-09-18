/**
 * Turns a publisher-supplied video link into something embeddable. No
 * self-hosted video anywhere in this app — see schema_phase27_portfolio.sql
 * for why. YouTube and Vimeo have simple, no-script iframe embeds; TikTok
 * and Instagram require loading their own embed SDK to render inline, which
 * this app deliberately avoids pulling in for one profile field, so those
 * platforms get an honest "watch on X" link-out card instead of a broken or
 * misleading embed attempt.
 */
export type VideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "linkout"; platform: string; url: string }
  | null;

export function parseVideoUrl(raw: string): VideoEmbed {
  const url = raw.trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/shorts/")[1]?.split("/")[0];
    if (id) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    if (id) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    return { kind: "linkout", platform: "TikTok", url };
  }
  if (host === "instagram.com") {
    return { kind: "linkout", platform: "Instagram", url };
  }
  if (host === "facebook.com" || host === "fb.watch") {
    return { kind: "linkout", platform: "Facebook", url };
  }

  return { kind: "linkout", platform: "video", url };
}
