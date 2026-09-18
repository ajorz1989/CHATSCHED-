import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useComparison } from "../contexts/ComparisonContext";
import NotificationBell from "./NotificationBell";
import SiteSearch from "./SiteSearch";
import InstallAppButton from "./InstallAppButton";
import LanguageSwitcher from "./LanguageSwitcher";

const navCls = ({ isActive }: { isActive: boolean }) =>
  isActive ? "text-billboard-greenDeep" : "hover:text-billboard-greenDeep transition-colors";

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { count: compareCount } = useComparison();
  const { t } = useTranslation("common");

  return (
    <header className="sticky top-0 z-50 bg-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3.5 gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-display text-lg shrink-0">
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
            <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2" />
          </svg>
          CHATSCHED
        </Link>

        {/* Primary nav */}
        <nav className="hidden lg:flex items-center gap-5 font-semibold text-sm">
          <NavLink to="/browse" className={navCls}>{t("nav.browse")}</NavLink>
          <NavLink to="/build-my-campaign" className={navCls}>{t("nav.agency")}</NavLink>
          <NavLink to="/channels" className={navCls}>{t("nav.channels")}</NavLink>
          <NavLink to="/tools" className={navCls}>{t("nav.tools")}</NavLink>
          <NavLink to="/for-publishers" className={navCls}>{t("nav.forPublishers")}</NavLink>
          <NavLink to="/pricing" className={navCls}>{t("nav.pricing")}</NavLink>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <SiteSearch />
          <LanguageSwitcher />

          {/* Compare badge — only appears when there are publishers in the list */}
          {compareCount > 0 && (
            <Link
              to="/compare"
              className="hidden sm:inline-flex items-center gap-1.5 border-2 border-billboard-ink font-mono font-semibold text-xs px-2.5 py-1.5 rounded hover:-translate-y-0.5 transition bg-billboard-paperDim"
              title="View comparison"
            >
              ⊞ {compareCount}
            </Link>
          )}

          {/* Saved lists */}
          <NavLink
            to="/lists"
            className={({ isActive }) =>
              `hidden sm:inline text-sm font-semibold transition-colors ${isActive ? "text-billboard-greenDeep" : "text-billboard-inkSoft hover:text-billboard-ink"}`
            }
          >
            {t("nav.lists")}
          </NavLink>

          <InstallAppButton className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-billboard-inkSoft hover:text-billboard-ink transition-colors" />

          {/* Auth links */}
          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/messages"
                className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
              >
                {t("nav.messages")}
              </Link>
              <Link
                to={profile?.role === "admin" ? "/admin" : "/dashboard"}
                className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
              >
                {profile?.role === "admin" ? t("nav.admin") : t("nav.dashboard")}
              </Link>
              <Link
                to="/account"
                className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
              >
                {t("nav.account")}
              </Link>
              <button
                onClick={() => signOut()}
                className="hidden sm:inline text-sm font-semibold text-billboard-inkSoft hover:text-billboard-red transition-colors"
              >
                {t("nav.logOut")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors">
                {t("nav.logIn")}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold text-sm px-4 py-2.5 rounded hover:bg-billboard-greenDeep transition hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                {t("nav.getStarted")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
