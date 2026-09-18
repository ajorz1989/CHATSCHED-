import { useRef, useState, type FormEvent } from "react";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import {
  WORK_WITH_US_CATEGORIES, WORK_WITH_US_ATTACHMENT_MAX_BYTES,
  ALLOWED_WORK_WITH_US_ATTACHMENT_MIME_TYPES, WORK_WITH_US_ATTACHMENT_BUCKET, CONTACT_EMAIL,
} from "../lib/constants";
import type { WorkWithUsCategory } from "../lib/types";
import Button from "../components/Button";

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export default function WorkWithUs() {
  const [category, setCategory] = useState<WorkWithUsCategory | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_WORK_WITH_US_ATTACHMENT_MIME_TYPES.includes(f.type)) {
      setFileError("Please attach a PDF, Word doc, or image (JPG/PNG/WebP).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
      return;
    }
    if (f.size > WORK_WITH_US_ATTACHMENT_MAX_BYTES) {
      setFileError(`That file is ${formatMB(f.size)} — the limit is ${formatMB(WORK_WITH_US_ATTACHMENT_MAX_BYTES)}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) {
      setSubmitting(true);
      setTimeout(() => { setSubmitting(false); setSent(true); }, 400);
      return;
    }
    if (!category) {
      setSubmitError("Pick a category above.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    let attachment_path: string | null = null;
    let attachment_filename: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from(WORK_WITH_US_ATTACHMENT_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) {
        setSubmitting(false);
        setSubmitError("Couldn't upload your attachment — it may be too large or an unsupported type. Try again.");
        return;
      }
      attachment_path = path;
      attachment_filename = file.name;
    }

    const result = await submitPublicForm("work_with_us", {
      name, email, category, location, message,
      portfolio_url: portfolioUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      attachment_path, attachment_filename,
    });

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <Seo title="Work With Us · ChatSched" description="Developers, designers, sales, marketing, creators, community managers, sales reps, freelancers and interns — work with ChatSched." />

      <section className="bg-billboard-green border-b-[3px] border-billboard-ink py-16 text-white">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-white px-3 py-1.5 rounded mb-4">Work with us</span>
          <h1 className="text-3xl md:text-4xl mb-5">However you want to work with ChatSched, there's a way in.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">Not every good fit looks like a full-time hire. Tell us how you'd want to work with us and where you'd add the most value.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">Pick a category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {WORK_WITH_US_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`text-left border-[3px] rounded p-4 transition ${category === c.value ? "border-billboard-ink bg-billboard-yellow" : "border-billboard-ink hover:-translate-y-0.5"}`}
            >
              <span className="font-bold text-sm">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Thanks, that's in.</h2>
            <p className="text-sm">We'll be in touch if there's a fit for {name.split(" ")[0]}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
            {!category && <p className="text-billboard-inkSoft text-sm mb-4">Pick a category above to get started.</p>}

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Email</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Location</label>
                <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Cape Town, South Africa" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Category</label>
                <select required value={category ?? ""} onChange={(e) => setCategory(e.target.value as WorkWithUsCategory)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
                  <option value="" disabled>Select a category</option>
                  {WORK_WITH_US_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Portfolio / website <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">LinkedIn <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Attachment <span className="font-normal text-billboard-inkSoft">(optional — CV, deck, or sample work)</span></label>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={handleFileChange} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm" />
              <p className="text-xs text-billboard-inkSoft mt-1.5">PDF, Word, or image, up to {formatMB(WORK_WITH_US_ATTACHMENT_MAX_BYTES)}.</p>
              {fileError && <p className="text-billboard-red text-xs font-semibold mt-1.5">{fileError}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Tell us how you'd want to work with us</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="What you'd bring, and how you'd want to be involved." className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>

            <div {...wrapperProps}>
              <label htmlFor="wwu-website">Leave this field empty</label>
              <input id="wwu-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {submitError && <p className="text-billboard-red text-xs font-semibold mb-3">{submitError}</p>}
            {!isSupabaseConfigured && (
              <p className="text-xs text-billboard-inkSoft mb-3">The database isn't connected yet, so this form won't save — email {CONTACT_EMAIL} for now.</p>
            )}
            <Button type="submit" variant="primary" size="md" disabled={submitting || !isSupabaseConfigured} className="w-full">
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
