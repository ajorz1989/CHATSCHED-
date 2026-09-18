import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import Button from "../components/Button";

export default function MfaSetup() {
  const { user, profile, loading, aal, refreshAal, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/admin";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (loading || !user || profile?.role !== "admin") return;
    // Already has a verified factor — this page is for first-time setup
    // only, send them to the challenge instead so they don't end up with
    // two enrolled authenticators by accident.
    if (aal.next === "aal2") {
      navigate(`/mfa-verify?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }

    (async () => {
      try {
        // Clear out any unverified factor left over from an abandoned
        // attempt (closed tab mid-setup, etc.) before starting a fresh
        // one — otherwise Supabase accumulates orphaned factors and the
        // QR code shown here wouldn't match the current enrollment.
        // listFactors().data.totp only ever contains verified factors of
        // that type — unverified ones only show up in .all.
        const { data: existing } = await supabase.auth.mfa.listFactors();
        const stale = existing?.all.find((f) => f.factor_type === "totp" && f.status === "unverified");
        if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
        if (error) throw error;
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err) {
        reportError(err, { source: "MfaSetup.enroll" });
        setError("Couldn't start setup. Try reloading the page.");
      } finally {
        setPreparing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile, aal.next]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== "admin") return <Navigate to="/" replace />;

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      await refreshAal();
      navigate(next, { replace: true });
    } catch (err) {
      setError("That code didn't work — check your device's clock is correct and try again.");
      reportError(err, { source: "MfaSetup.verify" });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Set Up Two-Factor Authentication · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Admin security</span>
      <h1 className="text-3xl mb-2">Set up two-factor login.</h1>
      <p className="text-billboard-inkSoft mb-8">
        Admin accounts require an authenticator app on top of your password — this only takes a minute and you won't be asked to do it again on this device.
      </p>

      {preparing ? (
        <div className="border-[3px] border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm" aria-busy="true">Preparing setup…</div>
      ) : !factorId ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-center text-sm text-billboard-inkSoft">
          {error ?? "Something went wrong."}
        </div>
      ) : (
        <>
          <div className="border-[3px] border-billboard-ink rounded p-6 mb-5">
            <p className="text-sm font-semibold mb-3">1. Scan this with an authenticator app</p>
            <p className="text-xs text-billboard-inkSoft mb-4">Google Authenticator, Authy, 1Password, or any other TOTP app works.</p>
            {qrCode && (
              <div className="bg-white border-2 border-billboard-ink rounded p-3 w-fit mx-auto mb-4">
                {/* Deliberately no loading="lazy" — the whole point of this
                    step is scanning this code right now; deferring it would
                    work against the one thing the user came here to do. */}
                <img src={qrCode} alt="Scan this QR code with your authenticator app" width={180} height={180} />
              </div>
            )}
            {secret && (
              <details className="text-xs text-billboard-inkSoft">
                <summary className="cursor-pointer font-semibold text-billboard-ink">Can't scan it? Enter this code manually</summary>
                <p className="font-mono mt-2 break-all border-2 border-billboard-ink/15 rounded px-2 py-1.5 bg-billboard-paperDim">{secret}</p>
              </details>
            )}
          </div>

          <form onSubmit={handleVerify} className="border-[3px] border-billboard-ink rounded p-6">
            <p className="text-sm font-semibold mb-3">2. Enter the 6-digit code it shows</p>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em] mb-4"
              placeholder="000000"
            />
            {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
            <Button type="submit" variant="primary" size="md" disabled={verifying || code.length !== 6} className="w-full">
              {verifying ? "Verifying…" : "Confirm and continue"}
            </Button>
          </form>
        </>
      )}

      <p className="text-xs text-billboard-inkSoft mt-6 text-center">
        Not ready right now? <button onClick={() => signOut()} className="underline font-semibold text-billboard-ink">Sign out</button> and come back once you have your authenticator app handy.
      </p>
      <p className="text-xs text-billboard-inkSoft mt-2 text-center">
        Losing access to your authenticator later means asking another admin — or you, via the Supabase dashboard — to remove this factor so you can set up a new one.
      </p>
    </div>
  );
}
