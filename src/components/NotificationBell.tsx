import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import NotificationList from "./NotificationList";
import type { Notification } from "../lib/types";

export default function NotificationBell() {
  const { notifications, unreadCount, loaded, loadList, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && !loaded) loadList();
  }, [open, loaded, loadList]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleClick(n: Notification) {
    if (!n.read_at) markAsRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative w-9 h-9 flex items-center justify-center border-2 border-billboard-ink rounded hover:bg-billboard-paperDim transition"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 13h12l-1.2-1.8A6 6 0 0 1 12 8V6.5A4 4 0 0 0 8 2.5a4 4 0 0 0-4 4V8a6 6 0 0 1-.8 3.2L2 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6.3 13.5a1.8 1.8 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-billboard-red text-white text-[10px] font-mono font-bold border-2 border-billboard-paper">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] border-[3px] border-billboard-ink rounded-lg bg-white shadow-block z-50 overflow-hidden">
          <NotificationList
            notifications={notifications}
            loaded={loaded}
            unreadCount={unreadCount}
            onMarkAllRead={markAllAsRead}
            onItemClick={handleClick}
          />
        </div>
      )}
    </div>
  );
}
