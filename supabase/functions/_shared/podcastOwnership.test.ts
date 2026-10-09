import { describe, expect, it } from "vitest";
import { feedHasCode, findFeedLink, looksLikeFeed, looksLikeHtml, normalizeFeedUrl, podcastSnippet } from "./podcastOwnership";

const CODE = "CS-7A3B9";
const feed = (inner: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>${inner}</channel></rss>`;

describe("normalizeFeedUrl", () => {
  it("accepts public feed addresses and upgrades http to https", () => {
    expect(normalizeFeedUrl("https://feeds.example-podcasts.co.za/show.xml")).toBe("https://feeds.example-podcasts.co.za/show.xml");
    expect(normalizeFeedUrl("http://anchor.fm/s/abc/podcast/rss")).toBe("https://anchor.fm/s/abc/podcast/rss");
    expect(normalizeFeedUrl("anchor.fm/s/abc/podcast/rss")).toBe("https://anchor.fm/s/abc/podcast/rss");
  });
  it("drops the fragment and keeps the query", () => {
    expect(normalizeFeedUrl("https://feeds.buzzsprout.com/1.rss?x=1#top")).toBe("https://feeds.buzzsprout.com/1.rss?x=1");
  });
  it("rejects anything that could point the server at a private or odd address", () => {
    for (const bad of [
      "http://localhost/feed", "https://127.0.0.1/feed", "https://10.0.0.5/rss", "https://169.254.169.254/latest",
      "https://user:pw@example.co.za/feed", "https://example.co.za:8443/feed", "ftp://example.co.za/feed",
      "javascript:alert(1)", "https://intranet.local/feed", "https://[::1]/feed", "", "   ", null, 5,
    ]) expect(normalizeFeedUrl(bad as unknown)).toBeNull();
  });
});

describe("feedHasCode", () => {
  it("finds the code in the show description", () => {
    expect(feedHasCode(feed(`<title>My Show</title><description>Local business talk. ${podcastSnippet(CODE)}</description>`), CODE)).toBe(true);
  });
  it("finds it in an episode description, CDATA, HTML and entity-encoded text", () => {
    expect(feedHasCode(feed(`<item><description><![CDATA[<p>Notes</p><p>${CODE}</p>]]></description></item>`), CODE)).toBe(true);
    expect(feedHasCode(feed(`<item><content:encoded><![CDATA[<b>${CODE}</b>]]></content:encoded></item>`), CODE)).toBe(true);
    expect(feedHasCode(feed(`<item><itunes:summary>Verify &amp; confirm ${CODE}</itunes:summary></item>`), CODE)).toBe(true);
  });
  it("is not case sensitive about the code", () => {
    expect(feedHasCode(feed(`<description>cs-7a3b9</description>`), CODE)).toBe(true);
  });
  it("needs the whole code, not a longer or different one", () => {
    expect(feedHasCode(feed(`<description>CS-7A3B90</description>`), CODE)).toBe(false);
    expect(feedHasCode(feed(`<description>XCS-7A3B9</description>`), CODE)).toBe(false);
    expect(feedHasCode(feed(`<description>CS-7A3B8</description>`), CODE)).toBe(false);
    expect(feedHasCode(feed(`<description>nothing here</description>`), CODE)).toBe(false);
  });
  it("ignores the code appearing somewhere an owner would not put it (a link address)", () => {
    expect(feedHasCode(feed(`<link>https://example.co.za/${CODE}</link><enclosure url="https://cdn.example.co.za/${CODE}.mp3"/>`), CODE)).toBe(false);
  });
  it("refuses a malformed code so an empty check can never pass", () => {
    expect(feedHasCode(feed(`<description>anything</description>`), "")).toBe(false);
    expect(feedHasCode(feed(`<description>.*</description>`), ".*")).toBe(false);
  });
});

describe("feed vs web page detection", () => {
  it("tells a feed from a web page", () => {
    expect(looksLikeFeed(feed("<title>x</title>"))).toBe(true);
    expect(looksLikeFeed("<!doctype html><html><body>hi</body></html>")).toBe(false);
    expect(looksLikeHtml("<!DOCTYPE html><html>")).toBe(true);
    expect(looksLikeHtml(feed("<title>x</title>"))).toBe(false);
  });
  it("finds the feed a show page advertises", () => {
    const html = `<html><head><link rel="stylesheet" href="/a.css"><link rel="alternate" type="application/rss+xml" title="Feed" href="/feed.xml"></head></html>`;
    expect(findFeedLink(html, "https://myshow.co.za/")).toBe("https://myshow.co.za/feed.xml");
    expect(findFeedLink("<html><head></head></html>", "https://myshow.co.za/")).toBeNull();
  });
});
