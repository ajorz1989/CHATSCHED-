import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { formatCurrency } from "../lib/currency";
import { SkeletonRows } from "../components/Skeleton";
import { getChannelBySlug } from "../lib/channelRegistry";
import { PLATFORM_COMMISSION_RATE } from "../lib/constants";
import Seo from "../components/Seo";
import type { PublisherRelationship } from "../lib/types";
import Button from "../components/Button";

interface LastCampaign {
  kind: "request" | "channel_request";
  campaign_message: string;
  budget: number | null;
  advertising_method: string | null;
  proposed_amount: number | null;
}

/**
 * /business/publishers — pivot brief section 29. "Worked with" means
 * paid (my_publisher_relationships(), schema_phase67) — a declined or
 * abandoned request was never a relationship. "Run Again" pre-fills from
 * whichever of that publisher's requests/channel_requests is most
 * recent, fetched with the business's own ordinary read access — no new
 * RLS needed, a business can already read its own rows.
 */
export default function BusinessPublisherRelationships() {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState<PublisherRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgainId, setRunningAgainId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("my_publisher_relationships")
      .then(({ data }) => {
        setRelationships((data ?? []) as PublisherRelationship[]);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <SkeletonRows count={4} />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Seo title="Publishers you've worked with" description="Your booking history with publishers on ChatSched, and one-click repeat bookings." />
      <h1 className="font-display text-2xl mb-1.5">Publishers you've worked with</h1>
      <p className="text-billboard-inkSoft text-sm mb-6">Every publisher you've completed a paid campaign with, and how it went.</p>

      {relationships.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          No completed campaigns yet — once you've paid for and finished a campaign, the publisher shows up here.
        </div>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => (
            <RelationshipCard
              key={rel.publisher_id}
              rel={rel}
              runningAgain={runningAgainId === rel.publisher_id}
              onToggleRunAgain={() => setRunningAgainId(runningAgainId === rel.publisher_id ? null : rel.publisher_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipCard({ rel, runningAgain, onToggleRunAgain }: { rel: PublisherRelationship; runningAgain: boolean; onToggleRunAgain: () => void }) {
  const channelName = getChannelBySlug(rel.channel_slug)?.definition.name ?? rel.channel_slug;
  return (
    <div className="border-[3px] border-billboard-ink rounded p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base">{rel.publisher_name}</p>
          <p className="text-xs text-billboard-inkSoft">
            {channelName} · {rel.city}, {rel.province}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-base">{formatCurrency(Number(rel.total_spent), { cents: true })}</p>
          <p className="text-xs text-billboard-inkSoft">
            {rel.campaign_count} campaign{rel.campaign_count === 1 ? "" : "s"}
            {rel.avg_rating != null && ` · ${Number(rel.avg_rating).toFixed(1)}★ from you`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <a
          href={`/browse/${rel.publisher_id}`}
          className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
        >
          View profile
        </a>
        <Button onClick={onToggleRunAgain} variant="dark" size="sm">
          {runningAgain ? "Cancel" : "Run again"}
        </Button>
      </div>

      {runningAgain && <RunAgainForm publisherId={rel.publisher_id} channelSlug={rel.channel_slug} onDone={onToggleRunAgain} />}
    </div>
  );
}

function RunAgainForm({ publisherId, channelSlug, onDone }: { publisherId: string; channelSlug: string; onDone: () => void }) {
  const { user } = useAuth();
  const [last, setLast] = useState<LastCampaign | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSocialMedia = channelSlug === "social-media";
  const ch = getChannelBySlug(channelSlug)?.definition;

  useEffect(() => {
    if (!user) return;
    async function loadLast() {
      if (isSocialMedia) {
        const { data } = await supabase
          .from("requests")
          .select("campaign_message, budget")
          .eq("business_id", user!.id)
          .eq("publisher_id", publisherId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLast(data ? { kind: "request", campaign_message: data.campaign_message, budget: data.budget, advertising_method: null, proposed_amount: null } : null);
      } else {
        const { data } = await supabase
          .from("channel_requests")
          .select("campaign_message, advertising_method, proposed_amount")
          .eq("business_id", user!.id)
          .eq("creator_id", publisherId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLast(
          data
            ? { kind: "channel_request", campaign_message: data.campaign_message, budget: null, advertising_method: data.advertising_method, proposed_amount: data.proposed_amount }
            : null
        );
      }
    }
    loadLast();
  }, [user, publisherId, isSocialMedia]);

  useEffect(() => {
    if (!last) return;
    setMessage(last.campaign_message);
    setAmount(String(last.budget ?? last.proposed_amount ?? ""));
    setMethod(last.advertising_method ?? "");
  }, [last]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !message.trim()) return;
    setSending(true);
    setError(null);
    const result = isSocialMedia
      ? await supabase.from("requests").insert({ publisher_id: publisherId, business_id: user.id, campaign_message: message.trim(), budget: amount ? Number(amount) : null })
      : await supabase
          .from("channel_requests")
          .insert({ channel_slug: channelSlug, creator_id: publisherId, business_id: user.id, campaign_message: message.trim(), advertising_method: method, proposed_amount: Number(amount) });
    setSending(false);
    if (result.error) {
      setError(formatSupabaseError(result.error, "Couldn't send that request"));
      return;
    }
    onDone();
  }

  if (last === undefined) return <p className="text-xs text-billboard-inkSoft mt-3">Loading your last campaign…</p>;
  if (last === null) {
    return <p className="text-xs text-billboard-inkSoft mt-3">Couldn't find a completed campaign with this publisher to copy from — start a fresh request from their profile instead.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t-2 border-billboard-ink/10 pt-3 space-y-2">
      <p className="text-xs text-billboard-inkSoft">Pre-filled from your last campaign — change anything before sending.</p>
      {!isSocialMedia && ch?.advertisingMethods && (
        <select required value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm">
          {ch.advertisingMethods.map((m) => (
            <option key={m.id} value={m.label}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
      <input
        required={!isSocialMedia}
        type="number"
        min={1}
        placeholder={isSocialMedia ? "Budget (R) — optional" : "Proposed amount (R)"}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm"
      />
      {!isSocialMedia && Number(amount) > 0 && (
        <p className="text-xs text-billboard-inkSoft">Publisher receives {formatCurrency(Number(amount) * (1 - PLATFORM_COMMISSION_RATE), { cents: true })} after commission.</p>
      )}
      {error && <p className="text-billboard-red text-xs font-semibold">{error}</p>}
      <Button type="submit" variant="dark" size="md" disabled={sending}>
        {sending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
