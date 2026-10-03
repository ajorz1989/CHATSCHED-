// Cover strip for a publisher profile. Previously a bare gradient block —
// on listings with no cover art it read as an unfinished, empty orange slab.
// Now: the listing's swatch gradient, billboard-style diagonal stripes (same
// motif as VisualIdentitySystem), and the ChatSched mark as a faint
// watermark. Purely decorative — alt="" and aria-hidden.
export default function ProfileBanner({ swatch }: { swatch: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-36 md:h-44 overflow-hidden bg-gradient-to-br ${swatch} border-b-[3px] border-billboard-ink`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(-18deg, transparent 0 22px, rgba(10,10,10,0.07) 22px 24px)" }}
      />
      <img
        src="/brand/mark-ink.svg"
        alt=""
        className="absolute -right-6 -bottom-10 h-64 w-64 md:h-72 md:w-72 opacity-[0.09] select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
