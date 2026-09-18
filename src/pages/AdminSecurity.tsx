import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";

interface Factor {
  id: string;
  friendly_name?: string | null;
  status: "verified";
  created_at: string;
}

export default function AdminSecurity() {
  const { refreshAal } = useAuth();
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    // .totp only ever contains verified factors of that type (unverified
    // ones only show up in the combined .all list) — so anything here is
    // already the "real" enrolled authenticator, no separate filter needed.
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(formatSupabaseError(error, "Couldn't load your two-factor status"));
      return;
    }
    setFactors(data.totp);
  }

  useEffect(() => {
    load();
  }, []);

  const verified = factors?.[0];

  async function handleRemove() {
    if (!verified) return;
    setRemoving(true);
    setError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
      if (error) throw error;
      await refreshAal();
      // Removing the only factor drops this account below the level
      // /admin requires, so send them straight into setting up a new one
      // rather than leaving them on a page they're about to get bounced
      // from anyway.
      navigate("/mfa-setup?next=/admin");
    } catch (err) {
      setError(formatSupabaseError(err, "Couldn't remove two-factor authenticator"));
      setRemoving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-lg mb-1">Two-factor authentication</h2>
      <p className="text-sm text-billboard-inkSoft mb-6">Required for every admin account. Manage it here if you get a new device.</p>

      {factors === null ? (
        <div className="border-[3px] border-billboard-ink/15 rounded p-6 text-sm text-billboard-inkSoft" aria-busy="true">Loading…</div>
      ) : verified ? (
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-billboard-green" aria-hidden="true" />
            <p className="font-semibold text-sm">Authenticator app active</p>
          </div>
          <p className="text-xs text-billboard-inkSoft mb-4">
            {verified.friendly_name || "Authenticator"} · added {new Date(verified.created_at).toLocaleDateString()}
          </p>

          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="text-xs font-semibold underline text-billboard-red">
              Remove and set up a new one
            </button>
          ) : (
            <div className="border-2 border-billboard-red rounded p-3">
              <p className="text-xs font-semibold mb-3">
                You'll be signed out of admin access until you finish setting up a replacement — do this only if you have a new authenticator app ready right now.
              </p>
              <div className="flex gap-2">
                <button onClick={handleRemove} disabled={removing} className="text-xs font-bold bg-billboard-red text-white px-3 py-1.5 rounded disabled:opacity-60">
                  {removing ? "Removing…" : "Yes, remove it"}
                </button>
                <button onClick={() => setConfirming(false)} className="text-xs font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-sm text-billboard-inkSoft">
          No authenticator on file — this shouldn't be reachable while signed in as admin. If you're seeing this, reload the page.
        </div>
      )}

      {error && <p className="text-billboard-red text-xs font-semibold mt-3">{error}</p>}
    </div>
  );
}
