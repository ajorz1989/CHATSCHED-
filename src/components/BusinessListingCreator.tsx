// "Create a publisher listing" card for a business account with Premium access.
//
// A business can list itself (or one of its own ad spaces) on the browse page.
// It is asked the SAME channel questions a normal publisher application asks
// (shared ChannelSpecificFields + channelOnboardingForm), and the answers are
// saved to channel_metadata so the browse card and profile show the channel's
// real numbers (visitors, covers, attendance...) instead of a generic
// "audience size". What happens next is decided server-side by
// create_business_publisher_listing() (see supabase/migrations): until the
// ownership checks for digital channels exist, every business listing is
// created as "pending review" and approved by ChatSched, like a normal
// application. The database refuses to approve the proof-required channels any
// other way. This component only collects the fields and shows the outcome.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { CATEGORIES, PROVINCES } from "../lib/constants";
import { getChannelBySlug, getPublisherOnboardingChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";
import { isAuthorityChannel, AUTHORITY_SUBJECT } from "../lib/channelOnboardingSchemas";
import { type FormState, initialState } from "../lib/channelOnboardingForm";
import { buildBusinessListingPayload, PROOF_REQUIRED_CHANNELS } from "../lib/businessListingPayload";
import ChannelSpecificFields, { AdFormatsPicker } from "./ChannelSpecificFields";
import Button from "./Button";

const inputCls = "w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-billboard-ink";
const labelCls = "block font-mono text-xs font-semibold uppercase tracking-wider mb-1";

export default function BusinessListingCreator({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelSlug | "">("");
  const [form, setForm] = useState<FormState>(initialState);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ id: string; live: boolean; digital: boolean } | null>(null);
  const channels = getPublisherOnboardingChannels();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const def = channel ? getChannelBySlug(channel)?.definition : undefined;
  const authority = channel ? isAuthorityChannel(channel) : false;
  const hasEngagement = channel === "social-media" || channel === "influencer";
  const needsProof = channel ? PROOF_REQUIRED_CHANNELS.includes(channel) : false;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!channel) {
      setError("Choose a channel.");
      return;
    }
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    if (needsProof && proofFiles.length === 0) {
      setError(`Add at least one photo or short video that shows the real ${def?.name.toLowerCase() ?? "listing"}. ChatSched reviews it before the listing is approved.`);
      return;
    }
    if (channel === "informal-retail" && !form.retailMunicipalRegistrationConfirmed) {
      setError("Confirm that the shop is registered with its local municipality.");
      return;
    }
    const built = buildBusinessListingPayload(
      channel,
      {
        name: str("name"), category: str("category"), city: str("city"), province: str("province"),
        suburb: str("suburb"), price: Number(str("price")), bio: str("bio"), audience: str("audience"),
      },
      form,
    );
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("create_business_publisher_listing", { p_listing: built.payload });
    if (rpcError) {
      setBusy(false);
      setError(formatSupabaseError(rpcError));
      return;
    }
    const res = data as { ok?: boolean; id?: string; live?: boolean } | null;
    if (!res?.id) {
      setBusy(false);
      setError("Something went wrong creating your listing. Please try again.");
      return;
    }
    // Proof is stored under the real listing id, so it can only be uploaded now.
    if (proofFiles.length > 0) {
      const uploaded: string[] = [];
      for (const file of proofFiles.slice(0, 5)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${res.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("publisher-verification-proof").upload(path, file, { cacheControl: "3600", upsert: false });
        if (!uploadErr) uploaded.push(path);
      }
      if (uploaded.length > 0) {
        await supabase.from("publishers").update({ verification_proof_urls: uploaded }).eq("id", res.id);
      }
    }
    setBusy(false);
    setResult({ id: res.id, live: !!res.live, digital: !authority });
    onCreated();
  }

  if (result) {
    return (
      <div className="border-[3px] border-billboard-ink rounded bg-white p-5 shadow-blockSm mb-6" role="status">
        <p className="font-display text-lg mb-1">{result.live ? "Your listing is live" : "Listing submitted for review"}</p>
        <p className="text-sm text-billboard-inkSoft mb-3">
          {result.live
            ? "It's on the browse page now. Requests for it arrive in your dashboard."
            : result.digital
              ? "ChatSched checks that you own this channel before it appears on the browse page. We'll notify you once it's approved."
              : "ChatSched reviews the proof you uploaded before it appears on the browse page. We'll notify you once it's approved."}
        </p>
        {result.live && <Button to={`/browse/${result.id}`} variant="primary" size="sm">View it on browse →</Button>}
      </div>
    );
  }

  return (
    <section className="border-[3px] border-billboard-ink rounded bg-white p-5 shadow-blockSm mb-6" aria-labelledby="biz-listing-heading">
      <h2 id="biz-listing-heading" className="font-display text-lg mb-1">List your business on the browse page</h2>
      <p className="text-sm text-billboard-inkSoft mb-3">
        Included with Premium access — no extra charge. Other businesses can find and book you the same way they book any publisher.
        You can't book your own listing. One listing per account.
      </p>
      {!open ? (
        <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>Create publisher listing</Button>
      ) : (
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bl-name">Listing name</label>
            <input id="bl-name" name="name" required minLength={2} maxLength={80} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-channel">Channel</label>
            <select
              id="bl-channel" name="channel_slug" required value={channel} className={inputCls}
              onChange={(e) => { setChannel(e.target.value as ChannelSlug); setForm(initialState); setProofFiles([]); }}
            >
              <option value="" disabled>Choose a channel</option>
              {channels.map((c) => <option key={c.definition.slug} value={c.definition.slug}>{c.definition.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-category">Category</label>
            <select id="bl-category" name="category" required defaultValue="" className={inputCls}>
              <option value="" disabled>Choose a category</option>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-city">City</label>
            <input id="bl-city" name="city" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-province">Province</label>
            <select id="bl-province" name="province" required defaultValue="" className={inputCls}>
              <option value="" disabled>Choose a province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-suburb">Suburb (optional)</label>
            <input id="bl-suburb" name="suburb" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bl-price">Price per placement (R, min 50)</label>
            <input id="bl-price" name="price" type="number" min={50} step="1" required inputMode="numeric" className={inputCls} />
          </div>

          {channel && def && (
            <div className="sm:col-span-2 space-y-4 border-t-2 border-billboard-paperDim pt-4" data-testid="channel-questions">
              {authority ? (
                <label className="flex items-start gap-3 text-sm border-2 border-billboard-ink rounded p-3 bg-billboard-yellow/10 cursor-pointer">
                  <input
                    type="checkbox" checked={form.authorityConfirmed}
                    onChange={(e) => update("authorityConfirmed", e.target.checked)} className="mt-0.5 h-4 w-4"
                  />
                  <span className="font-semibold">
                    I own or run this {AUTHORITY_SUBJECT[channel as keyof typeof AUTHORITY_SUBJECT]} and can sell sponsorship and advertising on it.
                  </span>
                </label>
              ) : (
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="bl-metric">{def.eligibility?.metricLabel ?? "Follower count"}</label>
                  <input
                    id="bl-metric" type="number" min={0} inputMode="numeric" value={form.followers}
                    onChange={(e) => update("followers", e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                  />
                  <p className="text-xs text-billboard-inkSoft mt-1">Minimum {(def.eligibility?.minValue ?? 0).toLocaleString()}.</p>
                </div>
              )}

              {def.bookingFlow === "request" && <AdFormatsPicker channelSlug={channel} form={form} update={update} />}
              <ChannelSpecificFields channelSlug={channel} form={form} update={update} />

              {hasEngagement && (
                <div className={channel === "influencer" ? "" : "grid grid-cols-2 gap-3"}>
                  {channel !== "influencer" && (
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" htmlFor="bl-eng">Avg. engagement %</label>
                      <input id="bl-eng" type="number" step="0.1" value={form.engagement} onChange={(e) => update("engagement", e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="bl-reach">Avg. monthly reach</label>
                    <input id="bl-reach" type="number" value={form.monthlyReach} onChange={(e) => update("monthlyReach", e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
                  </div>
                </div>
              )}

              {channel === "informal-retail" && (
                <label className="flex items-start gap-2 text-sm border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-3">
                  <input type="checkbox" checked={form.retailMunicipalRegistrationConfirmed} onChange={(e) => update("retailMunicipalRegistrationConfirmed", e.target.checked)} className="mt-0.5" />
                  <span>I confirm this shop is registered with the relevant local municipality and that I am authorised to offer its advertising inventory through ChatSched.</span>
                </label>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bl-bio">About this listing</label>
            <textarea id="bl-bio" name="bio" rows={3} maxLength={1500} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bl-audience">Who sees it</label>
            <textarea id="bl-audience" name="audience" rows={2} maxLength={1500} className={inputCls} />
          </div>

          {needsProof && (
            <div className="sm:col-span-2 border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
              <label className={labelCls} htmlFor="bl-proof">Show us the real thing</label>
              <p className="text-sm text-billboard-inkSoft mb-3">
                {def?.name} listings are checked before approval. Add a photo or short video that shows what you described (the venue, the vehicle, the team kit, the shop). Up to 5 files.
              </p>
              <input
                id="bl-proof" type="file" multiple className="text-sm"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                onChange={(e) => setProofFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
              {proofFiles.length > 0 && <p className="text-xs text-billboard-inkSoft mt-2">{proofFiles.length} file{proofFiles.length === 1 ? "" : "s"} selected — uploaded when you create the listing.</p>}
            </div>
          )}
          {channel && !needsProof && (
            <p className="sm:col-span-2 text-xs text-billboard-inkSoft">ChatSched checks that you own this channel before the listing goes on the browse page.</p>
          )}

          {error && <p role="alert" className="sm:col-span-2 text-sm font-semibold text-billboard-red">{error}</p>}
          <div className="sm:col-span-2 flex gap-3 items-center">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Creating…" : "Create listing"}</Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function BusinessListingStatusLink({ id, status }: { id: string; status: string }) {
  return (
    <p className="text-sm text-billboard-inkSoft">
      Your publisher listing is <strong>{status === "approved" ? "live" : status.replace("_", " ")}</strong>.{" "}
      {status === "approved" && <Link to={`/browse/${id}`} className="font-semibold underline">View on browse →</Link>}
    </p>
  );
}
