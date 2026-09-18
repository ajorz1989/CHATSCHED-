import { useState, type FormEvent } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import Seo from "../components/Seo";
import Button from "../components/Button";
import MarketingIcon from "../components/MarketingIcon";
import { useHoneypot } from "../hooks/useHoneypot";
import { whatsappLink, CONTACT_EMAIL, CONTACT_WEBSITE, CONTACT_ADDRESS_LINES, WHATSAPP_NUMBER_DISPLAY } from "../lib/constants";

const WHATSAPP_LINK = whatsappLink("Hi, I'd like to know more about ChatSched");

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never see this field
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) {
      // Behave exactly like success so a bot has no signal it was caught —
      // just skip the actual insert.
      setSending(true);
      setTimeout(() => { setSending(false); setSent(true); }, 400);
      return;
    }
    setSending(true);
    setFormError(null);
    const result = await submitPublicForm("contact", { name, email, message });
    setSending(false);
    if (!result.ok) setFormError(result.error ?? "Something went wrong. Please try again.");
    else setSent(true);
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo title="Contact · ChatSched" description="Get in touch about ChatSched — reach us on WhatsApp or by email." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Get in touch</span>
      <h1 className="text-3xl md:text-4xl mb-2 max-w-xl">Talk to a real person, not a ticket queue.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">Reach out and you'll hear back from a real person — usually within a day.</p>

      <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-10">
        <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim h-fit">
          <h2 className="font-bold text-lg mb-2">Message us on WhatsApp</h2>
          <p className="text-sm text-billboard-inkSoft mb-5">Usually the fastest way to reach us — most messages get a reply within a day.</p>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold px-5 py-3 rounded hover:bg-billboard-greenDeep transition">
            Chat on WhatsApp
          </a>
          <p className="text-xs text-billboard-inkSoft mt-5"><MarketingIcon name="chat" className="inline w-4 h-4 mr-1" />WhatsApp<br /><a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{WHATSAPP_NUMBER_DISPLAY}</a></p>
          <p className="text-xs text-billboard-inkSoft mt-4"><MarketingIcon name="mail" className="inline w-4 h-4 mr-1" />Email<br /><a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">{CONTACT_EMAIL}</a></p>
          <p className="text-xs text-billboard-inkSoft mt-4"><MarketingIcon name="globe" className="inline w-4 h-4 mr-1" />Website<br /><a href={`https://${CONTACT_WEBSITE}`} className="font-semibold underline">{CONTACT_WEBSITE}</a></p>
          <p className="text-xs text-billboard-inkSoft mt-4"><MarketingIcon name="pin" className="inline w-4 h-4 mr-1" />Address<br />{CONTACT_ADDRESS_LINES.map((line) => <span key={line}>{line}<br /></span>)}</p>
        </div>

        {sent ? (
          <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-6 h-fit">
            <h2 className="font-bold text-lg mb-1">Message sent.</h2>
            <p className="text-sm">Thanks, {name.split(" ")[0]} — we'll get back to you directly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Message</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
            </div>
            <div {...wrapperProps}>
              <label htmlFor="contact-website">Leave this field empty</label>
              <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            {formError && <p className="text-billboard-red text-xs font-semibold mb-3">{formError}</p>}
            {!isSupabaseConfigured && (
              <p className="text-xs text-billboard-inkSoft mb-3">The database isn't connected yet, so this form won't save — use WhatsApp or email for now.</p>
            )}
            <Button type="submit" variant="primary" size="md" disabled={sending || !isSupabaseConfigured} className="w-full">
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
