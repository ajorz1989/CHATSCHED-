import { describe, expect, it } from "vitest";
import { listedDomain, websiteSnippets } from "./websiteVerification";
import { websiteSnippets as serverSnippets } from "../../supabase/functions/_shared/websiteOwnership";

describe("websiteSnippets", () => {
  it("matches exactly what the edge function looks for", () => {
    expect(websiteSnippets("CS-7A3B9")).toEqual(serverSnippets("CS-7A3B9"));
  });
});

describe("listedDomain", () => {
  it("returns a bare host for display", () => {
    expect(listedDomain({ domain: "https://www.mysite.co.za/about" })).toBe("www.mysite.co.za");
    expect(listedDomain({ domain: " mysite.co.za " })).toBe("mysite.co.za");
  });
  it("is null when nothing usable is stored", () => {
    expect(listedDomain(null)).toBeNull();
    expect(listedDomain({})).toBeNull();
    expect(listedDomain({ domain: "" })).toBeNull();
    expect(listedDomain({ domain: 5 })).toBeNull();
  });
});
