// "Create a publisher listing" card for an ACTIVATED business account.
//
// A business that has paid its activation fee can list itself (or one of its
// own ad spaces) on the browse page. Channels with no manual verification go
// live straight away; social media and the high-trust channels are created
// as "pending review" and go through the normal ChatSched verification —
// the database refuses to approve them any other way. All of that is decided
// server-side by create_business_publisher_listing() (see
// supabase/migrations/20261003120000_business_publisher_listings.sql); this
// component only collects the fields and shows the outcome.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { CATEGORIES, PROVINCES } from "../lib/constants";
import { getPublisherOnboardingChannels } from "../lib/channelRegistry";
import Button from "./Button";

const inputCls = "w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-billboard-ink";
const labelCls = "block font-mono text-xs font-semibold uppercase tracking-wider mb-1";

export default function BusinessListingCreator({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSocial, setIsSocial] = useState(false);
  const [result, setResult] = useState<{ id: string; live: boolean } | null>(null);
  const channels = getPublisherOnboardingChannels();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const channel = str("channel_slug");
    const links = channel === "social-media"
      ? str("social_links").split(/\s+/).filter((u) => /^https?:\/\//i.test(u)).slice(0, 6).map((url) => ({ platform: new URL(url).hostname.replace(/^www\./, ""), url }))
      : [];
    if (channel === "social-media" && links.length === 0) {
      setError("Social media listings need at least one public profile link (starting with https://).");
      return;
    }
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("create_business_publisher_listing", {
      p_listing: {
        name: str("name"),
        channel_slug: channel,
        category: str("category"),
        city: str("city"),
        province: str("province"),
        suburb: str("suburb"),
        price_per_post: Number(str("price")),
        followers: str("followers") ? Number(str("followers")) : 0,
        bio: str("bio"),
        audience: str("audience"),
        social_verification_links: links,
      },
    });
    setBusy(false);
    if (rpcError) {
      setError(formatSupabaseError(rpcError));
      return;
    }
    const res = data as { ok?: boolean; id?: string; live?: boolean } | null;
    if (!res?.id) {
      setError("Something went wrong creating your listing. Please try again.");
      return;
    }
    setResult({ id: res.id, live: !!res.live });
    onCreated();
  }

  if (result) {
    return (
      <div className="border-[3px] border-billboard-ink rounded bg-white p-5 shadow-blockSm mb-6" role="status">
        <p className="font-display text-lg mb-1">{result.live ? "Your listing is live" : "Listing submitted for review"}</p>
        <p className="text-sm text-billboard-inkSoft mb-3">
          {result.live
            ? "It's on the browse page now. Requests for it arrive in your dashboard."
            : "This channel needs ChatSched verification before it appears on the browse page. We'll notify you once it's approved."}
        </p>
        {result.live && <Button to={`/browse/${result.id}`} variant="primary" size="sm">View it on browse →</Button>}
      </div>
    );
  }

  return (
    <section className="border-[3px] border-billboard-ink rounded bg-white p-5 shadow-blockSm mb-6" aria-labelledby="biz-listing-heading">
      <h2 id="biz-listing-heading" className="font-display text-lg mb-1">List your business on the browse page</h2>
      <p className="text-sm text-billboard-inkSoft mb-3">
        Your activation fee covers this — no extra charge. Other businesses can find and book you the same way they book any publisher.
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
            <select id="bl-channel" name="channel_slug" required defaultValue="" className={inputCls} onChange={(e) => setIsSocial(e.target.value === "social-media")}>
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
          <div>
            <label className={labelCls} htmlFor="bl-followers">Audience size (optional)</label>
            <input id="bl-followers" name="followers" type="number" min={0} step="1" inputMode="numeric" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bl-bio">About this listing</label>
            <textarea id="bl-bio" name="bio" rows={3} maxLength={1500} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bl-audience">Who sees it</label>
            <textarea id="bl-audience" name="audience" rows={2} maxLength={1500} className={inputCls} />
          </div>
          {isSocial && (
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="bl-links">Public profile links (one per line, up to 6)</label>
              <textarea id="bl-links" name="social_links" rows={3} className={inputCls} placeholder="https://instagram.com/yourbusiness" />
              <p className="text-xs text-billboard-inkSoft mt-1">Social media listings are verified by ChatSched before they appear on browse.</p>
            </div>
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
