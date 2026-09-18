import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { PARTNER_TYPES, CONTACT_EMAIL } from "../lib/constants";
import type { PartnerType } from "../lib/types";
import Button from "../components/Button";

export default function PartnersApply() {
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
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
    if (!partnerType) {
      setSubmitError("Pick a partner type above.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitPublicForm("partner_apply", {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone.trim() || null,
      partner_type: partnerType,
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
      <Seo title="Become a Partner · ChatSched" description="Apply to become a ChatSched partner — Agency, Technology, Media, Community, or Referral Partner." />

      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <Link to="/partners" className="inline-block font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink mb-4">← Back to Partners</Link>
          <h1 className="text-3xl md:text-4xl mb-5">Become a ChatSched Partner.</h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl">Pick the kind of partner you'd be — then tell us a bit about your business.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">Partner types</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {PARTNER_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setPartnerType(t.value)}
              className={`text-left border-[3px] rounded p-5 transition ${partnerType === t.value ? "border-billboard-ink bg-billboard-yellow" : "border-billboard-ink hover:-translate-y-0.5"}`}
            >
              <span className="font-bold block mb-1">{t.label}</span>
              <span className="text-sm text-billboard-inkSoft">{t.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Application received.</h2>
            <p className="text-sm">Thanks — we'll be in touch about {companyName || "your"} partnership.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
            {!partnerType && <p className="text-billboard-inkSoft text-sm mb-4">Pick a partner type above to get started.</p>}

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
                <label className="block text-sm font-semibold mb-1.5">Partner type</label>
                <select required value={partnerType ?? ""} onChange={(e) => setPartnerType(e.target.value as PartnerType)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
                  <option value="" disabled>Select a partner type</option>
                  {PARTNER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Website <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Tell us about your business</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="What you do, and what this partnership would look like." className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>

            <div {...wrapperProps}>
              <label htmlFor="partners-apply-website">Leave this field empty</label>
              <input id="partners-apply-website" name="hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
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
