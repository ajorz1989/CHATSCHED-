import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import Button from "../components/Button";

export default function MfaVerify() {
  const { user, profile, loading, aal, refreshAal, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/admin";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (loading || !user || profile?.role !== "admin") return;
    // No verified factor to challenge — send them to set one up instead.
    if (aal.next !== "aal2") {
      navigate(`/mfa-setup?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    // Already cleared for this session (e.g. they hit back after
    // verifying) — nothing to do here.
    if (aal.current === "aal2") {
      navigate(next, { replace: true });
      return;
    }

    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        reportError(error, { source: "MfaVerify.listFactors" });
        setError("Couldn't load your authenticator. Try reloading the page.");
        setPreparing(false);
        return;
      }
      const verified = data.totp[0];
      setFactorId(verified?.id ?? null);
      setPreparing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile, aal.current, aal.next]);

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
      reportError(err, { source: "MfaVerify.verify" });
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Verify Login · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Admin security</span>
      <h1 className="text-3xl mb-2">Enter your code.</h1>
      <p className="text-billboard-inkSoft mb-8">Open your authenticator app and enter the current 6-digit code.</p>

      {preparing ? (
        <div className="border-[3px] border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm" aria-busy="true">Checking…</div>
      ) : !factorId ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-center text-sm text-billboard-inkSoft">
          {error ?? "No verified authenticator found on this account."}
        </div>
      ) : (
        <form onSubmit={handleVerify} className="border-[3px] border-billboard-ink rounded p-6">
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
            {verifying ? "Verifying…" : "Verify"}
          </Button>
        </form>
      )}

      <p className="text-xs text-billboard-inkSoft mt-6 text-center">
        Lost your authenticator? <button onClick={() => signOut()} className="underline font-semibold text-billboard-ink">Sign out</button> and ask another admin (or use the Supabase dashboard) to remove this factor from your account.
      </p>
    </div>
  );
}
