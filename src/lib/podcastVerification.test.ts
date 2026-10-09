import { describe, expect, it } from "vitest";
import { listedShowUrl, PODCAST_REASON_TEXT, podcastShowUrlError, podcastSnippet } from "./podcastVerification";
import { feedHasCode, podcastSnippet as serverSnippet } from "../../supabase/functions/_shared/podcastOwnership";

describe("podcast verification", () => {
  it("shows the same text the server looks for", () => {
    expect(podcastSnippet("CS-7A3B9")).toBe(serverSnippet("CS-7A3B9"));
  });

  it("the line we ask people to paste is found by the server check once it is in a feed", () => {
    const feed = `<rss><channel><description>My show. ${podcastSnippet("CS-7A3B9")}</description></channel></rss>`;
    expect(feedHasCode(feed, "CS-7A3B9")).toBe(true);
  });

  it("reads the show address from the listing", () => {
    expect(listedShowUrl({ showUrl: " https://feeds.example.co.za/a.xml " })).toBe("https://feeds.example.co.za/a.xml");
    expect(listedShowUrl({ showUrl: "" })).toBeNull();
    expect(listedShowUrl(null)).toBeNull();
    expect(listedShowUrl({})).toBeNull();
  });

  it("requires a web address for the feed", () => {
    expect(podcastShowUrlError("")).not.toBeNull();
    expect(podcastShowUrlError("feeds.example.co.za")).not.toBeNull();
    expect(podcastShowUrlError("https://feeds.example.co.za/a.xml")).toBeNull();
  });

  it("explains every reason the check can fail", () => {
    for (const r of ["unreachable", "not_a_feed", "page_without_feed", "code_not_found"] as const) {
      expect(PODCAST_REASON_TEXT[r].length).toBeGreaterThan(20);
    }
  });
});
