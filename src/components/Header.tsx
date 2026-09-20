import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useComparison } from "../contexts/ComparisonContext";
import NotificationBell from "./NotificationBell";
import SiteSearch from "./SiteSearch";
import InstallAppButton from "./InstallAppButton";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Primary navigation — deliberately capped at FIVE links.
 *
 * The brief for this pass is "optimised for speed and clarity": a business
 * owner should be able to look at the header once and know the two things
 * they came to do (advertise, or get paid to advertise). Everything that
 * supports those two jobs — pricing, how it works, comparisons, case
 * studies, categories, audience finder — lives in the "More" menu below,
 * reachable in one click, instead of competing for attention in the bar.
 *
 * The previous six-item bar (Browse / Build a Campaign / Channels / Tools /
 * For Publishers / Pricing) was already close; Pricing moved into More, and
 * the overflow menu absorbed the six or so links that were previously only
 * reachable from the footer.
 */
const NAV_LINKS = [
  { to: "/browse", key: "nav.browse" },
  { to: "/build-my-campaign", key: "nav.agency" },
  { to: "/channels", key: "nav.channels" },
  { to: "/tools", key: "nav.tools" },
  { to: "/for-publishers", key: "nav.forPublishers" },
] as const;

/** Secondary links — one click deep, never in the primary bar. */
const MORE_LINKS = [
  { to: "/channels/compare", key: "nav.compareChannels" },
  { to: "/pricing", key: "nav.pricing" },
  { to: "/how-it-works", key: "nav.howItWorks" },
  { to: "/case-studies", key: "nav.caseStudies" },
  { to: "/audience-finder", key: "nav.audienceFinder" },
  { to: "/categories", key: "nav.categories" },
  { to: "/suburbs", key: "nav.suburbs" },
  { to: "/trust", key: "footer.trustCentre" },
] as const;

const navCls = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-billboard-greenDeep"
    : "hover:text-billboard-greenDeep transition-colors";

function MoreMenu({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  // Close on route change, and on any click/tap outside the menu.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const isActive = MORE_LINKS.some((l) => l.to === pathname);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 font-semibold transition-colors ${
          isActive ? "text-billboard-greenDeep" : "hover:text-billboard-greenDeep"
        }`}
      >
        {t("nav.more")}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+14px)] w-56 border-[3px] border-billboard-ink rounded bg-billboard-paper shadow-block py-2 z-50">
          {MORE_LINKS.map(({ to, key }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => { setOpen(false); onNavigate(); }}
              className={({ isActive: a }) =>
                `block px-4 py-2.5 text-sm font-semibold transition-colors ${
                  a ? "text-billboard-greenDeep bg-billboard-paperDim" : "hover:bg-billboard-paperDim"
                }`
              }
            >
              {t(key)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3.5 gap-4">

        {/* Logo */}
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-2 font-display text-lg shrink-0"
        >
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
            <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2" />
          </svg>
          CHATSCHED
        </Link>

        {/* Primary nav — five links, desktop only */}
        <nav className="hidden lg:flex items-center gap-5 font-semibold text-sm">
          {NAV_LINKS.map(({ to, key }) => (
            <NavLink key={to} to={to} className={navCls}>
              {t(key)}
            </NavLink>
          ))}
          <MoreMenu onNavigate={closeMenu} />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <SiteSearch />
          <LanguageSwitcher />

          {/* Compare badge — only when publishers are queued */}
          {compareCount > 0 && (
            <Link
              to="/compare"
              className="hidden sm:inline-flex items-center gap-1.5 border-2 border-billboard-ink font-mono font-semibold text-xs px-2.5 py-1.5 rounded hover:-translate-y-0.5 transition bg-billboard-paperDim"
              title="View comparison"
            >
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
                type="button"
                onClick={() => signOut()}
                className="hidden sm:inline text-sm font-semibold text-billboard-inkSoft hover:text-billboard-red transition-colors"
              >
                {t("nav.logOut")}
              </button>
            </>
          ) : (
            <>
              {/* Bug fix: Sign In was hidden on mobile — now always visible as a text link */}
              <Link
                to="/login"
                className="text-sm font-semibold hover:text-billboard-greenDeep transition-colors"
              >
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

              {/* Secondary links — below a labelled divider so the drawer has
                  the same 5-then-the-rest shape as the desktop bar. */}
              <li className="pt-3 pb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">
                  {t("nav.more")}
                </span>
              </li>
              {MORE_LINKS.map(({ to, key }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `block py-2 font-semibold text-sm border-b border-billboard-ink/10 ${
                        isActive ? "text-billboard-greenDeep" : "text-billboard-inkSoft hover:text-billboard-ink transition-colors"
                      }`
                    }
                  >
                    {t(key)}
                  </NavLink>
                </li>
              ))}

              {/* Divider */}
              <li className="pt-3" aria-hidden="true" />

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
