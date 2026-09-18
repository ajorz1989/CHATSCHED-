import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase";
import { formatSupabaseError } from "../../lib/supabaseErrors";
import { formatCurrency } from "../../lib/currency";
import { generateUniqueSlug, trackingUrl, utmTaggedUrl, buildEmbedSnippet } from "../../lib/campaignTracking";
import type { Campaign, CampaignStats, PublisherRequest, ChannelRequest } from "../../lib/types";

const inputClass = "w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm";
const labelClass = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
const btnClass =
  "bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60";

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-billboard-ink/10 last:border-b-0">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">{label}</p>
        <p className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`} title={value}>{value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:bg-billboard-paperDim transition shrink-0"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3">
      <div className="font-display text-lg">{value}</div>
      <div className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-0.5">{label}</div>
    </div>
  );
}

const STATUS_STYLE: Record<Campaign["status"], string> = {
  active: "bg-billboard-green text-white border-billboard-greenDeep",
  paused: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  archived: "bg-white text-billboard-inkSoft border-billboard-inkSoft",
};

export default function CampaignTracker() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [requests, setRequests] = useState<PublisherRequest[]>([]);
  const [channelRequests, setChannelRequests] = useState<ChannelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (!user) return;
    const [{ data: campaignData }, { data: statsData }, { data: reqData }, { data: chanData }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("campaign_stats").select("*").eq("owner_id", user.id),
      supabase.from("requests").select("id, publisher:publishers(name)").eq("business_id", user.id).order("created_at", { ascending: false }),
      supabase.from("channel_requests").select("id, creator:publishers(name)").eq("business_id", user.id).order("created_at", { ascending: false }),
    ]);
    setCampaigns((campaignData ?? []) as Campaign[]);
    const byId: Record<string, CampaignStats> = {};
    for (const s of (statsData ?? []) as CampaignStats[]) byId[s.campaign_id] = s;
    setStats(byId);
    setRequests((reqData ?? []) as unknown as PublisherRequest[]);
    setChannelRequests((chanData ?? []) as unknown as ChannelRequest[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function setStatus(c: Campaign, status: Campaign["status"]) {
    await supabase.from("campaigns").update({ status }).eq("id", c.id);
    load();
  }

  if (!user) return null;

  return (
    <div>
      <p className="text-sm text-billboard-inkSoft mb-4">
        Turn any campaign into a tracking link — one already booked through ChatSched, or a promotion running
        anywhere else entirely. Every click on the short link is logged automatically; paste the embed snippet
        on your own site to also count visits, leads, and conversions.
      </p>

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className={`${btnClass} mb-6`}>
          + New tracking link
        </button>
      )}

      {showForm && (
        <NewCampaignForm
          requests={requests}
          channelRequests={channelRequests}
          onCancel={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}

      {loading ? (
        <div className="border-2 border-billboard-ink rounded p-5 animate-pulse text-sm text-billboard-inkSoft">Loading your campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-center text-sm text-billboard-inkSoft">
          No tracking links yet — create one above to start measuring clicks, visits, leads, and conversions.
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} stats={stats[c.id]} onStatusChange={(s) => setStatus(c, s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewCampaignForm({
  requests,
  channelRequests,
  onCancel,
  onCreated,
}: {
  requests: PublisherRequest[];
  channelRequests: ChannelRequest[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [linkTo, setLinkTo] = useState(""); // "" | "request:<id>" | "channel:<id>"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user) return;
    if (name.trim().length < 2) { setError("Give the campaign a short name first."); return; }
    let url = destinationUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!url || !/^https?:\/\/.+\..+/.test(url)) { setError("Enter a valid destination URL — e.g. https://yourbusiness.co.za"); return; }

    setSaving(true);
    setError(null);
    const slug = await generateUniqueSlug(name);
    const [requestId, channelRequestId] = linkTo.startsWith("request:")
      ? [linkTo.slice(8), null]
      : linkTo.startsWith("channel:")
      ? [null, linkTo.slice(8)]
      : [null, null];

    const { error: insertError } = await supabase.from("campaigns").insert({
      owner_id: user.id,
      request_id: requestId,
      channel_request_id: channelRequestId,
      name: name.trim(),
      slug,
      destination_url: url,
      utm_campaign: slug,
    });
    setSaving(false);
    if (insertError) {
      setError(formatSupabaseError(insertError, "Couldn't create tracking link"));
      return;
    }
    onCreated();
  }

  const hasBookings = requests.length > 0 || channelRequests.length > 0;

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 space-y-3 bg-billboard-paperDim mb-6">
      <div>
        <label className={labelClass}>Campaign name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Sale" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Destination URL</label>
        <input
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="yourbusiness.co.za/winter-sale"
          className={inputClass}
        />
        <p className="text-xs text-billboard-inkSoft mt-1">Where a click should actually land — your site, a landing page, a WhatsApp link, anything.</p>
      </div>
      {hasBookings && (
        <div>
          <label className={labelClass}>Link to a ChatSched booking (optional)</label>
          <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className={inputClass}>
            <option value="">Not tied to a specific booking</option>
            {requests.map((r) => (
              <option key={`request:${r.id}`} value={`request:${r.id}`}>{r.publisher?.name ?? "Publisher"} — social media</option>
            ))}
            {channelRequests.map((r) => (
              <option key={`channel:${r.id}`} value={`channel:${r.id}`}>{r.creator?.name ?? "Creator"} — {r.channel_slug}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-billboard-red text-xs font-semibold">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="font-bold px-4 py-2.5">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className={btnClass}>
          {saving ? "Creating…" : "Create tracking link"}
        </button>
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  stats,
  onStatusChange,
}: {
  campaign: Campaign;
  stats: CampaignStats | undefined;
  onStatusChange: (status: Campaign["status"]) => void;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const clicks = stats?.clicks ?? 0;
  const visits = stats?.visits ?? 0;
  const leads = stats?.leads ?? 0;
  const conversions = stats?.conversions ?? 0;
  const ctr = clicks > 0 ? `${Math.round((visits / clicks) * 100)}%` : "—";
  const convRate = visits > 0 ? `${Math.round((conversions / visits) * 100)}%` : "—";

  const embedReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-display text-lg">{campaign.name}</p>
          <p className="text-xs text-billboard-inkSoft">Created {new Date(campaign.created_at).toLocaleDateString("en-ZA")}</p>
        </div>
        <span className={`font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 ${STATUS_STYLE[campaign.status]}`}>
          {campaign.status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Clicks" value={clicks} />
        <Stat label="Visits" value={visits} />
        <Stat label="Leads" value={leads} />
        <Stat label="Conversions" value={conversions} />
      </div>
      <p className="text-xs text-billboard-inkSoft mb-4">
        Click → visit rate: <strong className="text-billboard-ink">{ctr}</strong>
        {"  ·  "}Visit → conversion rate: <strong className="text-billboard-ink">{convRate}</strong>
        {stats?.conversion_value ? <> {"  ·  "}Conversion value: <strong className="text-billboard-ink">{formatCurrency(stats.conversion_value)}</strong></> : null}
      </p>

      <div className="border-2 border-billboard-ink rounded p-3.5 bg-white mb-3">
        <CopyField label="Short tracking link" value={trackingUrl(campaign.slug)} mono />
        <CopyField label="Direct link with UTM tags" value={utmTaggedUrl(campaign)} mono />
      </div>

      <button
        type="button"
        onClick={() => setShowEmbed((v) => !v)}
        className="text-xs font-semibold underline text-billboard-inkSoft mb-2"
      >
        {showEmbed ? "Hide" : "Show"} the embed snippet (tracks visits, leads &amp; conversions on your own site)
      </button>

      {showEmbed && (
        embedReady ? (
          <EmbedSnippet slug={campaign.slug} />
        ) : (
          <p className="text-xs text-billboard-inkSoft border-2 border-dashed border-billboard-ink rounded p-3">
            Supabase isn't configured in this environment yet, so the snippet can't be generated here — see .env.example.
          </p>
        )
      )}

      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-billboard-ink/10">
        {campaign.status !== "active" && (
          <button type="button" onClick={() => onStatusChange("active")} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep rounded px-2.5 py-1.5 hover:bg-billboard-green/10 transition">
            Activate
          </button>
        )}
        {campaign.status === "active" && (
          <button type="button" onClick={() => onStatusChange("paused")} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:bg-billboard-paperDim transition">
            Pause
          </button>
        )}
        {campaign.status !== "archived" && (
          <button type="button" onClick={() => onStatusChange("archived")} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-2.5 py-1.5 hover:bg-billboard-red/10 transition">
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

function EmbedSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = buildEmbedSnippet(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, slug);
  return (
    <div>
      <div className="relative">
        <pre className="text-[11px] font-mono bg-billboard-ink text-white rounded p-3.5 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="absolute top-2 right-2 font-mono text-[10px] font-semibold uppercase bg-billboard-yellow text-billboard-ink rounded px-2 py-1"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-billboard-inkSoft mt-2">
        Paste this right before <code className="font-mono bg-billboard-paperDim px-1 rounded">&lt;/body&gt;</code> on your
        landing page. It counts a visit automatically, and once you've wired up a form or checkout, call{" "}
        <code className="font-mono bg-billboard-paperDim px-1 rounded">window.chatschedTrack("lead")</code> or{" "}
        <code className="font-mono bg-billboard-paperDim px-1 rounded">window.chatschedTrack("conversion", 499)</code> to
        log the rest.
      </p>
    </div>
  );
}
