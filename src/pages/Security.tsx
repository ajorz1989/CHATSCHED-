import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";

const PRACTICES = [
  {
    title: "Row-level security on every table",
    body: "Every table in the database enforces its own access rules at the database layer — a business can't read another business's requests, a publisher can't read another publisher's earnings, and admin access requires a verified admin account. This runs whether the request comes from the app or directly against the API.",
  },
  {
    title: "Mandatory two-factor authentication for admin",
    body: "Every admin account requires a TOTP authenticator app before it can access anything in /admin — not optional, and enforced at login, not just recommended in a settings page.",
  },
  {
    title: "Payments verified, not trusted",
    body: "Every payment notification from PayFast is independently re-verified — the signature is recomputed server-side and checked against what was received before a payment is ever marked as paid. A forged or tampered notification fails that check and is rejected.",
  },
  {
    title: "Third-party credentials encrypted at rest",
    body: "OAuth tokens for connected social accounts are encrypted (AES-256-GCM) before they're stored, with the encryption key held only as a server-side secret, never in the database itself. A database-level exposure alone isn't enough to make those credentials usable.",
  },
  {
    title: "Every admin action is logged",
    body: "Status changes, approvals, and other admin actions are written to an audit log — who did what, to which record, and when — so admin activity is reviewable, not just trusted.",
  },
  {
    title: "Self-service data deletion",
    body: "Accounts can be deleted directly from account settings, not just requested by email. Deletion is blocked while something financially unresolved is still tied to the account, so it can't be used to make an active request vanish on the other party.",
  },
];

export default function Security() {
  return (
    <div>
      <Seo title="Security · ChatSched" description="How ChatSched protects data and accounts — row-level security, mandatory admin 2FA, verified payment webhooks, encrypted credentials, audit logging, and self-service data deletion." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Security</span>
          <h1 className="text-3xl md:text-4xl mb-5">How ChatSched protects data and accounts.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">This is about the platform itself — how accounts, payments and data are protected. For how the marketplace guards against fraud and fake audiences, see the <Link to="/trust/fraud-prevention" className="underline">Trust Centre</Link>.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <div className="grid sm:grid-cols-2 gap-5">
          {PRACTICES.map((p) => (
            <div key={p.title} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5">{p.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-2">Related</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            <Link to="/trust" className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition">
              <h3 className="font-bold text-sm mb-1">Trust Centre</h3>
              <p className="text-xs text-billboard-inkSoft">Verification, disputes, creator & business standards.</p>
            </Link>
            <Link to="/privacy" className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition">
              <h3 className="font-bold text-sm mb-1">Privacy Policy</h3>
              <p className="text-xs text-billboard-inkSoft">What's collected, why, and how long it's kept.</p>
            </Link>
            <Link to="/transparency" className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition">
              <h3 className="font-bold text-sm mb-1">Transparency</h3>
              <p className="text-xs text-billboard-inkSoft">Live platform stats, dispute handling, platform rules.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Found a security issue?</h2>
            <p className="text-sm text-billboard-inkSoft">Please report it directly rather than publicly — reach us at {CONTACT_EMAIL}.</p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`} className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center">
            Report an issue →
          </a>
        </div>
      </section>
    </div>
  );
}
