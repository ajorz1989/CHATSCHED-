import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { exportAccountData, downloadAccountData, downloadAccountDataAsPdf } from "../lib/accountExport";
import { formatSupabaseError } from "../lib/supabaseErrors";
import SetupNotice from "../components/SetupNotice";
import SubscriptionSection from "../components/SubscriptionSection";
import FeaturedPlacementSection from "../components/FeaturedPlacementSection";
import Seo from "../components/Seo";

const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

export default function AccountSettings() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Export state ────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Cached export so a PDF download after JSON doesn't re-fetch
  const [cachedExport, setCachedExport] = useState<Record<string, unknown> | null>(null);

  // ── Delete state ─────────────────────────────────────────────────────────
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  // Tracks whether deletion actually completed server-side
  const [deleteVerified, setDeleteVerified] = useState(false);

  // ── Publisher id for FeaturedPlacementSection ────────────────────────────
  const [ownPublisherId, setOwnPublisherId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== "publisher") return;
    let cancelled = false;
    supabase
      .from("publishers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOwnPublisherId(data?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile?.role]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // ── Shared fetch helper ──────────────────────────────────────────────────
  async function getExportData(): Promise<Record<string, unknown>> {
    if (cachedExport) return cachedExport;
    const data = await exportAccountData(user!.id);
    setCachedExport(data);
    return data;
  }

  // ── Export handlers ──────────────────────────────────────────────────────
  async function handleExportJson() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await getExportData();
      downloadAccountData(data);
    } catch (err) {
      setExportError(formatSupabaseError(err, "Couldn't generate account data export"));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setExportError(null);
    try {
      const data = await getExportData();
      downloadAccountDataAsPdf(data);
    } catch (err) {
      setExportError(formatSupabaseError(err, "Couldn't generate PDF export"));
    } finally {
      setExportingPdf(false);
    }
  }

  // ── Delete handler ───────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    // BUG FIX: clear previous blockers each attempt so a resolved blocker
    // doesn't persist on screen after the user fixes it and tries again.
    setBlockers(null);
    setDeleteVerified(false);

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });

      if (error || data?.error) {
        if (data?.blockers) {
          setBlockers(data.blockers);
        } else {
          setDeleteError(formatSupabaseError(error || data?.error, "Couldn't delete your account"));
        }
        return;
      }

      // BUG FIX: verify the account is actually gone before signing out.
      // The edge function can return { data: null, error: null } even when
      // auth.admin.deleteUser silently fails. We confirm by trying to fetch
      // the profile — if it returns data the delete didn't complete.
      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user!.id)
        .maybeSingle();

      if (profileCheck) {
        // Profile still exists — deletion did not complete.
        setDeleteError(
          "Account deletion was not confirmed by the server. Your account is still active. Please try again or contact support."
        );
        return;
      }

      // Confirmed gone — sign out and redirect.
      setDeleteVerified(true);
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      // Genuine network failure — surface it clearly so the user doesn't
      // assume deletion is silently in progress.
      setDeleteError(formatSupabaseError(err, "Couldn't delete your account"));
    } finally {
      setDeleting(false);
    }
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="max-w-xl mx-auto px-5 py-16">
      <Seo title="Account Settings · ChatSched" noindex />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Account
      </span>
      <h1 className="text-3xl mb-2">Your data, your account.</h1>
      <p className="text-billboard-inkSoft mb-10">
        Download everything stored against your account, or close it for good.
      </p>

      {(profile?.role === "business" || profile?.role === "publisher") && (
        <SubscriptionSection userId={user.id} role={profile.role} />
      )}

      {profile?.role === "publisher" && ownPublisherId && (
        <FeaturedPlacementSection publisherId={ownPublisherId} />
      )}

      {/* ── Export your data ─────────────────────────────────────────────── */}
      <section className="border-[3px] border-billboard-ink rounded p-6 mb-6">
        <h2 className="font-display text-lg mb-1.5">Export your data</h2>
        <p className="text-sm text-billboard-inkSoft mb-1">
          Every record stored against your account — profile, requests, payments, messages, reviews,
          campaigns, disputes, notifications, and more. Nothing summarised or left out.
        </p>
        <p className="text-sm text-billboard-inkSoft mb-5">
          Choose <span className="font-semibold">JSON</span> for a complete machine-readable copy, or{" "}
          <span className="font-semibold">PDF</span> for a formatted, human-readable document you can
          save and share.
        </p>

        {exportError && (
          <p className="text-billboard-red text-xs font-semibold mb-3" role="alert">
            {exportError}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {/* JSON */}
          <button
            onClick={handleExportJson}
            disabled={exporting || exportingPdf}
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white disabled:opacity-60"
          >
            {exporting ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                Preparing…
              </>
            ) : (
              <>
                <span aria-hidden="true">⇩</span> Download JSON
              </>
            )}
          </button>

          {/* PDF */}
          <button
            onClick={handleExportPdf}
            disabled={exporting || exportingPdf}
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-billboard-yellow disabled:opacity-60"
          >
            {exportingPdf ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                Preparing PDF…
              </>
            ) : (
              <>
                <span aria-hidden="true">⇩</span> Download PDF
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-billboard-inkSoft mt-3">
          Your data is fetched live and never stored by this export tool. Both formats contain
          identical information.
        </p>
      </section>

      {/* ── Delete your account ──────────────────────────────────────────── */}
      <section className="border-[3px] border-billboard-red rounded p-6">
        <h2 className="font-display text-lg mb-1.5 text-billboard-red">Delete your account</h2>

        {isAdmin ? (
          <p className="text-sm text-billboard-inkSoft">
            Admin accounts can't be self-deleted here — remove the admin role first, or ask another
            admin to close this account for you.
          </p>
        ) : (
          <>
            <p className="text-sm text-billboard-inkSoft mb-4">
              Permanently deletes your login and removes your requests, payments, messages, reviews,
              and all other account data. This can't be undone — download your export above first if
              you want to keep a copy.
            </p>

            {/* Blockers */}
            {blockers && (
              <div className="border-2 border-billboard-red rounded p-3 mb-4" role="alert">
                <p className="text-xs font-semibold mb-1.5">
                  Can't delete yet — these need to be resolved first:
                </p>
                <ul className="text-xs text-billboard-inkSoft list-disc list-inside space-y-0.5">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Delete error */}
            {deleteError && (
              <p className="text-billboard-red text-xs font-semibold mb-4" role="alert">
                {deleteError}
              </p>
            )}

            {/* Confirm input */}
            <label className="block text-xs font-semibold mb-1.5">
              Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                // Clear errors when user starts retyping after a failed attempt
                if (deleteError) setDeleteError(null);
                if (blockers) setBlockers(null);
              }}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-billboard-red"
              placeholder={CONFIRM_PHRASE}
              aria-label={`Type ${CONFIRM_PHRASE} to confirm account deletion`}
              autoComplete="off"
              spellCheck={false}
            />

            <button
              onClick={handleDelete}
              disabled={deleting || confirmText !== CONFIRM_PHRASE || deleteVerified}
              className="w-full bg-billboard-red text-white border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {deleting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Deleting…
                </span>
              ) : (
                "Permanently delete my account"
              )}
            </button>

            <p className="text-xs text-billboard-inkSoft mt-3">
              Deletion is verified server-side before you are signed out. If the server cannot
              confirm removal, you will see an error and your account will remain active.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
