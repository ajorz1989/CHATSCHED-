/**
 * Skeleton loading primitives — on-theme replacements for bare spinners/blank space.
 * Uses the billboard palette (paperDim fill, ink border) and a shared shimmer animation
 * defined in index.css. Respects prefers-reduced-motion via the existing global rule.
 */

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={cx(
        "bg-billboard-paperDim border-[3px] border-billboard-ink/15 rounded skeleton-shimmer",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={cx(
        "h-3 bg-billboard-paperDim border border-billboard-ink/15 rounded-sm skeleton-shimmer",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonCircle({ className = "" }: { className?: string }) {
  return (
    <div
      className={cx(
        "rounded-full bg-billboard-paperDim border-[3px] border-billboard-ink/15 skeleton-shimmer",
        className
      )}
      aria-hidden="true"
    />
  );
}

/** Card-shaped skeleton matching PublisherCard's proportions (image header + body lines). */
export function PublisherCardSkeleton() {
  return (
    <div className="border-[3px] border-billboard-ink/15 rounded bg-white overflow-hidden flex flex-col" role="presentation">
      <SkeletonBlock className="h-28 rounded-none border-x-0 border-t-0" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <SkeletonLine className="w-2/3 h-4" />
        <SkeletonLine className="w-1/3" />
        <div className="flex gap-2 mt-1">
          <SkeletonLine className="w-16" />
          <SkeletonLine className="w-16" />
        </div>
        <div className="mt-auto pt-2 flex gap-2">
          <SkeletonBlock className="h-8 flex-1" />
          <SkeletonBlock className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

/** Grid of publisher card skeletons — drop-in replacement for a loading grid. */
export function PublisherGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading results">
      {Array.from({ length: count }).map((_, i) => (
        <PublisherCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A row of skeleton text lines — for table rows, list rows, message bubbles, etc. */
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-3 p-3 border-b border-billboard-ink/10", className)} aria-hidden="true">
      <SkeletonCircle className="h-9 w-9 shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonLine className="w-1/3" />
        <SkeletonLine className="w-1/2 h-2.5" />
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={cx("border-[3px] border-billboard-ink/15 rounded bg-white overflow-hidden", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Small inline skeleton for compact spaces like a dropdown or bell panel. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3 p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-2">
          <SkeletonCircle className="h-6 w-6 shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col gap-1.5">
            <SkeletonLine className="w-4/5" />
            <SkeletonLine className="w-2/5 h-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stat-card skeleton for dashboard/earnings summary tiles. */
export function StatCardSkeleton() {
  return (
    <div className="border-[3px] border-billboard-ink/15 rounded bg-white p-4 flex flex-col gap-2" role="presentation">
      <SkeletonLine className="w-1/2 h-2.5" />
      <SkeletonLine className="w-1/3 h-6" />
    </div>
  );
}

export function StatCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Generic block of skeleton paragraph lines, e.g. for a profile bio or chart placeholder. */
export function SkeletonParagraph({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}
