import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
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
  initials: string;
  channel_slug: string | null;
  status: string | null;
  created_at: string;
}

const LISTING_COLUMNS =
  "id, user_id, name, category, province, city, suburb, bio, audience, mobile_number, business_name, company_registration, vat_number, profile_image_url, initials, channel_slug, status, created_at";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const fieldClass = "w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm bg-white text-billboard-ink";
const labelClass = "block text-xs font-semibold mb-1";

export default function AJListingsManager({ refreshKey }: { refreshKey: number }) {
  const [listings, setListings] = useState<AJListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="font-mono text-[10px] uppercase tracking-wider text-white/50 hover:text-white transition disabled:opacity-50 shrink-0"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

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
                    <ListingEditor listing={listing} onChanged={load} />
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

function ListingEditor({ listing, onChanged }: { listing: AJListing; onChanged: () => void }) {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const maxMb = (MAX_PROFILE_IMAGE_BYTES / (1024 * 1024)).toFixed(0);

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
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoUploading}
            className="text-xs font-semibold underline text-billboard-inkSoft disabled:opacity-60"
          >
            {photoUploading ? "Uploading…" : listing.profile_image_url ? "Change photo" : "Add a profile photo"}
          </button>
          <p className="text-[11px] text-billboard-inkSoft mt-0.5">
            {listing.profile_image_url ? "" : "Businesses trust a real photo over initials on a colour swatch. "}
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
    </div>
  );
}
