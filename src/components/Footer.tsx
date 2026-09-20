import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CONTACT_EMAIL, CONTACT_ADDRESS_LINES, WHATSAPP_NUMBER_DISPLAY, whatsappLink } from "../lib/constants";
import InstallAppButton from "./InstallAppButton";
import LanguageSwitcher from "./LanguageSwitcher";

const WHATSAPP_LINK = whatsappLink("Hi, I'd like to know more");

const LINK_CLASS = "block text-sm mb-2 hover:text-billboard-yellow transition-colors";
const HEADING_CLASS = "font-mono text-xs uppercase tracking-wider text-[#8A8272] mb-3";

/**
 * The footer mirrors the header's five primary destinations in a quick-links
 * row, then keeps the depth below it — grouped by what someone is trying to
 * do (advertise / publish / trust us) rather than by internal page
 * hierarchy.
 *
 * Both the header and this row are deliberately capped at the same five
 * links so there's exactly one mental model for "where do I go next",
 * whether someone is at the top of a page or the bottom of one. Everything
 * that used to sit in a flat 7-link "Platform" column (which mixed
 * advertiser, publisher and company links together) now lives in a column
 * that says who it's for.
 */
const QUICK_LINKS = [
  { to: "/browse", label: "Browse ad space" },
  { to: "/build-my-campaign", label: "Build a campaign" },
  { to: "/channels", label: "Channels" },
  { to: "/channels/compare", label: "Compare channels" },
  { to: "/for-publishers", label: "Publisher Network" },
];

export default function Footer() {
  const { t } = useTranslation("common");

  return (
    <footer className="bg-billboard-ink text-billboard-paperDim pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-5">

        {/* Quick links — the same five destinations as the header, so the
            header and footer can never drift apart again. */}
        <nav
          aria-label="Quick links"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-8 mb-10 border-b border-[#3A342B] font-semibold text-sm"
        >
          {QUICK_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className="text-billboard-paper hover:text-billboard-yellow transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 pb-12 border-b border-[#3A342B]">

          {/* Brand + tagline */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 pr-4">
            <div className="flex items-center gap-2 font-display text-lg text-billboard-paper mb-2">
              <svg width="24" height="20" viewBox="0 0 26 22" fill="none">
                <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2" />
                <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
                <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2" />
              </svg>
              CHATSCHED
            </div>
            <p className="text-sm max-w-[32ch] mb-4">{t("footer.tagline")}</p>
            <LanguageSwitcher compact />
          </div>

          {/* Advertise */}
          <div>
            <h4 className={HEADING_CLASS}>Advertise</h4>
            <Link to="/browse" className={LINK_CLASS}>Browse ad space</Link>
            <Link to="/build-my-campaign" className={LINK_CLASS}>Build a campaign</Link>
            <Link to="/channels/compare" className={LINK_CLASS}>Compare channels</Link>
            <Link to="/tools" className={LINK_CLASS}>ChatSched Tools</Link>
            <Link to="/audience-finder" className={LINK_CLASS}>{t("nav.audienceFinder")}</Link>
            <Link to="/suburbs" className={LINK_CLASS}>{t("nav.suburbs")}</Link>
            <Link to="/categories" className={LINK_CLASS}>{t("nav.categories")}</Link>
            <Link to="/pricing" className={LINK_CLASS}>Pricing</Link>
          </div>

          {/* Publish */}
          <div>
            <h4 className={HEADING_CLASS}>Publish</h4>
            <Link to="/for-publishers" className={LINK_CLASS}>Join as a publisher</Link>
            <Link to="/how-payment-works" className={LINK_CLASS}>How you get paid</Link>
            <Link to="/opportunities/preview" className={LINK_CLASS}>Open briefs</Link>
            <Link to="/case-studies" className={LINK_CLASS}>Case studies</Link>
            <Link to="/channels" className={LINK_CLASS}>Channels</Link>
          </div>

          {/* Trust & help */}
          <div>
            <h4 className={HEADING_CLASS}>Trust &amp; help</h4>
            <Link to="/how-it-works" className={LINK_CLASS}>How it works</Link>
            <Link to="/trust" className={LINK_CLASS}>{t("footer.trustCentre")}</Link>
            <Link to="/faq" className={LINK_CLASS}>FAQ</Link>
            <Link to="/help" className={LINK_CLASS}>Help Centre</Link>
            <Link to="/platform-rules" className={LINK_CLASS}>Platform rules</Link>
            <Link to="/compliance" className={LINK_CLASS}>{t("footer.complianceCentre")}</Link>
          </div>

          {/* Company + contact */}
          <div>
            <h4 className={HEADING_CLASS}>Company</h4>
            <Link to="/about" className={LINK_CLASS}>About ChatSched</Link>
            <Link to="/blog" className={LINK_CLASS}>Blog</Link>
            <Link to="/collaborate" className={LINK_CLASS}>Collaborate with us</Link>
            <Link to="/careers" className={LINK_CLASS}>Careers</Link>
            <Link to="/partners" className={LINK_CLASS}>Partners</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className={LINK_CLASS}>{CONTACT_EMAIL}</a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{WHATSAPP_NUMBER_DISPLAY}</a>
            <p className="text-sm leading-relaxed mb-3">{CONTACT_ADDRESS_LINES.join(", ")}</p>
            <InstallAppButton className="inline-flex items-center gap-1.5 text-xs font-semibold text-billboard-paperDim hover:text-billboard-yellow transition-colors" />
          </div>
        </div>

        {/* Newsletter strip */}
        <div className="py-8 border-b border-[#3A342B]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-billboard-paper text-sm mb-0.5">One email a month. Real numbers.</p>
              <p className="text-xs text-[#8A8272]">What local advertising is actually costing, what converts, and the new inventory that just opened. No spam.</p>
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Newsletter subscription&body=Please add me to the ChatSched newsletter.`}
              className="inline-flex items-center gap-2 border-2 border-billboard-yellow text-billboard-yellow font-semibold text-sm px-4 py-2.5 rounded hover:bg-billboard-yellow hover:text-billboard-ink transition shrink-0"
            >
              Subscribe via email
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-5 text-xs text-[#8A8272] flex flex-wrap justify-between gap-2">
          <span>{t("footer.copyright")}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-billboard-yellow">{t("footer.privacyPolicy")}</Link>
            <Link to="/terms" className="hover:text-billboard-yellow">{t("footer.terms")}</Link>
            <Link to="/accessibility" className="hover:text-billboard-yellow">Accessibility</Link>
            <span>{t("footer.liveAcrossSA")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
