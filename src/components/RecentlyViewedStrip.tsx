import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { loadRecentlyViewed } from "../lib/recentlyViewed";
import PublisherCard from "./PublisherCard";
import type { Publisher } from "../lib/types";

/**
 * Reads the viewer's own profile-view history (publisher_profile_views,
 * Phase 37 — the same table backing publisher-side traction) and shows
 * the listings they've actually looked at, most recent first. Renders
 * nothing at all when there's no history yet, or the viewer isn't logged
 * in — no empty-state box, no placeholder, this is meant to disappear
 * completely rather than take up space with nothing to show.
 */
export default function RecentlyViewedStrip({ excludeId }: { excludeId?: string }) {
  const { user } = useAuth();
  const [publishers, setPublishers] = useState<Publisher[] | null>(null);

  useEffect(() => {
    if (!user) {
      setPublishers([]);
      return;
    }
    let cancelled = false;
    loadRecentlyViewed(user.id).then((data) => {
      if (!cancelled) setPublishers(data);
    });
    return () => { cancelled = true; };
  }, [user]);

  const visible = (publishers ?? []).filter((p) => p.id !== excludeId);

  if (visible.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="font-display text-lg mb-3">Continue where you left off</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {visible.map((publisher) => (
          <div key={publisher.id} className="w-64 shrink-0 snap-start">
            <PublisherCard publisher={publisher} />
          </div>
        ))}
      </div>
    </section>
  );
}
