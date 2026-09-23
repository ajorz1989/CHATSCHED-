import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useComparison } from "../contexts/ComparisonContext";
import NotificationBell from "./NotificationBell";
import SiteSearch from "./SiteSearch";
import InstallAppButton from "./InstallAppButton";
import LanguageSwitcher from "./LanguageSwitcher";

const navCls = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-billboard-greenDeep"
    : "hover:text-billboard-greenDeep transition-colors";

const NAV_LINKS = [
  { to: "/browse", key: "nav.browse" },
  { to: "/build-my-campaign", key: "nav.agency" },
  { to: "/channels", key: "nav.channels" },
  { to: "/opportunities", key: "nav.opportunities" },
  { to: "/for-publishers", key: "nav.forPublishers" },
  { to: "/pricing", key: "nav.pricing" },
] as const;

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { count: compareCount } = useComparison();
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl w-full mx-auto min-w-0 flex items-center justify-between px-3 sm:px-5 py-3.5 gap-2 sm:gap-4">

        {/* Logo */}
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-1.5 sm:gap-2 font-display text-[15px] sm:text-lg shrink-0 min-w-0"
        >
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
            <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="truncate">CHATSCHED</span>
        </Link>

        {/* Primary nav — desktop only */}
        <nav className="hidden lg:flex items-center gap-5 font-semibold text-sm">
          {NAV_LINKS.map(({ to, key }) => (
            <NavLink key={to} to={to} className={navCls}>
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="hidden sm:block"><SiteSearch /></div>
          <div className="hidden sm:block"><LanguageSwitcher /></div>

          {/* Compare badge — only when publishers are queued */}
          {compareCount > 0 && (
            <Link
              to="/compare"
              className="hidden sm:inline-flex items-center gap-1.5 border-2 border-billboard-ink font-mono font-semibold text-xs px-2.5 py-1.5 rounded hover:-translate-y-0.5 transition bg-billboard-paperDim"
              title="View comparison"
            >
              {/* Simple label instead of Unicode box character */}
              Compare {compareCount}
            </Link>
          )}

          {/* Saved lists — desktop/tablet */}
          <NavLink
            to="/lists"
            className={({ isActive }) =>
              `hidden sm:inline text-sm font-semibold transition-colors ${
                isActive
                  ? "text-billboard-greenDeep"
                  : "text-billboard-inkSoft hover:text-billboard-ink"
              }`
            }
          >
            {t("nav.lists")}
          </NavLink>

          <InstallAppButton className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-billboard-inkSoft hover:text-billboard-ink transition-colors" />

          {/* Auth links */}
          {user ? (
            <>
              <span className="hidden sm:inline-flex"><NotificationBell /></span>
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
                type="button"
                onClick={() => signOut()}
                className="hidden sm:inline text-sm font-semibold text-billboard-inkSoft hover:text-billboard-red transition-colors"
              >
                {t("nav.logOut")}
              </button>
            </>
          ) : (
            <>
              {/* Keep authentication actions in the mobile drawer so the top bar stays compact. */}
              <Link
                to="/login"
                className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
              >
                {t("nav.logIn")}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 sm:gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded hover:bg-billboard-greenDeep transition hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                {t("nav.getStarted")}
              </Link>
            </>
          )}

          {/* Hamburger — tablet and below (hidden on lg+) */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden flex flex-col justify-center items-center gap-1.5 w-8 h-8 shrink-0"
          >
            <span
              className={`block w-5 h-0.5 bg-billboard-ink rounded transition-transform origin-center ${
                menuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-billboard-ink rounded transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-billboard-ink rounded transition-transform origin-center ${
                menuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile / tablet drawer — slides down below the header bar */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 top-[57px] z-40 bg-billboard-ink/30"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden absolute left-0 right-0 z-50 bg-billboard-paper border-b-[3px] border-billboard-ink shadow-blockSm"
          >
            <ul className="max-w-6xl mx-auto px-5 py-4 flex flex-col gap-1">
              {NAV_LINKS.map(({ to, key }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `block py-2.5 font-semibold text-sm border-b border-billboard-ink/10 ${
                        isActive ? "text-billboard-greenDeep" : "hover:text-billboard-greenDeep transition-colors"
                      }`
                    }
                  >
                    {t(key)}
                  </NavLink>
                </li>
              ))}

              {/* Divider */}
              <li className="pt-2 mt-2 border-t border-billboard-ink/10" aria-hidden="true" />
              <li>
                <div className="flex flex-wrap items-center gap-3 py-2.5">
                  <SiteSearch />
                  <LanguageSwitcher />
                  <NavLink
                    to="/lists"
                    onClick={closeMenu}
                    className="text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
                  >
                    {t("nav.lists")}
                  </NavLink>
                  {user && (
                    <InstallAppButton className="inline-flex items-center gap-1.5 text-sm font-semibold text-billboard-inkSoft hover:text-billboard-ink transition-colors" />
                  )}
                </div>
              </li>

              {user ? (
                <>
                  <li>
                    <NavLink
                      to={profile?.role === "admin" ? "/admin" : "/dashboard"}
                      onClick={closeMenu}
                      className="block py-2.5 font-semibold text-sm hover:text-billboard-greenDeep transition-colors"
                    >
                      {profile?.role === "admin" ? t("nav.admin") : t("nav.dashboard")}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/messages"
                      onClick={closeMenu}
                      className="block py-2.5 font-semibold text-sm hover:text-billboard-greenDeep transition-colors"
                    >
                      {t("nav.messages")}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/account"
                      onClick={closeMenu}
                      className="block py-2.5 font-semibold text-sm hover:text-billboard-greenDeep transition-colors"
                    >
                      {t("nav.account")}
                    </NavLink>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => { signOut(); closeMenu(); }}
                      className="block w-full text-left py-2.5 font-semibold text-sm text-billboard-inkSoft hover:text-billboard-red transition-colors"
                    >
                      {t("nav.logOut")}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="block py-2.5 font-semibold text-sm hover:text-billboard-greenDeep transition-colors"
                    >
                      {t("nav.logIn")}
                    </Link>
                  </li>
                  <li className="pt-1">
                    <Link
                      to="/register"
                      onClick={closeMenu}
                      className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold text-sm px-4 py-2.5 rounded hover:bg-billboard-greenDeep transition"
                    >
                      {t("nav.getStarted")}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </>
      )}
    </header>
  );
}
