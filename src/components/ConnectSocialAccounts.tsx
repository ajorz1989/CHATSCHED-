import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";

/** Kept separate from src/lib/constants.ts's PLATFORMS list on purpose — that
 * list is every platform a listing can claim to be *on*; this is only the
 * ones with a real, free, OAuth-based way to import follower data. Overlap,
 * not duplication: adding a platform to PLATFORMS doesn't mean it belongs
 * here too. See supabase/DEPLOY.md ("Social account connect") for exactly
 * why the "why not" list is what it is, and whether that's changed since.
 */
const SUPPORTED: { platform: string; label: string; badge: string; color: string }[] = [
  { platform: "youtube", label: "YouTube", badge: "YT", color: "bg-[#FF0000] text-white" },
  { platform: "facebook_page", label: "Facebook Page", badge: "f", color: "bg-[#1877F2] text-white" },
  { platform: "instagram", label: "Instagram", badge: "IG", color: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white" },
  { platform: "tiktok", label: "TikTok", badge: "TT", color: "bg-billboard-ink text-white" },
];

const NOT_YET: { label: string; badge: string; reason: string }[] = [
  { label: "X", badge: "X", reason: "X removed free API access in 2026 — every read now costs money per call, with no way around it. Not worth passing that cost on per creator right now." },
  { label: "LinkedIn", badge: "in", reason: "LinkedIn's follower/audience API is restricted to approved marketing partners — not something a solo developer can self-serve access to." },
  { label: "Facebook Group", badge: "Gr", reason: "Groups have no public API for member counts the way Pages do — only the group's own admins can see that, and not via a general OAuth grant." },
  { label: "WhatsApp Channel", badge: "WA", reason: "WhatsApp Channels have no public API for follower counts at all yet." },
];

interface PlatformStat {
  platform: string;
  follower_count: number;
  platform_username: string | null;
  synced_at: string;
}

export default function ConnectSocialAccounts({ publisherId }: { publisherId: string }) {
  const [stats, setStats] = useState<PlatformStat[] | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("publisher_platform_stats").select("platform, follower_count, platform_username, synced_at").eq("publisher_id", publisherId);
    setStats(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisherId]);

  async function handleConnect(platform: string) {
    setConnecting(platform);
    setConnectError(null);
    try {
      // CHANGED (security fix): this used to build a URL with the user's
      // Supabase access token as a `?access_token=...` query param and
      // navigate the browser straight to it — a bearer credential sitting
      // in a URL, and therefore a candidate for browser history, proxy/
      // server logs, and analytics/monitoring systems. supabase.functions.invoke
      // sends that same credential as a real Authorization header instead
      // (never logged the way a URL is), and the function hands back the
      // provider's authorize URL for the browser to navigate to itself —
      // see social-oauth-start/index.ts for the full explanation of why
      // that two-step shape is necessary (a fetch can't perform the
      // top-level navigation a real OAuth consent screen needs).
      const { data, error } = await supabase.functions.invoke("social-oauth-start", { body: { platform, publisher_id: publisherId } });
      if (error || !data?.url) {
        setConnectError(data?.error ?? "Couldn't start the connection — try again.");
        reportError(error ?? data?.error, { source: "ConnectSocialAccounts.connect", platform });
        setConnecting(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      reportError(err, { source: "ConnectSocialAccounts.connect", platform });
      setConnectError("Couldn't start the connection — try again.");
      setConnecting(null);
    }
  }

  async function handleSummarize() {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-publisher-audience", { body: { publisher_id: publisherId } });
      if (error || data?.error) {
        setSummaryError(data?.error ?? "Couldn't generate a summary — try again.");
        reportError(error ?? data?.error, { source: "ConnectSocialAccounts.summarize" });
        setSummarizing(false);
        return;
      }
      setSummary(data.summary);
      setSummarizing(false);
    } catch (err) {
      // Same as handleConnect above — a genuine network failure throws
      // here instead of returning an { error } result.
      reportError(err, { source: "ConnectSocialAccounts.summarize" });
      setSummaryError("Couldn't reach the server. Check your connection and try again.");
      setSummarizing(false);
    }
  }

  const connectedPlatforms = new Set((stats ?? []).map((s) => s.platform));

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
      <h2 className="font-display text-lg mb-1">Connect your social account</h2>
      <p className="text-sm text-billboard-inkSoft mb-5">
        We'll automatically import your available profile and audience information so you don't have to enter it manually.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        {SUPPORTED.map(({ platform, label, badge, color }) => {
          const stat = (stats ?? []).find((s) => s.platform === platform);
          const isConnected = connectedPlatforms.has(platform);
          return (
            <div key={platform} className="border-2 border-billboard-ink rounded p-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded flex items-center justify-center font-bold text-xs shrink-0 ${color}`}>{badge}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                {isConnected && stat ? (
                  <p className="text-xs text-billboard-inkSoft">
                    {stat.follower_count.toLocaleString()} followers{stat.platform_username ? ` · @${stat.platform_username}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-billboard-inkSoft">Not connected</p>
                )}
              </div>
              <button
                onClick={() => handleConnect(platform)}
                disabled={connecting === platform}
                className={`text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink shrink-0 disabled:opacity-60 ${isConnected ? "bg-white" : "bg-billboard-yellow"}`}
              >
                {connecting === platform ? "…" : isConnected ? "Reconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      {connectError && <p className="text-billboard-red text-xs font-semibold mb-3">{connectError}</p>}

      <details className="mb-5">
        <summary className="text-xs font-semibold text-billboard-inkSoft cursor-pointer">
          {NOT_YET.length} more platform{NOT_YET.length === 1 ? "" : "s"} not connectable yet — why?
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {NOT_YET.map((p) => (
            <div key={p.label} className="border-2 border-dashed border-billboard-ink/30 rounded p-3 flex items-start gap-3">
              <span className="w-9 h-9 rounded flex items-center justify-center font-bold text-xs shrink-0 bg-billboard-paperDim text-billboard-inkSoft">{p.badge}</span>
              <div>
                <p className="text-sm font-semibold text-billboard-inkSoft">{p.label}</p>
                <p className="text-xs text-billboard-inkSoft">{p.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </details>

      <p className="text-xs text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mb-4">
        We only access information you authorize. Your login credentials are never shared with ChatSched.
      </p>

      {connectedPlatforms.size > 0 && (
        <div className="border-2 border-billboard-ink/15 rounded p-4 bg-billboard-paperDim">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold">Audience summary</p>
            <button onClick={handleSummarize} disabled={summarizing} className="text-xs font-semibold underline text-billboard-inkSoft disabled:opacity-60">
              {summarizing ? "Generating…" : summary ? "Regenerate" : "Generate with AI"}
            </button>
          </div>
          {summaryError && <p className="text-billboard-red text-xs font-semibold">{summaryError}</p>}
          {summary && <p className="text-sm text-billboard-inkSoft">{summary}</p>}
          {!summary && !summaryError && <p className="text-xs text-billboard-inkSoft">Written from your real connected follower counts — nothing invented.</p>}
        </div>
      )}
    </div>
  );
}
