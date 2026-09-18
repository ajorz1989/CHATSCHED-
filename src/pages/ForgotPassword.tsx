import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import Button from "../components/Button";

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await resetPasswordForEmail(email);
    setLoading(false);
    // Supabase's resetPasswordForEmail doesn't report whether the address
    // exists (by design, to avoid account enumeration) — so any error here
    // is a real one (rate limit, network) worth surfacing, not a "wrong
    // email" case to hide.
    if (error) setError(error);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <Seo title="Check Your Email · ChatSched" noindex />
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center text-2xl">
          ✉️
        </div>
        <h1 className="text-2xl mb-2">Check your email</h1>
        <p className="text-billboard-inkSoft mb-8">
          If an account exists for <span className="font-semibold text-billboard-ink">{email}</span>, we've sent a link to reset the password. It'll expire after a while, so use it soon.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Reset Password · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Reset password</span>
      <h1 className="text-3xl mb-2">Forgot your password?</h1>
      <p className="text-billboard-inkSoft mb-8">Enter the email on your account and we'll send you a link to set a new one.</p>

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" autoFocus />
        </div>
        {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
        <Button type="submit" variant="primary" size="md" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-sm text-billboard-inkSoft mt-5 text-center">
        <Link to="/login" className="font-semibold underline text-billboard-ink">← Back to log in</Link>
      </p>
    </div>
  );
}
