import { SkeletonList } from "./Skeleton";
import EmptyState from "./EmptyState";
import type { Notification } from "../lib/types";

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationList({
  notifications,
  loaded,
  unreadCount,
  onMarkAllRead,
  onItemClick,
  maxHeightClass = "max-h-96",
}: {
  notifications: Notification[];
  loaded: boolean;
  unreadCount: number;
  onMarkAllRead: () => void;
  onItemClick: (n: Notification) => void;
  maxHeightClass?: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-billboard-ink bg-billboard-paperDim">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Notifications</span>
        {unreadCount > 0 && (
          <button onClick={onMarkAllRead} className="font-mono text-[10px] font-semibold uppercase underline text-billboard-inkSoft hover:text-billboard-ink">
            Mark all read
          </button>
        )}
      </div>

      <div className={`${maxHeightClass} overflow-y-auto`}>
        {!loaded ? (
          <SkeletonList count={3} />
        ) : notifications.length === 0 ? (
          <EmptyState
            kind="bell"
            title="Nothing yet"
            description="You'll see requests, messages and payments here."
            compact
          />
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onItemClick(n)}
              className={`w-full text-left px-4 py-3 border-b border-billboard-ink/10 last:border-b-0 hover:bg-billboard-paperDim transition ${!n.read_at ? "bg-[#FBF6E9]" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-billboard-red mt-1.5 shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm leading-snug ${!n.read_at ? "font-bold" : "font-semibold"}`}>{n.title}</p>
                  <p className="text-xs text-billboard-inkSoft mt-0.5 leading-snug">{n.body}</p>
                  <p className="font-mono text-[10px] text-billboard-inkSoft mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
