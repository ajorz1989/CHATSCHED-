import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { SCHEDY_LOADER } from './schedyAssets';

type Props = {
  /** Live text announced to screen readers and shown under Schedy. */
  label?: string;
  /** Set false to hide the visible caption (it stays available to screen readers). */
  showLabel?: boolean;
  className?: string;
};

/**
 * Full-area loading state. Uses the animated SVG via <img> (the CSS animation runs inside the SVG).
 * With reduced motion on, the static PNG is shown instead.
 * The real message is live text; the illustration is decorative (alt="").
 */
export function SchedyLoader({ label = 'Loading…', showLabel = true, className = '' }: Props) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}
    >
      <img
        src={reduced ? SCHEDY_LOADER.still : SCHEDY_LOADER.animated}
        alt=""
        width={SCHEDY_LOADER.w}
        height={SCHEDY_LOADER.h}
        className="h-auto w-full max-w-[320px]"
        decoding="async"
      />
      <p className={showLabel ? 'text-sm font-medium text-billboard-inkSoft' : 'sr-only'}>{label}</p>
    </div>
  );
}

export default SchedyLoader;
