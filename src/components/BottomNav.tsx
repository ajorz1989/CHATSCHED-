import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import NotificationList from "./NotificationList";
import type { Notification } from "../lib/types";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5 10 3l7 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function BrowseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="13.2" y1="13.2" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="2.5" width="6.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="8.5" width="6.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <path d="M2 13h12l-1.2-1.8A6 6 0 0 1 12 8V6.5A4 4 0 0 0 8 2.5a4 4 0 0 0-4 4V8a6 6 0 0 1-.8 3.2L2 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.3 13.5a1.8 1.8 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-semibold transition-colors ${
    isActive ? "text-billboard-greenDeep" : "text-billboard-inkSoft"
  }`;

export default function BottomNav() {
  const { user, profile } = useAuth();
  const { notifications, unreadCount, loaded, loadList, markAsRead, markAllAsRead } = useNotifications();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const dashboardTo = !user ? "/login" : profile?.role === "admin" ? "/admin" : "/dashboard";
  const dashboardLabel = !user ? "Log in" : profile?.role === "admin" ? "Admin" : "Dashboard";

  useEffect(() => {
    if (sheetOpen && !loaded) loadList();
  }, [sheetOpen, loaded, loadList]);

  // Lock body scroll while the sheet is open, same as any modal.
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sheetOpen]);

  function handleBellTap() {
    if (!user) {
      navigate("/login");
      return;
    }
    setSheetOpen(true);
  }

  function handleItemClick(n: Notification) {
    if (!n.read_at) markAsRead(n.id);
    setSheetOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-billboard-paper border-t-[3px] border-billboard-ink flex items-stretch h-14"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <NavLink to="/" end className={tabCls}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/browse" className={tabCls}>
          <BrowseIcon />
          Browse
        </NavLink>
        <NavLink to={dashboardTo} className={tabCls}>
          <DashboardIcon />
          {dashboardLabel}
        </NavLink>
        <button
          onClick={handleBellTap}
          aria-label="Notifications"
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-semibold transition-colors ${
            sheetOpen ? "text-billboard-greenDeep" : "text-billboard-inkSoft"
          }`}
        >
          <span className="relative">
            <BellIcon />
            {user && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-[3px] flex items-center justify-center rounded-full bg-billboard-red text-white text-[9px] font-mono font-bold border-2 border-billboard-paper">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          Alerts
        </button>
      </nav>

      {sheetOpen && (
        <div className="sm:hidden fixed inset-0 z-[60] flex items-end">
          <div
            className="absolute inset-0 bg-billboard-ink/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            className="relative w-full max-h-[75vh] bg-white border-t-[3px] border-billboard-ink rounded-t-2xl overflow-hidden flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="w-10 h-1 bg-billboard-ink/20 rounded-full mx-auto mt-2.5 mb-1" aria-hidden="true" />
            <NotificationList
              notifications={notifications}
              loaded={loaded}
              unreadCount={unreadCount}
              onMarkAllRead={markAllAsRead}
              onItemClick={handleItemClick}
              maxHeightClass="max-h-[60vh]"
            />
          </div>
        </div>
      )}
    </>
  );
}
