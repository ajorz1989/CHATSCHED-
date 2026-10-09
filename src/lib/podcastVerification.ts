/**
 * Podcast ownership check: the owner pastes their ChatSched code into the show
 * description (or an episode's notes) and the verify-podcast-ownership edge
 * function reads the show's RSS feed looking for it
 * (supabase/functions/_shared/podcastOwnership.ts — a test keeps the two in sync).
 */
export function podcastSnippet(code: string): string {
  return `ChatSched verification: ${code}`;
}

/** The show address typed on the listing (RSS feed), for display. */
export function listedShowUrl(channelMetadata: unknown): string | null {
  const raw = (channelMetadata as { showUrl?: unknown } | null)?.showUrl;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** Why the last check came back empty-handed, in plain words. Keys match the edge function's `reason`. */
export type PodcastCheckReason = "unreachable" | "not_a_feed" | "page_without_feed" | "code_not_found";

export const PODCAST_REASON_TEXT: Record<PodcastCheckReason, string> = {
  code_not_found:
    "We read your feed but your code isn't in it yet. Podcast hosts sometimes take a few minutes to publish changes — try again shortly.",
  unreachable:
    "We couldn't open your feed address. Check that it's correct and public, then try again.",
  not_a_feed:
    "That address isn't an RSS feed. Use your feed address (your podcast host shows it as the RSS feed), not a Spotify or Apple page.",
  page_without_feed:
    "That address is a web page, and we couldn't find a feed on it. Use your RSS feed address instead — your podcast host shows it.",
};

/** Validation shared by the publisher application and the business listing form. null = fine. */
export function podcastShowUrlError(value: string): string | null {
  const v = value.trim();
  if (!v || !/^https?:\/\/\S+$/i.test(v)) {
    return "Add your podcast's RSS feed address (starting with https://). We use it to confirm you own the show.";
  }
  return null;
}
