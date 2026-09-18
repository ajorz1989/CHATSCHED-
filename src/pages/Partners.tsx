import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { PARTNER_CATEGORIES, CONTACT_EMAIL } from "../lib/constants";
import type { PartnerCategory } from "../lib/types";
import Button from "../components/Button";

const BENEFITS = [
  { title: "A ready-made local network", body: "Businesses and publishers already using the platform, without you having to build that network yourself." },
  { title: "Referral relationships that compound", body: "Send a client or contact our way and stay part of that relationship going forward, not a one-off introduction." },
  { title: "Real South African reach", body: "Every partnership is grounded in the same thing the platform is built on: real local audiences, not vanity numbers." },
  { title: "A direct line to the team", body: "Small team, no account-manager layers — you deal directly with the people who can actually say yes." },
];

export default function Partners() {
  const [category, setCategory] = useState<PartnerCategory | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot field
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(honeypot)) {
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
    const result = await submitPublicForm("partner_directory", {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone.trim() || null,
      category,
      website: website.trim() || null,
      message,
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
      <Seo title="Partners · ChatSched" description="Grow your business with the ChatSched ecosystem — partner as a marketing agency, developer, PR agency, media organisation, and more." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Partners</span>
          <h1 className="text-3xl md:text-4xl mb-5">Grow your business with the ChatSched ecosystem.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl mb-6">ChatSched connects South African businesses with the local audiences worth reaching. Partners extend that reach further — bringing clients, integrations, and networks into the same ecosystem.</p>
          <Link to="/partners/apply" className="inline-block bg-billboard-yellow text-billboard-ink border-[3px] border-billboard-yellow font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition">
            Become a partner →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">Why partner with ChatSched</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">A handful of reasons partners work with us, not against us.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {BENEFITS.map((b) => (
            <div key={b.title} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5">{b.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 pb-16">
        <h2 className="font-display text-xl mb-2">Potential partners</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Pick the category that fits — it pre-selects it on the form below.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {PARTNER_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`text-left border-[3px] rounded p-4 transition ${category === c.value ? "border-billboard-ink bg-billboard-yellow" : "border-billboard-ink hover:-translate-y-0.5"}`}
            >
              <span className="font-bold text-sm block mb-1">{c.label}</span>
              <span className="text-xs text-billboard-inkSoft">{c.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Application received.</h2>
            <p className="text-sm">Thanks — we'll be in touch about partnering with {companyName || "you"}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
            <h2 className="font-display text-lg mb-1">Apply to partner</h2>
            {!category && <p className="text-billboard-inkSoft text-sm mb-4">Pick a category above to get started.</p>}

            <div className="grid sm:grid-cols-2 gap-4 mb-4 mt-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Company name</label>
                <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Contact name</label>
                <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Email</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Phone <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Category</label>
                <select required value={category ?? ""} onChange={(e) => setCategory(e.target.value as PartnerCategory)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
                  <option value="" disabled>Select a category</option>
                  {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Website <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">How would you want to partner?</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Tell us about your business and what a partnership could look like." className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>

            <div {...wrapperProps}>
              <label htmlFor="partners-website">Leave this field empty</label>
              <input id="partners-website" name="hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
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
