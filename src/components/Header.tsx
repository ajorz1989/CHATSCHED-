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
  isActive ? "text-billboard-greenDeep" : "hover:text-billboard-greenDeep transition-colors";

const PRIMARY_LINKS = [
  { to: "/for-publishers", key: "nav.forPublishers" },
  { to: "/opportunities", key: "nav.opportunities" },
  { to: "/channels", key: "nav.channels" },
  { to: "/pricing", key: "nav.pricing" },
] as const;

const ADVERTISE_LINKS = [
  { to: "/build-my-campaign", key: "nav.agency" },
  { to: "/browse", key: "nav.browse" },
  { to: "/audience-finder", key: "nav.audienceFinder" },
  { to: "/budget-calculator", key: "nav.budgetCalculator" },
] as const;

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { count: compareCount } = useComparison();
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);
  const [advertiseOpen, setAdvertiseOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
    setAdvertiseOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-[1400px] w-full mx-auto min-w-0 flex items-center justify-between px-3 sm:px-5 py-3 gap-2 sm:gap-4">
        <Link to="/" onClick={closeMenu} className="flex items-center gap-1.5 sm:gap-2 font-display text-[15px] sm:text-lg shrink-0 min-w-0">
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
            <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="truncate">CHATSCHED</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-5 font-semibold text-sm whitespace-nowrap">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={advertiseOpen}
              onClick={() => setAdvertiseOpen((open) => !open)}
              className="inline-flex items-center gap-1 hover:text-billboard-greenDeep transition-colors"
            >
              Advertise
              <span className={`text-[10px] transition-transform ${advertiseOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {advertiseOpen && (
              <div className="absolute top-full left-0 mt-3 w-60 border-2 border-billboard-ink rounded-lg bg-white shadow-blockSm p-2">
                {ADVERTISE_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setAdvertiseOpen(false)}
                    className={({ isActive }) => `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-billboard-yellow font-bold" : "hover:bg-billboard-paperDim"}`}
                  >
                    {t(link.key)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          {PRIMARY_LINKS.map(({ to, key }) => (
            <NavLink key={to} to={to} className={`${navCls} whitespace-nowrap`}>{t(key)}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="hidden sm:block"><SiteSearch /></div>
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {compareCount > 0 && (
            <Link to="/compare" className="hidden sm:inline-flex items-center border-2 border-billboard-ink font-mono font-semibold text-xs px-2.5 py-1.5 rounded bg-billboard-paperDim">Compare {compareCount}</Link>
          )}
          <NavLink to="/lists" className={({ isActive }) => `hidden sm:inline text-sm font-semibold transition-colors ${isActive ? "text-billboard-greenDeep" : "text-billboard-inkSoft hover:text-billboard-ink"}`}>{t("nav.lists")}</NavLink>
          <InstallAppButton className="hidden xl:inline-flex items-center gap-1.5 text-sm font-semibold text-billboard-inkSoft hover:text-billboard-ink transition-colors" />

          {user ? (
            <>
              <span className="hidden sm:inline-flex"><NotificationBell /></span>
              <Link to="/messages" className="hidden xl:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors">{t("nav.messages")}</Link>
              <Link to={profile?.role === "admin" ? "/admin" : "/dashboard"} className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors">{profile?.role === "admin" ? t("nav.admin") : t("nav.dashboard")}</Link>
              <Link to="/account" className="hidden xl:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors">{t("nav.account")}</Link>
              <button type="button" onClick={() => signOut()} className="hidden xl:inline text-sm font-semibold text-billboard-inkSoft hover:text-billboard-red transition-colors">{t("nav.logOut")}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline text-sm font-semibold hover:text-billboard-greenDeep transition-colors">{t("nav.logIn")}</Link>
              <Link to="/register" className="inline-flex items-center border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded hover:bg-billboard-greenDeep transition">{t("nav.getStarted")}</Link>
            </>
          )}

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="lg:hidden flex flex-col justify-center items-center gap-1.5 w-8 h-8 shrink-0"
          >
            <span className={`block w-5 h-0.5 bg-billboard-ink rounded transition-transform origin-center ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-billboard-ink rounded transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-billboard-ink rounded transition-transform origin-center ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 top-[55px] z-40 bg-billboard-ink/30" onClick={closeMenu} aria-hidden="true" />
          <nav aria-label="Mobile navigation" className="lg:hidden absolute left-0 right-0 z-50 bg-billboard-paper border-b-[3px] border-billboard-ink shadow-blockSm max-h-[calc(100vh-55px)] overflow-y-auto">
            <div className="max-w-6xl mx-auto px-5 py-4">
              <div className="border-2 border-billboard-ink rounded-lg bg-white p-2 mb-3">
                <div className="font-mono text-[9px] uppercase tracking-wider text-billboard-inkSoft px-2 py-1">{t("nav.advertise")}</div>
                {ADVERTISE_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className="block rounded px-3 py-2.5 text-sm font-semibold hover:bg-billboard-paperDim"
                  >
                    {t(link.key)}
                  </NavLink>
                ))}
              </div>
              <div className="grid gap-1">
                {PRIMARY_LINKS.map(({ to, key }) => (
                  <NavLink key={to} to={to} onClick={closeMenu} className={({ isActive }) => `block py-3 border-b border-billboard-ink/10 font-semibold text-sm ${isActive ? "text-billboard-greenDeep" : ""}`}>{t(key)}</NavLink>
                ))}
                <NavLink to="/lists" onClick={closeMenu} className="block py-3 border-b border-billboard-ink/10 font-semibold text-sm">{t("nav.lists")}</NavLink>
              </div>
              <div className="flex flex-wrap items-center gap-3 py-4 border-b border-billboard-ink/10">
                <SiteSearch />
                <LanguageSwitcher />
                {user && <InstallAppButton className="inline-flex items-center gap-1.5 text-sm font-semibold text-billboard-inkSoft" />}
              </div>
              {user ? (
                <div className="grid gap-1 pt-2">
                  <NavLink to={profile?.role === "admin" ? "/admin" : "/dashboard"} onClick={closeMenu} className="py-2.5 font-semibold text-sm">{profile?.role === "admin" ? t("nav.admin") : t("nav.dashboard")}</NavLink>
                  <NavLink to="/messages" onClick={closeMenu} className="py-2.5 font-semibold text-sm">{t("nav.messages")}</NavLink>
                  <NavLink to="/account" onClick={closeMenu} className="py-2.5 font-semibold text-sm">{t("nav.account")}</NavLink>
                  <button type="button" onClick={() => { signOut(); closeMenu(); }} className="py-2.5 text-left font-semibold text-sm text-billboard-inkSoft">{t("nav.logOut")}</button>
                </div>
              ) : (
                <div className="grid gap-2 pt-4">
                  <Link to="/login" onClick={closeMenu} className="block py-2.5 font-semibold text-sm">{t("nav.logIn")}</Link>
                  <Link to="/register" onClick={closeMenu} className="brand-button dark w-full">{t("nav.getStarted")}</Link>
                </div>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
