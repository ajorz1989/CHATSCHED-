import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2, Inbox, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { formatCurrency } from "../lib/currency";
import { invalidatePublishersCache } from "../hooks/usePublishers";
import {
  CATEGORIES,
  PROVINCES,
  SA_SUBURBS_AUTOCOMPLETE,
  MAX_PROFILE_IMAGE_BYTES,
  ALLOWED_PROFILE_IMAGE_MIME_TYPES,
  MIN_BIO_LENGTH,
} from "../lib/constants";
import PublisherAvatar from "./PublisherAvatar";
import PortfolioManager from "./PortfolioManager";

// Manage the listings created through AJ: Creations — same profile photo and
// profile fields a normal publisher edits from their own dashboard, but driven
// from the admin workspace (AJ-created listings have no owning user, so there
// is no publisher login to do it from).

interface AJListing {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  province: string;
  city: string;
  suburb: string | null;
  bio: string | null;
  audience: string | null;
  mobile_number: string | null;
  business_name: string | null;
  company_registration: string | null;
  vat_number: string | null;
  profile_image_url: string | null;
  intro_video_url: string | null;
  portfolio_images: string[];
  initials: string;
  swatch: string;
  channel_slug: string | null;
  status: string | null;
  created_at: string;
  admin_notes: string | null;
}

interface AJRequest {
  id: string;
  business_id: string;
  campaign_message: string;
  budget: number | null;
  status: "pending" | "contacted" | "confirmed" | "declined" | "completed";
  created_at: string;
}

const LISTING_COLUMNS =
  "id, user_id, name, category, province, city, suburb, bio, audience, mobile_number, business_name, company_registration, vat_number, profile_image_url, intro_video_url, portfolio_images, initials, swatch, channel_slug, status, created_at, admin_notes";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const fieldClass = "w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm bg-white text-billboard-ink";
const labelClass = "block text-xs font-semibold mb-1";

const PROFILE_BACKGROUNDS = [
  { label: "ChatSched Green", value: "from-billboard-green to-billboard-greenDeep" },
  { label: "Yellow", value: "from-billboard-yellow to-billboard-yellow" },
  { label: "Yellow + Green", value: "from-billboard-yellow to-billboard-greenDeep" },
  { label: "Red", value: "from-billboard-red to-billboard-red" },
  { label: "Ink", value: "from-billboard-ink to-billboard-inkSoft" },
] as const;

