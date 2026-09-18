import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getChannelBySlug } from "../lib/channelRegistry";
import { PLATFORM_COMMISSION_RATE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import Button from "./Button";
import type { ChannelSlug } from "../lib/channelTypes";

interface PublisherOption {
  id: string;
  name: string;
  city: string;
  province: string;
  channel_slug: ChannelSlug;
  accepted_ad_formats: string[] | null;
}

interface QueuedRequest {
  publisher: PublisherOption;
  method: string;
  amount: string;
}

/**
 * The admin-side equivalent of ChannelRequestForm.tsx / the ordinary
 * social-media request flow — same two destination shapes (`requests` for
 * channel_slug 'social-media', `channel_requests` for the 4 newer
 * channels), same "kicks off the pipeline, doesn't skip it" posture: the
 * creator still approves/declines/counters exactly as they would if the
 * business had submitted it themselves, and the business still pays
 * through the normal flow once that happens. The only difference is who
 * clicks submit and that business_id is the client's, not the caller's —
 * which is exactly what schema_phase64_admin_request_creation.sql's new
 * admin-only insert policies allow and nothing else.
 *
 * Bulk, closing PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md's own named
 * gap ("one publisher, one request, per submission — fine for assembling
 * a campaign a few bookings at a time, not for papering a 20-publisher
 * local-awareness package in one sitting"): search adds a publisher to a
 * queue rather than submitting immediately, one shared campaign message
 * covers the whole batch (this is one campaign brief going out to many
 * publishers, not N unrelated ones — per-row message editing would
 * invite the 20 rows silently drifting out of sync with each other), and
 * a single submit sends every queued row. Per-publisher method/amount
 * stays per-row since channel_requests.proposed_amount is genuinely
 * different per publisher (different rate cards) — the one field that
 * can't safely be shared.
 */
export default function CreateRequestForClient({
  businessId,
  agencyCampaignId,
  onCreated,
}: {
  businessId: string;
  agencyCampaignId: string;
  onCreated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublisherOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("publishers")
        .select("id, name, city, province, channel_slug, accepted_ad_formats")
        .ilike("name", `%${query.trim()}%`)
        // 'approved' — checked directly against the real schema and
        // every other publisher-status filter in this codebase
        // (Admin.tsx sets this exact value on approval, BusinessHomeSummary.tsx
        // and others filter on it). This search used 'reviewed' from the
        // day this component was built until a real-Postgres run caught
        // it: 'reviewed' isn't a value the status column's check
        // constraint even allows, so the search had been silently
        // returning zero results the entire time.
        .eq("status", "approved")
        .limit(8);
      if (!cancelled) {
        setResults((data ?? []) as PublisherOption[]);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function addToQueue(p: PublisherOption) {
    if (queue.some((q) => q.publisher.id === p.id)) {
      setQuery("");
      setResults([]);
      return; // already queued — search again for a different publisher
    }
    setQueue((prev) => [...prev, { publisher: p, method: "", amount: "" }]);
    setQuery("");
    setResults([]);
    setError(null);
  }

  function removeFromQueue(publisherId: string) {
    setQueue((prev) => prev.filter((q) => q.publisher.id !== publisherId));
  }

  function updateQueued(publisherId: string, patch: Partial<QueuedRequest>) {
    setQueue((prev) => prev.map((q) => (q.publisher.id === publisherId ? { ...q, ...patch } : q)));
  }

  function reset() {
    setQuery("");
    setMessage("");
    setQueue([]);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || queue.length === 0) return;

    // Validate every queued row up front — a partial validation failure
    // shouldn't burn a round trip, and it's cheap to catch here before
    // either insert.
    for (const q of queue) {
      const isSocialMedia = q.publisher.channel_slug === "social-media";
      if (!isSocialMedia && (!q.method || !(Number(q.amount) > 0))) {
        setError(`${q.publisher.name} is missing its advertising method or proposed amount.`);
        return;
      }
    }

    setSending(true);
    setError(null);

    const socialRows = queue.filter((q) => q.publisher.channel_slug === "social-media");
    const channelRows = queue.filter((q) => q.publisher.channel_slug !== "social-media");

    const succeededIds = new Set<string>();

    if (socialRows.length > 0) {
      const { error: socialError } = await supabase.from("requests").insert(
        socialRows.map((q) => ({
          publisher_id: q.publisher.id,
          business_id: businessId,
          campaign_message: message.trim(),
          budget: q.amount ? Number(q.amount) : null,
          agency_campaign_id: agencyCampaignId,
        }))
      );
      if (socialError) {
        setSending(false);
        setError(`Couldn't create the ${socialRows.length} social-media request(s): ${socialError.message}. Nothing else was sent — fix and retry.`);
        return;
      }
      socialRows.forEach((q) => succeededIds.add(q.publisher.id));
    }

    if (channelRows.length > 0) {
      const { error: channelError } = await supabase.from("channel_requests").insert(
        channelRows.map((q) => ({
          channel_slug: q.publisher.channel_slug,
          creator_id: q.publisher.id,
          business_id: businessId,
          campaign_message: message.trim(),
          advertising_method: q.method,
          proposed_amount: Number(q.amount),
          agency_campaign_id: agencyCampaignId,
        }))
      );
      setSending(false);
      if (channelError) {
        // The social-media batch above may already have gone through —
        // say so plainly rather than implying nothing happened. Only the
        // rows that actually failed stay queued, so retrying doesn't
        // resend the ones that already landed.
        setQueue((prev) => prev.filter((q) => !succeededIds.has(q.publisher.id)));
        const already = succeededIds.size > 0 ? ` The ${succeededIds.size} social-media request(s) above were already sent.` : "";
        setError(`Couldn't create the ${channelRows.length} channel request(s): ${channelError.message}.${already} Fix and retry the rest.`);
        return;
      }
    } else {
      setSending(false);
    }

    reset();
    onCreated();
  }

  const totalCount = queue.length;

  return (
    <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide mb-2">Create request(s) for this client</p>

      <textarea
        required
        placeholder="What's the campaign? (sent to every publisher you add below)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm bg-white mb-2"
      />

      <div className="relative">
        <input
          placeholder="Search publishers by name to add them…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm bg-white mb-2"
        />
        {(searching || results.length > 0) && (
          <div className="border-2 border-billboard-ink rounded bg-white -mt-1 mb-2 max-h-48 overflow-y-auto">
            {searching ? (
              <p className="text-xs text-billboard-inkSoft p-2">Searching…</p>
            ) : (
              results.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addToQueue(p)}
                  disabled={queue.some((q) => q.publisher.id === p.id)}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-billboard-paperDim border-b border-billboard-ink/10 last:border-b-0 disabled:opacity-40"
                >
                  {p.name} — {getChannelBySlug(p.channel_slug)?.definition.name ?? p.channel_slug} · {p.city}, {p.province}
                  {queue.some((q) => q.publisher.id === p.id) ? " (added)" : ""}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {queue.length > 0 && (
        <form onSubmit={submit} className="space-y-2">
          <div className="space-y-2">
            {queue.map((q) => {
              const ch = getChannelBySlug(q.publisher.channel_slug)?.definition;
              const isSocialMedia = q.publisher.channel_slug === "social-media";
              const availableMethods =
                ch?.advertisingMethods && q.publisher.accepted_ad_formats && q.publisher.accepted_ad_formats.length > 0
                  ? ch.advertisingMethods.filter((m) => q.publisher.accepted_ad_formats!.includes(m.label))
                  : ch?.advertisingMethods ?? [];

              return (
                <div key={q.publisher.id} className="border-2 border-billboard-ink/20 rounded p-2 bg-white">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold">
                      {q.publisher.name}{" "}
                      <span className="text-billboard-inkSoft font-normal">
                        — {ch?.name ?? q.publisher.channel_slug} · {q.publisher.city}, {q.publisher.province}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(q.publisher.id)}
                      className="font-mono text-[10px] font-semibold uppercase text-billboard-red shrink-0"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSocialMedia && (
                      // No `required` here on purpose: this is a batch of
                      // N rows, and the browser's native constraint
                      // validation stops at the *first* invalid field it
                      // finds and blocks the submit handler from ever
                      // running — so the friendly, publisher-specific
                      // error message below (submit()'s per-row check)
                      // would never actually show, for this row or any
                      // other. The JS check on submit is the real
                      // validation; this field just looks the part.
                      <select
                        value={q.method}
                        onChange={(e) => updateQueued(q.publisher.id, { method: e.target.value })}
                        className="flex-1 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="">Method…</option>
                        {availableMethods.map((m) => (
                          <option key={m.id} value={m.label}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      min={1}
                      placeholder={isSocialMedia ? "Budget (R) — optional" : `Amount (R), e.g. ${ch?.minBudgetZAR ?? ""}`}
                      value={q.amount}
                      onChange={(e) => updateQueued(q.publisher.id, { amount: e.target.value })}
                      className="flex-1 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs bg-white"
                    />
                  </div>
                  {!isSocialMedia && Number(q.amount) > 0 && (
                    <p className="text-[11px] text-billboard-inkSoft mt-1">
                      {q.publisher.name} would receive {formatCurrency(Number(q.amount) * (1 - PLATFORM_COMMISSION_RATE), { cents: true })} after commission.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-billboard-red text-xs font-semibold">{error}</p>}

          <div className="flex gap-2">
            <Button variant="dark" type="submit" disabled={sending}>
              {sending ? "Sending…" : `Create ${totalCount} request${totalCount === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" onClick={reset}>
              Clear
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
