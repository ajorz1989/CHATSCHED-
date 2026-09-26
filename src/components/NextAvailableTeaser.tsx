import { useAvailability } from "../hooks/useAvailability";

// Same local-date formatting as AvailabilityCalendar.tsx's toDateStr — kept
// as its own copy rather than a shared import since that one lives inside
// a component file, not a lib module; see that file's own such comments
// elsewhere in this codebase for why small formatting helpers like this
// often stay local rather than becoming a shared util for one call site.
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEARCH_WINDOW_DAYS = 60;

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

/**
 * "Next available: 3 Oct" teaser near the request CTA, so a business can
 * gut-check fit before scrolling down to the full AvailabilityCalendar.
 * Reads the same publisher_blocked_dates data that calendar already uses
 * (via useAvailability) — no new query, no new table.
 */
export default function NextAvailableTeaser({ publisherId }: { publisherId: string }) {
  const { blockedDates, loaded } = useAvailability(publisherId);

  if (!loaded) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextOpen: Date | null = null;
  for (let i = 0; i < SEARCH_WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (!blockedDates.includes(toDateStr(d))) {
      nextOpen = d;
      break;
    }
  }

  const label = !nextOpen
    ? `Fully booked for the next ${SEARCH_WINDOW_DAYS} days`
    : nextOpen.getTime() === today.getTime()
      ? "Available today"
      : `Next available: ${formatShort(nextOpen)}`;

  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-billboard-greenDeep mb-5">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <circle cx="6" cy="6" r="5" fill="currentColor" fillOpacity="0.15" />
        <circle cx="6" cy="6" r="2" fill="currentColor" />
      </svg>
      {label}
    </div>
  );
}
