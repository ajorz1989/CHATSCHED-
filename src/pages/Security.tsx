import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";

// Last reviewed date — update this whenever the security page content is
// audited or a new practice is added.
const LAST_REVIEWED = "September 2026";

const PRACTICES = [
  {
    title: "Row-level security on every table",
    body: "Every table in the database enforces its own access rules at the database layer \u2014 a business can\u2019t read another business\u2019s requests, a publisher can\u2019t read another publisher\u2019s earnings, and admin access requires a verified admin account. This runs whether the request comes from the app or directly against the API.",
  },
  {
    title: "Mandatory two-factor authentication for admin",
    body: "Every admin account requires a TOTP authenticator app before it can access anything in /admin \u2014 not optional, and enforced at login, not just recommended in a settings page.",
  },
  {
    title: "Two-factor authentication for users",
    body: "Publishers and businesses can enable TOTP-based two-factor authentication from their account settings. Once enabled, a valid authenticator code is required at every login \u2014 a compromised password alone isn\u2019t enough to access the account.",
  },
  {
    title: "All data encrypted in transit",
    body: "Every connection to ChatSched is served over HTTPS with TLS. There is no plaintext fallback \u2014 unencrypted requests are redirected automatically. Data between the app and the database also travels over encrypted connections only.",
  },
  {
    title: "Payments verified, not trusted",
    body: "Every payment notification from PayFast is independently re-verified \u2014 the signature is recomputed server-side and checked against what was received before a payment is ever marked as paid. A forged or tampered notification fails that check and is rejected.",
  },
  {
    title: "Third-party credentials encrypted at rest",
    body: "OAuth tokens for connected social accounts are encrypted (AES-256-GCM) before they\u2019re stored, with the encryption key held only as a server-side secret, never in the database itself. A database-level exposure alone isn\u2019t enough to make those credentials usable.",
  },
  {
    title: "Session management and expiry",
    body: "Authentication tokens expire after a fixed window. Users can sign out from all active sessions at once from their account settings, immediately invalidating any session on any device \u2014 useful after a lost phone or a suspected account compromise.",
  },
  {
    title: "Rate limiting and brute-force protection",
    body: "Login attempts, password resets, and public form submissions are rate-limited server-side. Repeated failed attempts trigger a temporary lockout before any account can be accessed \u2014 automated credential-stuffing attacks are blocked before they can make progress.",
  },
  {
    title: "Every admin action is logged",
    body: "Status changes, approvals, and other admin actions are written to an audit log \u2014 who did what, to which record, and when \u2014 so admin activity is reviewable, not just trusted.",
  },
  {
    title: "Self-service data deletion",
    body: "Accounts can be deleted directly from account settings, not just requested by email. Deletion is blocked while something financially unresolved is still tied to the account, so it can\u2019t be used to make an active request vanish on the other party.",
  },
];

export default function Security() {
  return (
    <div>
      <Seo
        title="Security \u00b7 ChatSched"
        description="How ChatSched protects data and accounts \u2014 row-level security, mandatory admin 2FA, user 2FA, TLS encryption, verified payment webhooks, session management, rate limiting, encrypted credentials, audit logging, and self-service data deletion."
      />

      {/* Hero */}
      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">
            Security
          </span>
          <h1 className="text-3xl md:text-4xl mb-5">
            How ChatSched protects data and accounts.
          </h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl mb-4">
            This is about the platform itself \u2014 how accounts, payments and data are protected.
            For how the marketplace guards against fraud and fake audiences, see the{" "}
            <Link to="/trust/fraud-prevention" className="underline hover:text-billboard-yellow transition">
              Trust Centre
            </Link>
            .
          </p>
          <p className="font-mono text-xs text-billboard-paperDim/60">
            Last reviewed: {LAST_REVIEWED}
          </p>
        </div>
      </section>

      {/* Security practices grid */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <div className="grid sm:grid-cols-2 gap-5">
          {PRACTICES.map((p) => (
            <div
              key={p.title}
              className="border-[3px] border-billboard-ink rounded p-5 bg-white hover:-translate-y-0.5 transition"
            >
              {/* Yellow accent bar */}
              <div className="w-8 h-1 bg-billboard-yellow rounded mb-3" />
              <h3 className="font-bold mb-1.5">{p.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">
            Responsible Disclosure
          </span>
          <h2 className="font-display text-xl mt-2 mb-4">
            Found a security issue? Please tell us privately.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-bold text-sm mb-1">What to report</h3>
              <p className="text-sm text-billboard-inkSoft">
                Authentication bypasses, data exposure, payment manipulation, privilege escalation,
                or anything that could let one user access another user\u2019s data or funds.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1">What to expect</h3>
              <p className="text-sm text-billboard-inkSoft">
                We\u2019ll acknowledge your report within 2 business days and keep you updated as
                we investigate. We ask that you give us reasonable time to fix the issue before
                any public disclosure.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1">How to report</h3>
              <p className="text-sm text-billboard-inkSoft">
                Email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`}
                  className="underline hover:text-billboard-ink transition font-semibold"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                with a clear description of the issue, steps to reproduce it, and any relevant
                screenshots or proof-of-concept. Please do not disclose it publicly first.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1">Out of scope</h3>
              <p className="text-sm text-billboard-inkSoft">
                Social engineering, phishing, denial-of-service, and reports that require
                physical access to a device are out of scope. We also can\u2019t act on reports
                that don\u2019t include a reproducible way to verify the issue.
              </p>
            </div>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`}
            className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition"
          >
            Report a security issue \u2192
          </a>
        </div>
      </section>

      {/* Related links */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">Related</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/trust"
            className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
          >
            <h3 className="font-bold text-sm mb-1">Trust Centre</h3>
            <p className="text-xs text-billboard-inkSoft">
              Verification, disputes, creator &amp; business standards.
            </p>
          </Link>
          <Link
            to="/trust/fraud-prevention"
            className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
          >
            <h3 className="font-bold text-sm mb-1">Fraud Prevention</h3>
            <p className="text-xs text-billboard-inkSoft">
              How the marketplace guards against fake audiences and fraud.
            </p>
          </Link>
          <Link
            to="/privacy"
            className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
          >
            <h3 className="font-bold text-sm mb-1">Privacy Policy</h3>
            <p className="text-xs text-billboard-inkSoft">
              What\u2019s collected, why, and how long it\u2019s kept.
            </p>
          </Link>
          <Link
            to="/transparency"
            className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
          >
            <h3 className="font-bold text-sm mb-1">Transparency</h3>
            <p className="text-xs text-billboard-inkSoft">
              Live platform stats, dispute handling, platform rules.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
