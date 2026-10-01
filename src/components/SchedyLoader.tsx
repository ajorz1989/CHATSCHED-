/**
 * Route-level loading state with Schedy, the ChatSched mascot (assets in
 * public/schedy, see the Schedy guide). The animated SVG runs its CSS
 * animation inside the <img>; visitors who prefer reduced motion get the
 * static preview instead via <picture>'s media query — no JS needed.
 * The illustration is decorative (alt=""); the real message is live text.
 */
export default function SchedyLoader() {
  return (
    <div className="max-w-6xl mx-auto px-5 py-16 flex flex-col items-center text-center" role="status" aria-live="polite">
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/schedy/schedy-loading-preview.png" />
        <img src="/schedy/schedy-loading-animated.svg" alt="" width={800} height={440} className="w-full max-w-[320px] h-auto" />
      </picture>
      <p className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft mt-2">Loading…</p>
    </div>
  );
}
