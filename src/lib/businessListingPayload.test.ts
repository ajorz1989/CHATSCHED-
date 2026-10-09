import { describe, expect, it } from "vitest";
import { buildBusinessListingPayload, PROOF_REQUIRED_CHANNELS, type BusinessListingGeneral } from "./businessListingPayload";
import { initialState, type FormState } from "./channelOnboardingForm";
import { isAuthorityChannel } from "./channelOnboardingSchemas";

const general: BusinessListingGeneral = {
  name: " Test Listing ",
  category: "Retail",
  city: " Cape Town ",
  province: "Western Cape",
  suburb: "",
  price: 500,
  bio: "",
  audience: "",
};

const form = (patch: Partial<FormState>): FormState => ({ ...initialState, ...patch });

describe("buildBusinessListingPayload", () => {
  it("website: keeps visitors in metadata, followers equal to the headline number, no engagement", () => {
    const r = buildBusinessListingPayload("website", general, form({
      followers: "12000", webDomain: "example.co.za", webMonthlyVisitors: "12000", webNiche: "news",
      engagement: "9", monthlyReach: "5000",
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.needsProof).toBe(false);
    expect(r.payload.name).toBe("Test Listing");
    expect(r.payload.city).toBe("Cape Town");
    expect(r.payload.engagement).toBe(0);
    expect(r.payload.monthly_reach).toBeNull();
    expect((r.payload.channel_metadata as Record<string, unknown>).monthlyUniqueVisitors).toBe(12000);
  });

  it("website below the channel minimum is refused with a plain message", () => {
    const r = buildBusinessListingPayload("website", general, form({ followers: "10", webMonthlyVisitors: "10" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at least/i);
  });

  it("community: needs the ownership confirmation, then sends followers 0 and the flag", () => {
    const missing = buildBusinessListingPayload("community", general, form({ commMemberCount: "400" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/own or run/i);

    const r = buildBusinessListingPayload("community", general, form({ commMemberCount: "400", authorityConfirmed: true, followers: "999" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.followers).toBe(0);
    expect(r.needsProof).toBe(true);
    const meta = r.payload.channel_metadata as Record<string, unknown>;
    expect(meta.authorityConfirmed).toBe(true);
    expect(meta.memberCount).toBe(400);
  });

  it("social media: needs a primary platform and a public link for each chosen platform", () => {
    const none = buildBusinessListingPayload("social-media", general, form({ followers: "5000" }));
    expect(none.ok).toBe(false);

    const noLink = buildBusinessListingPayload("social-media", general, form({ followers: "5000", smPrimaryPlatform: "instagram" }));
    expect(noLink.ok).toBe(false);
    if (!noLink.ok) expect(noLink.error).toMatch(/link/i);

    const badLink = buildBusinessListingPayload("social-media", general, form({
      followers: "5000", smPrimaryPlatform: "instagram", smSocialLinks: { instagram: "not a url" },
    }));
    expect(badLink.ok).toBe(false);

    const ok = buildBusinessListingPayload("social-media", general, form({
      followers: "5000", engagement: "4.5", monthlyReach: "20000", smPrimaryPlatform: "instagram",
      smSocialLinks: { instagram: "https://instagram.com/x" },
    }));
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.payload.followers).toBe(5000);
    expect(ok.payload.engagement).toBe(4.5);
    expect(ok.payload.monthly_reach).toBe(20000);
    expect(ok.payload.social_verification_links).toEqual([{ platform: "instagram", url: "https://instagram.com/x" }]);
  });

  it("influencer: sends the profile link for the ownership check, rejects a malformed one", () => {
    const base = { followers: "5000", engagement: "3", infPrimaryPlatform: "instagram" };
    const ok = buildBusinessListingPayload("influencer", general, form({ ...base, infProfileUrl: "https://instagram.com/me" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.payload.social_verification_links).toEqual([{ platform: "instagram", url: "https://instagram.com/me" }]);

    const none = buildBusinessListingPayload("influencer", general, form(base));
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.payload.social_verification_links).toEqual([]);

    const bad = buildBusinessListingPayload("influencer", general, form({ ...base, infProfileUrl: "instagram.com/me" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/https/i);
  });

  it("podcast: needs the RSS feed address (it is how ownership is checked) and sends it in metadata", () => {
    const base = { followers: "2000", podcastDownloads: "2000" };
    const missing = buildBusinessListingPayload("podcast", general, form(base));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/RSS feed/i);

    const bare = buildBusinessListingPayload("podcast", general, form({ ...base, podcastShowUrl: "feeds.example.co.za/show.xml" }));
    expect(bare.ok).toBe(false);

    const ok = buildBusinessListingPayload("podcast", general, form({ ...base, podcastShowUrl: " https://feeds.example.co.za/show.xml " }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((ok.payload.channel_metadata as Record<string, unknown>).showUrl).toMatch(/^https:\/\/feeds\.example\.co\.za/);
  });

  it("proof is required for exactly the authority channels", () => {
    for (const slug of PROOF_REQUIRED_CHANNELS) expect(isAuthorityChannel(slug)).toBe(true);
    expect(PROOF_REQUIRED_CHANNELS).toHaveLength(8);
  });
});
