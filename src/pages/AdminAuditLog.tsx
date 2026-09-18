import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { StatCardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import ExportCsvButton from "../components/ExportCsvButton";
import type { CsvRow } from "../lib/csvExport";
import type { AdminAuditLogEntry } from "../lib/types";

/**
 * Admin visibility into admin_audit_log (schema_phase15_audit_log.sql) —
 * closes the gap flagged in PHASE7_CAMPAIGN_AUTO_ADVANCE_DELIVERY.md's
 * "Not done": that table has been recording real admin (and system)
 * actions since Phase 15 — deliverable verification, compliance rule
 * changes, proof/review decisions, self-service phone verification, and
 * agency campaign auto-advances — with no way to see any of it except a
 * direct SQL query. This is that viewer, for all of it.
 *
 * Read-only is not a gap here, unlike the pagination/filter/export that
 * originally shipped without it. An audit log you can edit from its own
 * viewer isn't an audit log — phase15's own schema comment says as much.
 * Nothing about this delivery adds a write path, on purpose.
 *
 * Rendered as a tab inside Admin.tsx, same pattern as every admin
 * sub-page since Phase 3.
 *
 * Deliberately generic rather than hardcoding a label/layout per action
 * type: action strings are partly dynamic (`'proof_' || p_status`,
 * `'compliance_review_' || p_status` — schema_phase39_compliance.sql),
 * so a switch statement enumerating known actions would already be
 * incomplete on day one.
 */

const ROW_LIMIT = 200;

interface EntryWithAdminName extends AdminAuditLogEntry {
  adminName: string;
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function buildAuditLogRows(rows: EntryWithAdminName[]): CsvRow[] {
  return rows.map((r) => ({
    Timestamp: r.created_at,
    Action: humanize(r.action),
    By: r.admin_id === null ? "System" : r.adminName,
    Table: r.target_table,
    "Target ID": r.target_id ?? "",
    Detail: r.detail ? JSON.stringify(r.detail) : "",
  }));
}

export default function AdminAuditLog() {
  const [rows, setRows] = useState<EntryWithAdminName[]>([]);
  const [allActions, setAllActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasMore, setHasMore] = useState(false);

  // Decoupled from the paginated fetch below and from any filter, on
  // purpose — the filter dropdown should always list every action that's
  // ever been logged, not just whatever happens to be on the currently
  // loaded page. Just one skinny text column, cheap regardless of table size.
  async function loadActions() {
    const { data } = await supabase.from("admin_audit_log").select("action");
    if (data) {
      setAllActions(Array.from(new Set(data.map((d) => d.action))).sort());
    }
  }

  async function loadPage(reset: boolean) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    let query = supabase
      .from("admin_audit_log")
      .select(
        "id, admin_id, action, target_table, target_id, detail, created_at, admin:profiles!admin_id(full_name)"
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(ROW_LIMIT);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
    // Keyset pagination on (created_at, id), not created_at alone — two
    // entries sharing an exact timestamp at a page boundary could
    // otherwise duplicate or skip depending on which side of the cursor
    // they land on. id is the tiebreak precisely because the order-by
    // above sorts on it second: "everything strictly older, plus
    // same-instant rows with a smaller id" is the correct next page
    // regardless of how many rows share a timestamp.
    if (!reset && rows.length > 0) {
      const last = rows[rows.length - 1];
      query = query.or(
        `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = (await query) as any;

    if (err) {
      setError(formatSupabaseError(err, "Couldn't load the audit log"));
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: EntryWithAdminName[] = (data ?? []).map((r: any) => ({
      ...r,
      adminName: r.admin?.full_name || "System",
    }));
    setRows((prev) => (reset ? mapped : [...prev, ...mapped]));
    setHasMore(mapped.length === ROW_LIMIT);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    loadPage(true);
    // Filters changing means the current page window is invalid —
    // reload from the top rather than trying to patch it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, dateFrom, dateTo]);

  if (loading) return <StatCardGridSkeleton count={4} />;

  const systemCount = rows.filter((r) => r.admin_id === null).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
        >
          <option value="all">All actions</option>
          {allActions.map((a) => (
            <option key={a} value={a}>
              {humanize(a)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono"
          aria-label="From date"
        />
        <span className="text-xs text-billboard-inkSoft">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono"
          aria-label="To date"
        />
        <ExportCsvButton label="Export CSV" filenameBase="audit-log" rows={buildAuditLogRows(rows)} />
        <p className="text-xs text-billboard-inkSoft ml-auto">
          {rows.length} loaded · {systemCount} system-originated
        </p>
      </div>

      {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState kind="list" title="Nothing logged yet" compact />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((entry) => (
              <div key={entry.id} className="border-2 border-billboard-ink rounded p-3 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] font-semibold uppercase">{humanize(entry.action)}</span>
                  <span className="text-[11px] text-billboard-inkSoft">
                    by {entry.admin_id === null ? <em>System</em> : entry.adminName}
                  </span>
                  <span className="text-[11px] text-billboard-inkSoft ml-auto">{relativeTime(entry.created_at)}</span>
                </div>
                <p className="text-[11px] text-billboard-inkSoft mb-1">
                  {entry.target_table} · {shortId(entry.target_id)}
                </p>
                {entry.detail && Object.keys(entry.detail).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {Object.entries(entry.detail).map(([k, v]) => (
                      <span key={k} className="text-[11px] text-billboard-inkSoft">
                        <span className="font-semibold">{humanize(k)}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => loadPage(false)}
                disabled={loadingMore}
                className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2 hover:bg-billboard-paperDim transition disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
