import { useRef, useState, type FormEvent } from "react";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { CAREER_CV_MAX_BYTES, ALLOWED_CV_MIME_TYPES, CAREER_CV_BUCKET, CONTACT_EMAIL } from "../lib/constants";
import Button from "../components/Button";

const WHY_CHATSCHED = [
  { title: "Build something from the ground up", body: "This is still early — you're not maintaining someone else's decisions, you're making the first ones." },
  { title: "Work on marketplace technology", body: "Two-sided matching, trust scoring, payments and payouts — real marketplace problems, not CRUD screens." },
  { title: "AI + advertising", body: "Audience matching, authenticity checks and content tooling, applied to a market that's still figuring out what AI-assisted advertising looks like." },
  { title: "South African technology", body: "Built here, for South African businesses and South African publishers — not a global product adapted after the fact." },
  { title: "Remote/flexible opportunities", body: "Work from wherever you're productive — what matters is the work, not the seat you're in." },
  { title: "Small-team environment", body: "No layers between you and the decision. What you build ships, and you'll know why it matters." },
];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export default function Careers() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [location, setLocation] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) {
      setCvFile(null);
      return;
    }
    if (!ALLOWED_CV_MIME_TYPES.includes(file.type)) {
      setFileError("Please upload a PDF or Word document (.pdf, .doc, .docx).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setCvFile(null);
      return;
    }
    if (file.size > CAREER_CV_MAX_BYTES) {
      setFileError(`That file is ${formatMB(file.size)} — the limit is ${formatMB(CAREER_CV_MAX_BYTES)}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setCvFile(null);
      return;
    }
    setCvFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) {
      // Behave like success so a bot gets no signal it was caught.
      setSubmitting(true);
      setTimeout(() => { setSubmitting(false); setSent(true); }, 400);
      return;
    }
    if (!cvFile) {
      setFileError("Please attach your CV.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const ext = cvFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(CAREER_CV_BUCKET).upload(path, cvFile, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setSubmitting(false);
      setSubmitError("Couldn't upload your CV — it may be too large or an unsupported type. Try again.");
      return;
    }

    const result = await submitPublicForm("careers", {
      name,
      email,
      role,
      cv_path: path,
      cv_filename: cvFile.name,
      portfolio_url: portfolioUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      location,
      cover_letter: coverLetter,
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
      <Seo title="Careers · ChatSched" description="Build the future of local advertising with ChatSched — open opportunities across a small, remote-friendly South African team." />

      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">Careers</span>
          <h1 className="text-3xl md:text-4xl mb-5">Build the future of local advertising with ChatSched.</h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl">We're a small, early-stage team connecting South African businesses with the local audiences already worth reaching. If that sounds like your kind of problem, we want to hear from you.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-8">Why ChatSched</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {WHY_CHATSCHED.map((item) => (
            <div key={item.title} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5">{item.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 pb-8">
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <h2 className="font-display text-lg mb-1.5">Open roles</h2>
          <p className="text-sm text-billboard-inkSoft">We don't run a fixed list of open positions — as a small team, who we need next changes fast. If you think you'd be a good fit anywhere in the business, tell us below what role you're after (or put "General application") and we'll get in touch if there's a match.</p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Application received.</h2>
            <p className="text-sm">Thanks, {name.split(" ")[0]} — we'll review it and reach out if there's a fit.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
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
                <label className="block text-sm font-semibold mb-1.5">Role you're applying for</label>
                <input required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Full-Stack Developer, or General Application" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Location</label>
                <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Cape Town, South Africa" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Portfolio <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">LinkedIn <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">CV</label>
              <input ref={fileInputRef} required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm" />
              <p className="text-xs text-billboard-inkSoft mt-1.5">PDF or Word, up to {formatMB(CAREER_CV_MAX_BYTES)}.</p>
              {fileError && <p className="text-billboard-red text-xs font-semibold mt-1.5">{fileError}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Cover letter</label>
              <textarea required value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={6} placeholder="Tell us why you'd be a good fit." className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>

            <div {...wrapperProps}>
              <label htmlFor="careers-website">Leave this field empty</label>
              <input id="careers-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {submitError && <p className="text-billboard-red text-xs font-semibold mb-3">{submitError}</p>}
            {!isSupabaseConfigured && (
              <p className="text-xs text-billboard-inkSoft mb-3">The database isn't connected yet, so this form won't save — email {CONTACT_EMAIL} for now.</p>
            )}
            <Button type="submit" variant="primary" size="md" disabled={submitting || !isSupabaseConfigured} className="w-full">
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
