// One entry per platform actually supported — see supabase/DEPLOY.md
// ("Social account connect") for why these four and not the rest of the
// PLATFORMS list in src/lib/constants.ts. Short version: these are the
// only ones with a free, official, OAuth-based way to read a creator's own
// follower count. X has no free API tier as of 2026 (pay-per-read, no way
// around it); LinkedIn's follower API is restricted to approved marketing
// partners, not self-serve; WhatsApp Channels and Facebook Groups have no
// public API for this at all.
export type SupportedPlatform = "youtube" | "facebook_page" | "instagram" | "tiktok";

export interface ImportedProfile {
  platformUserId: string;
  username: string | null;
  followerCount: number;
  avatarUrl: string | null;
}

export interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraAuthParams?: Record<string, string>;
  /** Exchanges the code for tokens using this platform's exact token-request shape. */
  exchangeCode: (params: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  }) => Promise<{ accessToken: string; refreshToken: string | null; expiresInSeconds: number | null }>;
  /** Uses the fresh access token to pull the creator's own profile + follower count. */
  fetchProfile: (accessToken: string) => Promise<ImportedProfile>;
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export const PROVIDERS: Record<SupportedPlatform, ProviderConfig> = {
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // Read-only, own-channel stats. Google classifies this as a
    // "sensitive" (not "restricted") scope — needs a standard OAuth
    // consent screen verification before it works for anyone other than
    // your own test users, not the multi-week CASA security assessment
    // "restricted" scopes require.
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
      const data = await postForm("https://oauth2.googleapis.com/token", {
        code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
      });
      return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresInSeconds: data.expires_in ?? null };
    },
    async fetchProfile(accessToken) {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`YouTube profile fetch failed: ${await res.text()}`);
      const data = await res.json();
      const channel = data.items?.[0];
      if (!channel) throw new Error("No YouTube channel found on this Google account.");
      return {
        platformUserId: channel.id,
        username: channel.snippet?.title ?? null,
        followerCount: Number(channel.statistics?.subscriberCount ?? 0),
        avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
      };
    },
  },

  facebook_page: {
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    // pages_show_list to enumerate the pages they manage, pages_read_engagement
    // for follower counts. Works immediately in the app's Development mode
    // for pages you/your testers admin; needs Meta App Review (2-4 weeks,
    // per Meta's own published timeline) before it'll work for anyone else.
    scope: "pages_show_list,pages_read_engagement",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
      const data = await res.json();
      return { accessToken: data.access_token, refreshToken: null, expiresInSeconds: data.expires_in ?? null };
    },
    async fetchProfile(accessToken) {
      // A user token can manage several Pages — this picks the first one,
      // which is right for the common case (a creator with one Page) but
      // worth revisiting with a picker UI if multi-Page creators turn out
      // to be common in practice.
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,fan_count,picture&access_token=${accessToken}`);
      if (!pagesRes.ok) throw new Error(`Facebook Pages fetch failed: ${await pagesRes.text()}`);
      const pagesData = await pagesRes.json();
      const page = pagesData.data?.[0];
      if (!page) throw new Error("No Facebook Page found for this account — Instagram and personal profiles aren't Pages.");
      return {
        platformUserId: page.id,
        username: page.name ?? null,
        followerCount: Number(page.fan_count ?? 0),
        avatarUrl: page.picture?.data?.url ?? null,
      };
    },
  },

  instagram: {
    authUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    // Instagram API with Instagram Login (the current, non-deprecated
    // path — no linked Facebook Page required). Business/Creator accounts
    // only; personal accounts have had no official API since the Basic
    // Display API shut down. Same Meta App Review gate as facebook_page.
    scope: "instagram_business_basic",
    clientIdEnv: "INSTAGRAM_APP_ID",
    clientSecretEnv: "INSTAGRAM_APP_SECRET",
    async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
      const data = await postForm("https://api.instagram.com/oauth/access_token", {
        client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code,
      });
      return { accessToken: data.access_token, refreshToken: null, expiresInSeconds: null };
    },
    async fetchProfile(accessToken) {
      const res = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,followers_count,profile_picture_url&access_token=${accessToken}`);
      if (!res.ok) throw new Error(`Instagram profile fetch failed: ${await res.text()}`);
      const data = await res.json();
      return {
        platformUserId: data.id,
        username: data.username ?? null,
        followerCount: Number(data.followers_count ?? 0),
        avatarUrl: data.profile_picture_url ?? null,
      };
    },
  },

  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    // user.info.basic covers follower_count/bio/avatar as of the current
    // (post-Feb-2024 migration) scope split. TikTok has no audience-
    // demographics endpoint for commercial apps at all, reviewed or not —
    // that's Research-API-only and restricted to academic access.
    scope: "user.info.basic",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
      const data = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri,
      });
      return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresInSeconds: data.expires_in ?? null };
    },
    async fetchProfile(accessToken) {
      const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,avatar_url", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`TikTok profile fetch failed: ${await res.text()}`);
      const data = await res.json();
      const user = data.data?.user;
      if (!user) throw new Error("TikTok didn't return a profile for this token.");
      return {
        platformUserId: user.open_id,
        username: user.display_name ?? null,
        followerCount: Number(user.follower_count ?? 0),
        avatarUrl: user.avatar_url ?? null,
      };
    },
  },
};

export function isSupportedPlatform(value: string): value is SupportedPlatform {
  return value in PROVIDERS;
}
