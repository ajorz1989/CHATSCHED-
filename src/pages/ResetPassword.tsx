import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import Button from "../components/Button";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  // Supabase's recovery link authenticates the browser automatically
  // (detectSessionInUrl is on by default) and fires a PASSWORD_RECOVERY
  // auth event once that session is live — that's the actual signal a
  // recovery is in progress, not just "is someone logged in" (which would
  // also be true for an already-signed-in user who wandered here directly).
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Covers the case where the event already fired before this component
    // mounted (a slow render after the redirect) — an active session at
    // mount time on this specific page means the recovery link already did
    // its job.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) setError(error);
    else setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <Seo title="Password Updated · ChatSched" noindex />
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-billboard-green border-[3px] border-billboard-greenDeep flex items-center justify-center text-2xl text-white">✓</div>
        <h1 className="text-2xl mb-2">Password updated</h1>
        <p className="text-billboard-inkSoft mb-8">You're signed in with your new password.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm"
        >
          Go to dashboard →
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <Seo title="Reset Password · ChatSched" noindex />
        <h1 className="text-2xl mb-2">This link isn't active</h1>
        <p className="text-billboard-inkSoft mb-8">
          Password reset links only work right after you open them from the email, and expire after a while.
          Request a new one if this one's stale.
        </p>
        <Link to="/forgot-password" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Set New Password · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Reset password</span>
      <h1 className="text-3xl mb-2">Set a new password.</h1>
      <p className="text-billboard-inkSoft mb-8">Choose something you haven't used here before.</p>

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">New password</label>
          <input required type="password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" autoFocus />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Confirm password</label>
          <input required type="password" minLength={MIN_PASSWORD_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
        <Button type="submit" variant="primary" size="md" disabled={loading} className="w-full">
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
