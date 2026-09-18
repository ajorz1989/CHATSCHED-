import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import Button from "../components/Button";

function safeInternalPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate(nextPath);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    // On success, Supabase redirects away immediately — only failure
    // returns control here.
    if (error) { setError(error); setGoogleLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Log In · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Log in</span>
      <h1 className="text-3xl mb-2">Welcome back.</h1>
      <p className="text-billboard-inkSoft mb-8">Log in to track your requests and book campaigns.</p>

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">Forgot password?</Link>
          </div>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
        <Button type="submit" variant="primary" size="md" disabled={loading} className="w-full">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-billboard-paperDim" />
        <span className="text-[10px] font-mono uppercase text-billboard-inkSoft">or</span>
        <div className="flex-1 h-px bg-billboard-paperDim" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2.5 border-2 border-billboard-ink font-semibold text-sm py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60 bg-white"
      >
        <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="text-sm text-billboard-inkSoft mt-5 text-center">
        New here? <Link to="/register?role=business" className="font-semibold underline">Create a business account</Link> or <Link to="/register?role=publisher" className="font-semibold underline">apply as a publisher</Link>
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <Link to="/register?role=business" className="inline-flex items-center justify-center gap-2 border-[3px] border-billboard-ink bg-billboard-paper font-bold text-sm px-4 py-3 rounded hover:-translate-y-0.5 transition text-center">
          Register as a Business →
        </Link>
        <Link to="/register?role=publisher" className="inline-flex items-center justify-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold text-sm px-4 py-3 rounded hover:-translate-y-0.5 transition text-center">
          Become a Publisher →
        </Link>
      </div>
    </div>
  );
}
