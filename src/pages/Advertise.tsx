import { useState, type FormEvent } from "react";
import Seo from "../components/Seo";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { ADVERTISE_PRODUCTS, CONTACT_EMAIL } from "../lib/constants";
import type { AdvertiseProduct } from "../lib/types";
import Button from "../components/Button";

export default function Advertise() {
  const [product, setProduct] = useState<AdvertiseProduct | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
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
    if (!product) {
      setSubmitError("Pick what you're interested in above.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitPublicForm("advertise", {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone.trim() || null,
      product,
      budget_range: budgetRange.trim() || null,
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
      <Seo title="Advertise With ChatSched · ChatSched" description="Put your business in front of the businesses and publishers already using ChatSched — website advertising, newsletter sponsorship, featured placement, sponsored articles, and brand partnerships." />

      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">Advertise with us</span>
          <h1 className="text-3xl md:text-4xl mb-5">Get seen by the businesses and publishers already on ChatSched.</h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl">This is advertising your own business inside ChatSched itself — not booking a placement with a publisher. For that, use Browse Advertising.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">What's available</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Pick what fits — it pre-selects it on the enquiry form below.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {ADVERTISE_PRODUCTS.map((p) => (
            <button
              type="button"
              key={p.value}
              onClick={() => setProduct(p.value)}
              className={`text-left border-[3px] rounded p-5 transition ${product === p.value ? "border-billboard-ink bg-billboard-yellow" : "border-billboard-ink hover:-translate-y-0.5"}`}
            >
              <span className="font-bold block mb-1">{p.label}</span>
              <span className="text-sm text-billboard-inkSoft">{p.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Enquiry received.</h2>
            <p className="text-sm">Thanks — we'll be in touch about advertising with {companyName || "you"}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
            <h2 className="font-display text-lg mb-1">Tell us about your business</h2>
            {!product && <p className="text-billboard-inkSoft text-sm mb-4">Pick what you're interested in above to get started.</p>}

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
                <label className="block text-sm font-semibold mb-1.5">Interested in</label>
                <select required value={product ?? ""} onChange={(e) => setProduct(e.target.value as AdvertiseProduct)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
                  <option value="" disabled>Select an option</option>
                  {ADVERTISE_PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Budget range <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="e.g. R5,000–R10,000/mo" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Tell us more</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="What you're hoping to achieve, timing, anything else useful." className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>

            <div {...wrapperProps}>
              <label htmlFor="advertise-website">Leave this field empty</label>
              <input id="advertise-website" name="hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            {submitError && <p className="text-billboard-red text-xs font-semibold mb-3">{submitError}</p>}
            {!isSupabaseConfigured && (
              <p className="text-xs text-billboard-inkSoft mb-3">The database isn't connected yet, so this form won't save — email {CONTACT_EMAIL} for now.</p>
            )}
            <Button type="submit" variant="primary" size="md" disabled={submitting || !isSupabaseConfigured} className="w-full">
              {submitting ? "Submitting…" : "Send enquiry"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
