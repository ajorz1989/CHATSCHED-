import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { ADVERTISE_PRODUCTS, CONTACT_EMAIL } from "../lib/constants";
import type { AdvertiseProduct } from "../lib/types";
import Button from "../components/Button";

const FLOW = [
  {
    label: "Businesses",
    body: "Local businesses looking for an audience that's already paying attention.",
  },
  {
    label: "Publishers",
    body: "Social pages, creators, websites, podcasts and radio slots with real, reviewed audiences.",
  },
  {
    label: "Campaigns",
    body: "A request becomes a scheduled placement, tracked through to live and paid.",
  },
];

export default function CollaborateWithUs() {
  const [product, setProduct] = useState<AdvertiseProduct | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap — do not remove
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(honeypot)) {
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        setSent(true);
      }, 400);
      return;
    }
    if (!product) {
      setSubmitError("Please choose a collaboration type above.");
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
      setSubmitError(
        result.error ?? "Something went wrong. Please try again."
      );
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <Seo
        title="Collaborate With Us · ChatSched"
        description="Partner with ChatSched — advertise your business to an engaged local audience, explore sponsorship and brand placements, or connect with us about investment and strategic opportunities."
      />

      {/* ── Hero ── */}
      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">
            Collaborate with us
          </span>
          <h1 className="text-3xl md:text-4xl mb-5">
            Build something together with ChatSched.
          </h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">
            Whether you want to reach an engaged local audience, sponsor
            content, or explore a strategic partnership — this is where it
            starts.
          </p>
        </div>
      </section>

      {/* ── How the marketplace works (from Investors) ── */}
      <section className="bg-billboard-paperDim border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">
            How ChatSched works
          </span>
          <h2 className="font-display text-xl mt-2 mb-8">
            Businesses → Publishers → Campaigns.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FLOW.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper h-full">
                  <span className="font-display text-lg block mb-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-bold mb-1.5">{step.label}</h3>
                  <p className="text-sm text-billboard-inkSoft">{step.body}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="hidden sm:block absolute top-1/2 -right-4 -translate-y-1/2 font-display text-xl text-billboard-ink z-10">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem / Solution (from Investors) ── */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-red">
              The problem
            </span>
            <h2 className="font-display text-xl mt-2 mb-3">
              Small businesses struggle to find local audiences.
            </h2>
            <p className="text-billboard-inkSoft">
              Reaching the right customers nearby means guessing at ad
              platforms built for national scale, or relying on word of
              mouth — neither is built for a local business trying to reach
              a local audience.
            </p>
          </div>
          <div>
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-green">
              Our solution
            </span>
            <h2 className="font-display text-xl mt-2 mb-3">
              ChatSched connects businesses with publishers who already have
              those audiences.
            </h2>
            <p className="text-billboard-inkSoft">
              Social pages, creators, websites, podcasts and radio slots —
              every one of them already has a local audience paying
              attention. ChatSched is the layer that connects a business to
              the right one.
            </p>
          </div>
        </div>
      </section>

      {/* ── Advertising options ── */}
      <section className="bg-billboard-yellow border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">
            Advertising &amp; sponsorship
          </span>
          <h2 className="font-display text-2xl mb-2">
            Get seen by the businesses and publishers already on ChatSched.
          </h2>
          <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">
            This is advertising your own business inside ChatSched itself —
            not booking a placement with a publisher. For that,{" "}
            <Link
              to="/browse"
              className="underline hover:text-billboard-ink transition"
            >
              browse publishers here
            </Link>
            . Pick what fits — it pre-selects on the enquiry form below.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {ADVERTISE_PRODUCTS.map((p) => (
              <button
                type="button"
                key={p.value}
                onClick={() => setProduct(p.value)}
                className={`text-left border-[3px] rounded p-5 transition ${
                  product === p.value
                    ? "border-billboard-ink bg-billboard-paper"
                    : "border-billboard-ink hover:-translate-y-0.5"
                }`}
              >
                <span className="font-bold block mb-1">{p.label}</span>
                <span className="text-sm text-billboard-inkSoft">
                  {p.blurb}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision / Strategic context ── */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-yellowDeep">
          Vision
        </span>
        <h2 className="font-display text-xl mt-2 mb-3">
          Building the infrastructure that connects businesses with trusted
          audiences.
        </h2>
        <p className="text-billboard-inkSoft max-w-xl">
          Not another ad platform bolted onto someone else's feed — the
          underlying layer that makes finding, booking and trusting a local
          audience as simple as it should already be. If that mission
          resonates with you, we'd love to hear from you.
        </p>
      </section>

      {/* ── Enquiry form ── */}
      <section className="max-w-2xl mx-auto px-5 pb-20">
        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6">
            <h2 className="font-bold text-lg mb-1">Enquiry received.</h2>
            <p className="text-sm">
              Thanks — we'll be in touch with{" "}
              {companyName || "you"} shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="border-[3px] border-billboard-ink rounded p-6"
          >
            <h2 className="font-display text-lg mb-1">
              Tell us about your interest
            </h2>
            {!product && (
              <p className="text-billboard-inkSoft text-sm mb-4">
                Choose a collaboration type above to get started, or fill in
                the form and we'll figure out the best fit together.
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4 mb-4 mt-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Company name
                </label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Contact name
                </label>
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Phone{" "}
                  <span className="font-normal text-billboard-inkSoft">
                    (optional)
                  </span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  I'm interested in
                </label>
                <select
                  value={product ?? ""}
                  onChange={(e) =>
                    setProduct(
                      (e.target.value as AdvertiseProduct) || null
                    )
                  }
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white"
                >
                  <option value="">Select an option</option>
                  {ADVERTISE_PRODUCTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="investment">Investment / strategic partnership</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Budget range{" "}
                  <span className="font-normal text-billboard-inkSoft">
                    (optional)
                  </span>
                </label>
                <input
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                  placeholder="e.g. R5,000–R10,000/mo"
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">
                Tell us more
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="What you're hoping to achieve, your timeline, anything else useful."
                className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y"
              />
            </div>

            {/* Honeypot — invisible to real users */}
            <div {...wrapperProps}>
              <label htmlFor="collab-website">Leave this field empty</label>
              <input
                id="collab-website"
                name="hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {submitError && (
              <p className="text-billboard-red text-xs font-semibold mb-3">
                {submitError}
              </p>
            )}
            {!isSupabaseConfigured && (
              <p className="text-xs text-billboard-inkSoft mb-3">
                The database isn't connected yet, so this form won't save —
                email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="underline"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                for now.
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || !isSupabaseConfigured}
              className="w-full"
            >
              {submitting ? "Submitting…" : "Send enquiry"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
