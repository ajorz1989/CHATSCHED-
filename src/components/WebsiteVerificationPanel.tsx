import { useState } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { describeEdgeFunctionError } from "../lib/edgeFunctionError";
import {
  listedDomain, METHOD_LABEL, websiteSnippets, type WebsiteCheckAttempt,
} from "../lib/websiteVerification";
import type { Publisher } from "../lib/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 break-all border-2 border-billboard-ink/20 rounded px-2 py-1.5 text-xs bg-billboard-paperDim/40">{value}</code>
        <button
          type="button"
          onClick={() => {
            try { void navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:bg-billboard-paperDim transition shrink-0"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * Website ownership check. The owner gets a short code (the same generator the
 * social bio check uses) and adds it to their site in ONE of three ways. The
 * "Check my website" button asks the verify-website-ownership function to look;
 * if it finds the code the listing is marked ownership-confirmed. An admin can
 * also confirm by hand from the review screen.
 */
export default function WebsiteVerificationPanel({ publisher, onChange }: { publisher: Publisher; onChange: () => void }) {
  const domain = listedDomain(publisher.channel_metadata);
  const code = publisher.social_verification_code;
  const confirmed = publisher.social_verification_confirmed;

  const [generating, setGenerating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<WebsiteCheckAttempt[] | null>(null);

  async function generateCode() {
    setGenerating(true);
    setCodeError(null);
    setAttempts(null);
    try {
      const { data, error } = await supabase.rpc("generate_social_verification_code", { p_publisher_id: publisher.id });
      if (error || !data) {
        setCodeError(formatSupabaseError(error, "Couldn't generate a code — try again."));
        reportError(error, { source: "WebsiteVerificationPanel.generateCode" });
      } else {
        onChange();
      }
    } catch (err) {
      reportError(err, { source: "WebsiteVerificationPanel.generateCode" });
      setCodeError("Couldn't reach the server. Check your connection and try again.");
    }
    setGenerating(false);
  }

  async function checkNow() {
    setChecking(true);
    setCheckError(null);
    setAttempts(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-website-ownership", { body: { publisher_id: publisher.id } });
      if (error || data?.error) {
        setCheckError(data?.error ?? (await describeEdgeFunctionError(error, "Couldn't run the check — try again.")));
        reportError(error ?? data?.error, { source: "WebsiteVerificationPanel.check" });
      } else if (data?.verified) {
        onChange();
      } else {
        setAttempts((data?.attempts ?? []) as WebsiteCheckAttempt[]);
      }
    } catch (err) {
      reportError(err, { source: "WebsiteVerificationPanel.check" });
      setCheckError("Couldn't reach the server. Check your connection and try again.");
    }
    setChecking(false);
  }

  const snippets = code ? websiteSnippets(code) : null;
  // Collapse the per-address results to one line per method.
  const byMethod = attempts
    ? (["meta_tag", "dns_txt", "well_known_file"] as const).map((m) => {
        const list = attempts.filter((a) => a.method === m);
        return { method: m, note: list.map((a) => a.note).find(Boolean) ?? "Not found." };
      })
    : [];

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
      <h2 className="font-display text-lg mb-1">Verify your website</h2>
      <p className="text-sm text-billboard-inkSoft mb-5">
        Add a short code to {domain ? <strong>{domain}</strong> : "your website"} so we know it's really yours. Pick whichever of the three ways is easiest — you only need one.
      </p>

      {!domain && (
        <p role="alert" className="text-sm font-semibold text-billboard-red border-2 border-billboard-red/30 bg-billboard-red/10 rounded p-2.5 mb-4">
          Your listing doesn't have a website address yet. Add it to your listing first (for example mysite.co.za), then come back here.
        </p>
      )}

      {confirmed ? (
        <div className="border-2 border-billboard-green rounded p-3 mb-2 bg-[#EAF3EC] flex items-center gap-2">
          <span className="text-billboard-greenDeep font-bold">✓</span>
          <p className="text-sm font-semibold text-billboard-greenDeep">
            Website verified{publisher.social_verification_confirmed_at ? ` on ${new Date(publisher.social_verification_confirmed_at).toLocaleDateString("en-ZA")}` : ""}.
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
            disabled={generating || !domain}
            className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-white disabled:opacity-60 mb-1"
          >
            {generating ? "Generating…" : code ? "Get a new code" : "Get my code"}
          </button>
          {code && <p className="text-xs text-billboard-inkSoft">A new code replaces this one, so use whichever you see here.</p>}
          {codeError && <p className="text-billboard-red text-xs font-semibold mt-1">{codeError}</p>}

          {snippets && (
            <>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 2 · Add it to your site (any one)</p>
              <div className="space-y-4">
                <div className="border-2 border-billboard-ink/20 rounded p-3">
                  <p className="text-sm font-semibold">A · Meta tag <span className="font-normal text-billboard-inkSoft">— easiest if you can edit your site's header</span></p>
                  <p className="text-xs text-billboard-inkSoft">Paste this line inside the &lt;head&gt; of your home page.</p>
                  <CopyField label="Meta tag" value={snippets.metaTag} />
                </div>
                <div className="border-2 border-billboard-ink/20 rounded p-3">
                  <p className="text-sm font-semibold">B · DNS record <span className="font-normal text-billboard-inkSoft">— where you manage your domain</span></p>
                  <p className="text-xs text-billboard-inkSoft">Add a TXT record. It can take a while to show up.</p>
                  <CopyField label="Type" value="TXT" />
                  <CopyField label="Host / name" value={snippets.dnsHost} />
                  <CopyField label="Value" value={snippets.dnsValue} />
                </div>
                <div className="border-2 border-billboard-ink/20 rounded p-3">
                  <p className="text-sm font-semibold">C · A small file <span className="font-normal text-billboard-inkSoft">— if your website builder won't let you edit the header</span></p>
                  <p className="text-xs text-billboard-inkSoft">Upload a plain text file that contains only the code.</p>
                  <CopyField label="File address" value={`https://${domain ?? "your-site"}${snippets.filePath}`} />
                  <CopyField label="File contents" value={snippets.fileContents} />
                </div>
              </div>

              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 3 · Check it</p>
              <button
                type="button"
                onClick={checkNow}
                disabled={checking}
                className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-billboard-yellow disabled:opacity-60"
              >
                {checking ? "Checking your site…" : "Check my website now"}
              </button>
              {checkError && <p role="alert" className="text-billboard-red text-xs font-semibold mt-2">{checkError}</p>}
              {attempts && (
                <div role="status" className="mt-3 border-2 border-billboard-yellow rounded p-3 bg-[#FFF8E1]">
                  <p className="text-sm font-semibold mb-1">We couldn't find your code yet.</p>
                  <ul className="text-xs text-billboard-inkSoft space-y-0.5">
                    {byMethod.map((m) => (
                      <li key={m.method}><strong>{METHOD_LABEL[m.method]}:</strong> {m.note}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-billboard-inkSoft mt-2">Changes to a site or DNS can take a few minutes (DNS sometimes hours). Try again once it's live. Not sure how? Ask whoever built your site to add the meta tag — it's one line.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <p className="text-xs text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-6">
        We only look for the code on the website address in your listing. We never ask for your passwords or access to your site.
      </p>
    </div>
  );
}