export default function AJListingsManager({ refreshKey }: { refreshKey: number }) {
  const [listings, setListings] = useState<AJListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("publishers")
      .select(LISTING_COLUMNS)
      .eq("creation_source", "aj_creations")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(formatSupabaseError(error, "Couldn't load your AJ: Creations listings"));
    } else {
      setListings((data ?? []) as unknown as AJListing[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const mockupCount = listings.filter(
    (listing) => listing.admin_notes === "AJ_DEMO_SOCIAL_POST_20261001_V1"
  ).length;

  async function deleteMockupBatch() {
    if (bulkDeleting || mockupCount === 0) return;
    if (!window.confirm(
      `Delete all ${mockupCount} ChatSched demo social-media publisher mockups? This only targets the AJ demo batch and cannot be undone.`
    )) return;

    setBulkDeleting(true);
    setBulkError(null);

    const { error } = await supabase
      .from("publishers")
      .delete()
      .eq("creation_source", "aj_creations")
      .eq("admin_notes", "AJ_DEMO_SOCIAL_POST_20261001_V1");

    setBulkDeleting(false);

    if (error) {
      setBulkError(formatSupabaseError(error, "Couldn't delete the demo publisher batch"));
      return;
    }

    setOpenId(null);
    invalidatePublishersCache();
    await load();
  }

  return (
    <section className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden scroll-mt-4">
      <div className="p-5 md:p-6 flex items-start justify-between gap-4 border-b border-white/10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow">Step 3</p>
          <h2 className="font-display text-xl">Manage your AJ: Creations listings</h2>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            Add a profile photo and edit the profile details, the same as a creator can from their own dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {mockupCount > 0 && (
            <button
              type="button"
              onClick={deleteMockupBatch}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-billboard-red/90 hover:text-billboard-red transition disabled:opacity-50"
            >
              <Trash2 size={13} />
              {bulkDeleting ? "Deleting…" : `Delete demo mockups (${mockupCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw size={12} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {mockupCount > 0 && (
        <div className="mx-5 md:mx-6 mt-4 rounded-lg border border-billboard-yellow/30 bg-billboard-yellow/10 px-4 py-3 text-xs text-white/70 flex items-start gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-billboard-yellow font-bold shrink-0 mt-0.5">Demo batch</span>
          <span>{mockupCount} temporary social-media post publisher profiles are tagged internally for this marketplace mockup. They can be edited here or removed before launch.</span>
        </div>
      )}
      {bulkError && (
        <div role="alert" className="mx-5 md:mx-6 mt-3 text-xs font-semibold text-billboard-red">{bulkError}</div>
      )

      {loadError ? (
        <div role="alert" className="p-5 md:p-6 text-sm text-billboard-red">
          {loadError}
        </div>
      ) : loading && listings.length === 0 ? (
        <div role="status" className="p-5 md:p-6 text-sm text-white/50">Loading your listings…</div>
      ) : listings.length === 0 ? (
        <div className="p-5 md:p-6 text-sm text-white/50">
          Nothing here yet. Publish a listing in Step 2 and it will show up here, ready for a profile photo.
        </div>
      ) : (
        <ul className="divide-y divide-white/10">
          {listings.map((listing) => {
            const open = openId === listing.id;
            return (
              <li key={listing.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : listing.id)}
                  aria-expanded={open}
                  className="w-full p-4 md:px-6 flex items-center gap-4 text-left hover:bg-white/[0.03] transition"
                >
                  <PublisherAvatar imageUrl={listing.profile_image_url} initials={listing.initials} name={listing.name} size="sm" className="!border-white/40" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{listing.name}</p>
                    <p className="text-xs text-white/40 truncate">
                      {listing.category} · {listing.city}, {listing.province}
                      {listing.profile_image_url ? "" : " · no profile photo yet"}
                    </p>
                  </div>
                  {listing.status && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 shrink-0">{listing.status}</span>
                  )}
                  <ChevronDown className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} size={16} />
                </button>

                {/* Same lesson as the create form: this panel is white inside a text-white
                    section, so it sets its own text colour or everything inherits white. */}
                {open && (
                  <div className="bg-white text-billboard-ink p-5 md:p-6 border-t border-white/10">
                    <ListingEditor
                      listing={listing}
                      onChanged={load}
                      onDeleted={async () => {
                        setOpenId(null);
                        await load();
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ListingEditor({ listing, onChanged, onDeleted }: { listing: AJListing; onChanged: () => void; onDeleted: () => void | Promise<void> }) {
  const { user } = useAuth();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(listing.name);
  const [category, setCategory] = useState(listing.category);
  const [province, setProvince] = useState(listing.province);
  const [city, setCity] = useState(listing.city);
  const [suburb, setSuburb] = useState(listing.suburb ?? "");
  const [bio, setBio] = useState(listing.bio ?? "");
  const [audience, setAudience] = useState(listing.audience ?? "");
  const [mobileNumber, setMobileNumber] = useState(listing.mobile_number ?? "");
  const [businessName, setBusinessName] = useState(listing.business_name ?? "");
  const [companyRegistration, setCompanyRegistration] = useState(listing.company_registration ?? "");
  const [vatNumber, setVatNumber] = useState(listing.vat_number ?? "");
  const [swatch, setSwatch] = useState(listing.swatch);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [requests, setRequests] = useState<AJRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const maxMb = (MAX_PROFILE_IMAGE_BYTES / (1024 * 1024)).toFixed(0);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);

    const { data, error } = await supabase
      .from("requests")
      .select("id,business_id,campaign_message,budget,status,created_at")
      .eq("publisher_id", listing.id)
      .order("created_at", { ascending: false });

    setRequestsLoading(false);

    if (error) {
      setRequestsError(formatSupabaseError(error, "Couldn't load incoming booking requests"));
      return;
    }

    setRequests((data ?? []) as AJRequest[]);
  }, [listing.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function updateRequestStatus(id: string, status: AJRequest["status"]) {
    const { error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", id);

    if (error) {
      setRequestsError(formatSupabaseError(error, "Couldn't update the request status"));
      return;
    }

    await loadRequests();
  }

  async function deleteListing() {
    if (deleting) return;

    const warning = requests.length > 0
      ? `Delete “${listing.name}”? This listing has ${requests.length} booking request${requests.length === 1 ? "" : "s"} attached. Deleting the publisher can also remove linked request data.`
      : `Delete “${listing.name}”? This cannot be undone.`;

    if (!window.confirm(warning)) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase
      .from("publishers")
      .delete()
      .eq("id", listing.id)
      .eq("creation_source", "aj_creations");

    setDeleting(false);

    if (error) {
      setError(formatSupabaseError(error, "Couldn't delete this AJ: Creations listing"));
      return;
    }

    invalidatePublishersCache();
    await onDeleted();
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;

    setPhotoError(null);
    if (!user) {
      setPhotoError("You need to be signed in to upload a photo.");
      return;
    }
    const ext = MIME_TO_EXT[file.type];
    if (!ALLOWED_PROFILE_IMAGE_MIME_TYPES.includes(file.type) || !ext) {
      setPhotoError("Only JPG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setPhotoError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the limit is ${maxMb}MB. Try compressing it first.`);
      return;
    }

    setPhotoUploading(true);
    // AJ-created listings have no owning user, and the profile-images storage
    // policies only allow writing inside your own {auth.uid()}/ folder. So the
    // photo lives in the admin's folder, named after the listing. One fixed
    // filename per listing (upsert) so a new photo replaces the old one.
    const folder = user.id;
    const path = `${folder}/aj-${listing.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("profile-images")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (uploadErr) {
      setPhotoUploading(false);
      setPhotoError(formatSupabaseError(uploadErr, "Upload failed"));
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    // Cache-bust: same path on re-upload, so without this the old image would stay cached.
    const freshUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const { error: updateErr } = await supabase
      .from("publishers")
      .update({ profile_image_url: freshUrl })
      .eq("id", listing.id);

    if (updateErr) {
      setPhotoUploading(false);
      setPhotoError(formatSupabaseError(updateErr, "Uploaded, but couldn't save it to the listing"));
      return;
    }

    // Switching format (e.g. PNG -> JPG) would otherwise leave the old file behind.
    const staleExts = Object.values(MIME_TO_EXT).filter((x) => x !== ext);
    await supabase.storage
      .from("profile-images")
      .remove(staleExts.map((x) => `${folder}/aj-${listing.id}.${x}`))
      .catch(() => undefined);

    setPhotoUploading(false);
    invalidatePublishersCache();
    onChanged();
  }

  async function removeProfilePhoto() {
    if (!listing.profile_image_url || !user || photoRemoving) return;
    if (!confirm("Remove this profile picture?")) return;

    setPhotoError(null);
    setPhotoRemoving(true);

    const { error: updateErr } = await supabase
      .from("publishers")
      .update({ profile_image_url: null })
      .eq("id", listing.id);

    if (updateErr) {
      setPhotoRemoving(false);
      setPhotoError(formatSupabaseError(updateErr, "Couldn't remove the profile picture"));
      return;
    }

    const marker = "/profile-images/";
    const index = listing.profile_image_url.indexOf(marker);
    if (index !== -1) {
      const path = listing.profile_image_url.slice(index + marker.length).split("?")[0];
      if (path) {
        await supabase.storage.from("profile-images").remove([path]).catch(() => undefined);
      }
    }

    setPhotoRemoving(false);
    invalidatePublishersCache();
    onChanged();
  }

  function startEditing() {
    setName(listing.name);
    setCategory(listing.category);
    setProvince(listing.province);
    setCity(listing.city);
    setSuburb(listing.suburb ?? "");
    setBio(listing.bio ?? "");
    setAudience(listing.audience ?? "");
    setMobileNumber(listing.mobile_number ?? "");
    setBusinessName(listing.business_name ?? "");
    setCompanyRegistration(listing.company_registration ?? "");
    setVatNumber(listing.vat_number ?? "");
    setSwatch(listing.swatch);
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  async function save() {
    if (!name.trim() || !province.trim() || !city.trim()) {
      setError("Name, province and city can't be empty.");
      return;
    }
    const bioLength = bio.trim().length;
    if (bioLength > 0 && bioLength < MIN_BIO_LENGTH) {
      setError(`A bio needs at least ${MIN_BIO_LENGTH} characters (or leave it empty). ${MIN_BIO_LENGTH - bioLength} more to go.`);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("publishers")
      .update({
        name: name.trim(),
        category,
        province,
        city: city.trim(),
        suburb: suburb.trim() || null,
        bio: bio.trim(),
        audience: audience.trim(),
        mobile_number: mobileNumber.trim() || null,
        business_name: businessName.trim() || null,
        company_registration: companyRegistration.trim() || null,
        vat_number: vatNumber.trim() || null,
        swatch,
      })
      .eq("id", listing.id);
    setSaving(false);
    if (updateError) {
      setError(formatSupabaseError(updateError, "Couldn't save the listing details"));
      return;
    }
    invalidatePublishersCache();
    setEditing(false);
    setSaved(true);
    onChanged();
  }

  const categoryKnown = CATEGORIES.some((c) => c.name === category);
  const provinceKnown = (PROVINCES as readonly string[]).includes(province);
  const datalistId = `aj-suburbs-${listing.id}`;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <PublisherAvatar imageUrl={listing.profile_image_url} initials={listing.initials} name={listing.name} size="md" />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading || photoRemoving}
              className="text-xs font-semibold underline text-billboard-inkSoft disabled:opacity-60"
            >
              {photoUploading ? "Uploading…" : listing.profile_image_url ? "Change photo" : "Add a profile photo"}
            </button>
            {listing.profile_image_url && (
              <button
                type="button"
                onClick={removeProfilePhoto}
                disabled={photoUploading || photoRemoving}
                className="text-xs font-semibold underline text-billboard-red disabled:opacity-60"
              >
                {photoRemoving ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
          <p className="text-[11px] text-billboard-inkSoft mt-0.5">
            {listing.profile_image_url ? "Replace or remove the profile picture. " : "Add a profile picture shown on the listing. "}
            JPG, PNG or WebP, up to {maxMb}MB.
          </p>
          {photoError && <p role="alert" className="text-billboard-red text-xs font-semibold mt-1">{photoError}</p>}
          <input
            ref={photoInputRef}
            type="file"
            accept={ALLOWED_PROFILE_IMAGE_MIME_TYPES.join(",")}
            onChange={handlePhoto}
            className="hidden"
            aria-label={`Profile photo for ${listing.name}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-billboard-inkSoft">Profile details</p>
        <div className="flex items-center gap-4">
          <Link
            to={`/browse/${listing.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold underline text-billboard-inkSoft"
          >
            View public profile
          </Link>
          {!editing && (
            <button type="button" onClick={startEditing} className="text-xs font-semibold underline text-billboard-inkSoft">
              Edit profile
            </button>
          )}
        </div>
      </div>

      {saved && !editing && (
        <p role="status" className="text-xs font-semibold text-billboard-greenDeep mb-1">Saved.</p>
      )}

      {!editing ? (
        <div className="mt-2 text-sm text-billboard-inkSoft space-y-1">
          <p>
            <span className="font-semibold text-billboard-ink">{listing.name}</span> · {listing.category}
          </p>
          <p>
            {listing.city}
            {listing.suburb ? `, ${listing.suburb}` : ""}, {listing.province}
          </p>
          {listing.bio ? <p className="max-w-lg">{listing.bio}</p> : <p className="italic">No bio yet.</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
              {!categoryKnown && <option value={category}>{category}</option>}
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Province</label>
            <select value={province} onChange={(e) => setProvince(e.target.value)} className={fieldClass}>
              {!provinceKnown && <option value={province}>{province}</option>}
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Suburb (optional)</label>
            <input value={suburb} onChange={(e) => setSuburb(e.target.value)} list={datalistId} className={fieldClass} />
            <datalist id={datalistId}>
              {SA_SUBURBS_AUTOCOMPLETE.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Contact number</label>
            <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className={fieldClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Audience</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Young professionals, 22–35, Cape Town CBD — fitness & wellness focused"
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Bio</label>
              <span
                className={`text-[11px] font-mono ${bio.trim().length > 0 && bio.trim().length < MIN_BIO_LENGTH ? "text-billboard-red" : "text-billboard-inkSoft"}`}
              >
                {bio.trim().length}/{MIN_BIO_LENGTH}+ characters
              </span>
            </div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className={fieldClass} />
          </div>

          <div className="sm:col-span-2 mt-2 pt-4 border-t-2 border-billboard-paperDim">
            <label className={labelClass}>Profile background colour</label>
            <p className="text-[11px] text-billboard-inkSoft mb-3">
              Choose the background treatment shown on the public profile and publisher card.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROFILE_BACKGROUNDS.map((option) => {
                const selected = swatch === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setSwatch(option.value)}
                    aria-pressed={selected}
                    className={`rounded border-2 p-1.5 text-left transition ${selected ? "border-billboard-ink ring-2 ring-billboard-yellow" : "border-billboard-ink/20 hover:border-billboard-ink"}`}
                  >
                    <span className={`block h-10 rounded bg-gradient-to-br ${option.value}`} aria-hidden="true" />
                    <span className="block text-[10px] font-mono mt-1.5 truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={`mt-3 h-14 rounded border-2 border-billboard-ink bg-gradient-to-br ${swatch} flex items-center px-4`}>
              <span className="font-bold text-white drop-shadow-sm truncate">{listing.name}</span>
            </div>
          </div>

          <div className="sm:col-span-2 mt-2 pt-4 border-t-2 border-billboard-paperDim">
            <p className="text-xs font-semibold text-billboard-inkSoft uppercase tracking-wide mb-2">
              Business details (optional, for invoicing)
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Business name</label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Company registration</label>
                <input value={companyRegistration} onChange={(e) => setCompanyRegistration(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>VAT number</label>
                <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className={fieldClass} />
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="text-sm font-semibold text-billboard-inkSoft"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="text-billboard-red text-xs font-semibold sm:col-span-2">{error}</p>
          )}
        </div>
      )}
      <div className="mt-6 pt-6 border-t-2 border-billboard-paperDim">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold text-billboard-ink uppercase tracking-wide">
              <Inbox size={14} /> Incoming booking requests
            </p>
            <p className="text-[11px] text-billboard-inkSoft mt-1">
              Businesses can send normal Social Media Post booking requests to this listing. AJ mockups have no publisher login, so requests are surfaced here for admin handling.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={requestsLoading}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-billboard-inkSoft hover:text-billboard-ink disabled:opacity-50"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {requestsError && (
          <p role="alert" className="text-xs font-semibold text-billboard-red mb-2">{requestsError}</p>
        )}

        {requestsLoading ? (
          <p className="text-xs text-billboard-inkSoft">Checking for requests…</p>
        ) : requests.length === 0 ? (
          <div className="border-2 border-billboard-ink/15 rounded-lg bg-billboard-paperDim p-3 text-xs text-billboard-inkSoft">
            No booking requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-billboard-ink">Business booking request</p>
                    <p className="text-[10px] font-mono text-billboard-inkSoft mt-0.5">
                      {new Date(request.created_at).toLocaleDateString("en-ZA")} · {request.business_id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-billboard-ink/20 rounded bg-billboard-paperDim">
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-billboard-inkSoft mt-2 leading-relaxed">{request.campaign_message}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-billboard-paperDim">
                  {request.budget != null && (
                    <span className="text-xs font-semibold">Budget {formatCurrency(Number(request.budget))}</span>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-xs font-semibold">
                    Status
                    <select
                      value={request.status}
                      onChange={(e) => updateRequestStatus(request.id, e.target.value as AJRequest["status"])}
                      className="border-2 border-billboard-ink rounded px-2 py-1 bg-white text-xs"
                    >
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="declined">Declined</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t-2 border-billboard-paperDim">
        <PortfolioManager
          publisher={{
            id: listing.id,
            intro_video_url: listing.intro_video_url,
            portfolio_images: listing.portfolio_images,
          }}
          onChange={onChanged}
          storagePathPrefix={user ? `${user.id}/aj-${listing.id}` : undefined}
        />
      </div>

      <div className="mt-6 pt-5 border-t-2 border-billboard-paperDim flex items-center justify-between gap-3">
        <p className="text-[11px] text-billboard-inkSoft">
          Delete removes this AJ-created publisher listing from the marketplace.
        </p>
        <button
          type="button"
          onClick={deleteListing}
          disabled={deleting}
          className="inline-flex items-center gap-2 border-2 border-billboard-red text-billboard-red font-semibold px-3 py-2 rounded text-xs hover:bg-billboard-red/5 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {deleting ? "Deleting…" : "Delete listing"}
        </button>
      </div>
    </div>
  );
