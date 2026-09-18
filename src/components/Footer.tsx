import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CONTACT_EMAIL, CONTACT_ADDRESS_LINES, WHATSAPP_NUMBER_DISPLAY, whatsappLink } from "../lib/constants";
import InstallAppButton from "./InstallAppButton";
import LanguageSwitcher from "./LanguageSwitcher";

const WHATSAPP_LINK = whatsappLink("Hi, I'd like to know more");

const LINK_CLASS = "block text-sm mb-2 hover:text-billboard-yellow transition-colors";
const HEADING_CLASS = "font-mono text-xs uppercase tracking-wider text-[#8A8272] mb-3";

export default function Footer() {
  const { t } = useTranslation("common");

  return (
    <footer className="bg-billboard-ink text-billboard-paperDim pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 pb-12 border-b border-[#3A342B]">
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

          <div>
            <h4 className={HEADING_CLASS}>Platform</h4>
            <Link to="/browse" className={LINK_CLASS}>Browse advertising</Link>
            <Link to="/build-my-campaign" className={LINK_CLASS}>Build a campaign</Link>
            <Link to="/channels" className={LINK_CLASS}>Channels</Link>
            <Link to="/tools" className={LINK_CLASS}>ChatSched Tools</Link>
            <Link to="/pricing" className={LINK_CLASS}>Pricing</Link>
            <Link to="/for-businesses" className={LINK_CLASS}>For businesses</Link>
            <Link to="/for-publishers" className={LINK_CLASS}>For publishers</Link>
          </div>

          <div>
            <h4 className={HEADING_CLASS}>Explore</h4>
            <Link to="/categories" className={LINK_CLASS}>Categories</Link>
            <Link to="/suburbs" className={LINK_CLASS}>Locations</Link>
            <Link to="/audience-finder" className={LINK_CLASS}>Audience Finder</Link>
            <Link to="/compare" className={LINK_CLASS}>Compare placements</Link>
            <Link to="/case-studies" className={LINK_CLASS}>Examples</Link>
            <Link to="/blog" className={LINK_CLASS}>Resources</Link>
          </div>

          <div>
            <h4 className={HEADING_CLASS}>Trust & Help</h4>
            <Link to="/how-it-works" className={LINK_CLASS}>How it works</Link>
            <Link to="/trust" className={LINK_CLASS}>{t("footer.trustCentre")}</Link>
            <Link to="/faq" className={LINK_CLASS}>FAQ</Link>
            <Link to="/help" className={LINK_CLASS}>Help Centre</Link>
            <Link to="/compliance" className={LINK_CLASS}>{t("footer.complianceCentre")}</Link>
            <Link to="/contact" className={LINK_CLASS}>{t("footer.contact")}</Link>
          </div>

          <div>
            <h4 className={HEADING_CLASS}>Contact</h4>
            <a href={`mailto:${CONTACT_EMAIL}`} className={LINK_CLASS}>{CONTACT_EMAIL}</a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{WHATSAPP_NUMBER_DISPLAY}</a>
            <p className="text-sm leading-relaxed mb-3">{CONTACT_ADDRESS_LINES.join(", ")}</p>
            <Link to="/careers" className={LINK_CLASS}>Careers</Link>
            <Link to="/partners" className={LINK_CLASS}>Partners</Link>
            <InstallAppButton className="inline-flex items-center gap-1.5 text-xs font-semibold text-billboard-paperDim hover:text-billboard-yellow transition-colors" />
          </div>
        </div>

        <div className="pt-5 text-xs text-[#8A8272] flex flex-wrap justify-between gap-2">
          <span>{t("footer.copyright")}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-billboard-yellow">{t("footer.privacyPolicy")}</Link>
            <Link to="/terms" className="hover:text-billboard-yellow">{t("footer.terms")}</Link>
            <span>{t("footer.liveAcrossSA")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
