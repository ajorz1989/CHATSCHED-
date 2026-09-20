import { useState, type FormEvent } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import Seo from "../components/Seo";
import Button from "../components/Button";
import MarketingIcon from "../components/MarketingIcon";
import { useHoneypot } from "../hooks/useHoneypot";
import { whatsappLink, CONTACT_EMAIL, CONTACT_WEBSITE, CONTACT_ADDRESS_LINES, WHATSAPP_NUMBER_DISPLAY } from "../lib/constants";

const WHATSAPP_LINK = whatsappLink("Hi, I'd like to know more about ChatSched");
const MAPS_LINK = "https://www.google.com/maps/search/?api=1&query=Century%20Boulevard%2C%20Century%20City%20Dr%2C%20Century%20City%2C%20Cape%20Town%2C%207440";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) {
      setSending(true);
      setTimeout(() => { setSending(false); setSent(true); }, 400);
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const result = await submitPublicForm("contact", { name, email, message });
      if (!result.ok) {
        setFormError(result.error ?? "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setFormError("We couldn't send your message. Please try WhatsApp or email instead.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Contact ChatSched | Cape Town, South Africa"
        description="Contact ChatSched in Cape Town, South Africa. Reach us by WhatsApp, email or visit our Century City address."
      />

      <section className="mb-12">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
          Get in touch
        </span>
        <h1 className="text-3xl md:text-5xl mb-3 max-w-3xl">Talk to ChatSched.</h1>
        <p className="text-billboard-inkSoft max-w-2xl text-lg">
          Whether you're planning a campaign, looking for advertising inventory, or need help with the platform,
          reach us directly and we'll point you in the right direction.
        </p>
      </section>

      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8">
        <div className="space-y-5">
          <section className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim">
            <h2 className="font-bold text-lg mb-2">Contact ChatSched</h2>
            <p className="text-sm text-billboard-inkSoft mb-5">
              WhatsApp is usually the fastest way to reach us. Email is available for longer enquiries and business correspondence.
            </p>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold px-5 py-3 rounded hover:bg-billboard-greenDeep transition"
            >
              Chat on WhatsApp
            </a>

            <div className="mt-6 space-y-4 text-sm">
              <p>
                <MarketingIcon name="chat" className="inline w-4 h-4 mr-1" />
                <span className="font-semibold">WhatsApp</span><br />
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                  {WHATSAPP_NUMBER_DISPLAY}
                </a>
              </p>
              <p>
                <MarketingIcon name="mail" className="inline w-4 h-4 mr-1" />
                <span className="font-semibold">Email</span><br />
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-semibold">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                <MarketingIcon name="globe" className="inline w-4 h-4 mr-1" />
                <span className="font-semibold">Website</span><br />
                <a href={`https://${CONTACT_WEBSITE}`} className="underline font-semibold">
                  {CONTACT_WEBSITE}
                </a>
              </p>
              <p>
                <MarketingIcon name="pin" className="inline w-4 h-4 mr-1" />
                <span className="font-semibold">Office</span><br />
                {CONTACT_ADDRESS_LINES.map((line) => <span key={line}>{line}<br /></span>)}
                <a href={MAPS_LINK} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 underline font-semibold">
                  Open address in Google Maps →
                </a>
              </p>
            </div>
          </section>

          <section className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
            <h2 className="font-bold text-lg mb-2">What can we help with?</h2>
            <ul className="text-sm text-billboard-inkSoft space-y-2">
              <li>• Build or plan a multi-channel advertising campaign</li>
              <li>• Find advertising inventory or publisher opportunities</li>
              <li>• Ask about partnerships or working with ChatSched</li>
              <li>• Get help with your account or campaign</li>
            </ul>
          </section>
        </div>

        <div>
          {sent ? (
            <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded-lg p-7 h-fit">
              <h2 className="font-bold text-xl mb-1">Message sent.</h2>
              <p className="text-sm">Thanks, {name.split(" ")[0] || "there"} — we'll get back to you directly.</p>
              <button
                type="button"
                onClick={() => { setSent(false); setMessage(""); }}
                className="mt-5 underline text-sm font-semibold"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-7 bg-white">
              <h2 className="font-bold text-xl mb-1">Send us a message</h2>
              <p className="text-sm text-billboard-inkSoft mb-6">Tell us what you need and we'll route your enquiry to the right place.</p>

              <div className="mb-4">
                <label htmlFor="contact-name" className="block text-sm font-semibold mb-1.5">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="contact-email" className="block text-sm font-semibold mb-1.5">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
                />
              </div>

              <div className="mb-5">
                <label htmlFor="contact-message" className="block text-sm font-semibold mb-1.5">How can we help?</label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  minLength={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Tell us about your campaign, advertising needs or question."
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y"
                />
              </div>

              <div {...wrapperProps}>
                <label htmlFor="contact-website">Leave this field empty</label>
                <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {formError && (
                <p role="alert" className="text-billboard-red text-xs font-semibold mb-3">
                  {formError}
                </p>
              )}

              {!isSupabaseConfigured && (
                <p className="text-xs text-billboard-inkSoft mb-3">
                  Online form submissions are currently unavailable. Please use WhatsApp or email instead.
                </p>
              )}

              <Button type="submit" variant="primary" size="md" disabled={sending || !isSupabaseConfigured} className="w-full">
                {sending ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
