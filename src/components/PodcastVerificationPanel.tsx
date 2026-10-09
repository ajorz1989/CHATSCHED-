import { useState } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { describeEdgeFunctionError } from "../lib/edgeFunctionError";
import { listedShowUrl, PODCAST_REASON_TEXT, podcastSnippet, type PodcastCheckReason } from "../lib/podcastVerification";
import { CopyField } from "./WebsiteVerificationPanel";
import type { Publisher } from "../lib/types";

/**
 * Podcast ownership check. The owner gets a short code (the same generator the
 * social bio and website checks use) and pastes it into their show description or
 * an episode's notes. "Check my podcast" asks the verify-podcast-ownership
 * function to read the show's RSS feed; if the code is in it the listing is marked
 * ownership-confirmed. An admin can also confirm by hand from the review screen.
 */
export default function PodcastVerificationPanel({ publisher, onChange }: { publisher: Publisher; onChange: () => void }) {
  const showUrl = listedShowUrl(publisher.channel_metadata);
  const code = publisher.social_verification_code;
  const confirmed = publisher.social_verification_confirmed;

  const [generating, setGenerating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [reason, setReason] = useState<PodcastCheckReason | null>(null);

  async function generateCode() {
    setGenerating(true);
    setCodeError(null);
    setReason(null);
    try {
      const { data, error } = await supabase.rpc("generate_social_verification_code", { p_publisher_id: publisher.id });
      if (error || !data) {
        setCodeError(formatSupabaseError(error, "Couldn't generate a code — try again."));
        reportError(error, { source: "PodcastVerificationPanel.generateCode" });
      } else {
        onChange();
      }
    } catch (err) {
      reportError(err, { source: "PodcastVerificationPanel.generateCode" });
      setCodeError("Couldn't reach the server. Check your connection and try again.");
    }
    setGenerating(false);
  }

  async function checkNow() {
    setChecking(true);
    setCheckError(null);
    setReason(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-podcast-ownership", { body: { publisher_id: publisher.id } });
      if (error || data?.error) {
        setCheckError(data?.error ?? (await describeEdgeFunctionError(error, "Couldn't run the check — try again.")));
        reportError(error ?? data?.error, { source: "PodcastVerificationPanel.check" });
      } else if (data?.verified) {
        onChange();
      } else {
        setReason((data?.reason as PodcastCheckReason) ?? "code_not_found");
      }
    } catch (err) {
      reportError(err, { source: "PodcastVerificationPanel.check" });
      setCheckError("Couldn't reach the server. Check your connection and try again.");
    }
    setChecking(false);
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
      <h2 className="font-display text-lg mb-1">Verify your podcast</h2>
      <p className="text-sm text-billboard-inkSoft mb-5">
        Add a short code to your show description or an episode's notes so we know the show is really yours.
        We read your RSS feed{showUrl ? <> (<strong className="break-all">{showUrl}</strong>)</> : ""} to find it.
      </p>

      {!showUrl && (
        <p role="alert" className="text-sm font-semibold text-billboard-red border-2 border-billboard-red/30 bg-billboard-red/10 rounded p-2.5 mb-4">
          Your listing doesn't have an RSS feed address yet. Add it to your listing first, then come back here.
        </p>
      )}

      {confirmed ? (
        <div className="border-2 border-billboard-green rounded p-3 mb-2 bg-[#EAF3EC] flex items-center gap-2">
          <span className="text-billboard-greenDeep font-bold">✓</span>
          <p className="text-sm font-semibold text-billboard-greenDeep">
            Podcast verified{publisher.social_verification_confirmed_at ? ` on ${new Date(publisher.social_verification_confirmed_at).toLocaleDateString("en-ZA")}` : ""}.
          </p>
        </div>
      ) : (
        <>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2">Step 1 · Your verification code</p>
          {code && (
            <div className="border-2 border-billboard-ink rounded p-3 mb-2">
              <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Your code</p>
              <p className="text-lg font-bold font-mono tracking-wider">{code}</p>
            </div>
          )}
          <button
            type="button"
            onClick={generateCode}
            disabled={generating || !showUrl}
            className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-white disabled:opacity-60 mb-1"
          >
            {generating ? "Generating…" : code ? "Get a new code" : "Get my code"}
          </button>
          {code && <p className="text-xs text-billboard-inkSoft">A new code replaces this one, so use whichever you see here.</p>}
          {codeError && <p className="text-billboard-red text-xs font-semibold mt-1">{codeError}</p>}

          {code && (
            <>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 2 · Put it in your show</p>
              <div className="border-2 border-billboard-ink/20 rounded p-3">
                <p className="text-sm font-semibold">Paste this line into your show description <span className="font-normal text-billboard-inkSoft">— or into the notes of any recent episode</span></p>
                <p className="text-xs text-billboard-inkSoft">Do this in your podcast host's dashboard (Spotify for Creators, Buzzsprout, Podbean and so on), then save and publish. You can remove it once you're verified.</p>
                <CopyField label="Line to paste" value={podcastSnippet(code)} />
              </div>

              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 3 · Check it</p>
              <button
                type="button"
                onClick={checkNow}
                disabled={checking}
                className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-billboard-yellow disabled:opacity-60"
              >
                {checking ? "Reading your feed…" : "Check my podcast now"}
              </button>
              {checkError && <p role="alert" className="text-billboard-red text-xs font-semibold mt-2">{checkError}</p>}
              {reason && (
                <div role="status" className="mt-3 border-2 border-billboard-yellow rounded p-3 bg-[#FFF8E1]">
                  <p className="text-sm font-semibold mb-1">We couldn't confirm your podcast yet.</p>
                  <p className="text-xs text-billboard-inkSoft">{PODCAST_REASON_TEXT[reason]}</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <p className="text-xs text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-6">
        We only read the feed address in your listing, looking for the code. We never ask for your podcast host password.
      </p>
    </div>
  );
}
