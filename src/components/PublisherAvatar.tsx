// Audit finding: Publisher never had an image field — every card, profile
// page, and dashboard rendered initials-on-a-gradient for every publisher,
// everywhere, with no way to change that. This is the single place that
// fallback now lives: renders profile_image_url when a publisher has set
// one (schema_phase104_publisher_profile_image.sql), and the exact same
// initials-on-swatch circle every caller already had otherwise — so
// nothing regresses for the (likely majority, at first) publishers who
// haven't uploaded a photo yet.
const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "w-12 h-12 text-xs",     // PublisherCard
  md: "w-14 h-14 text-sm",     // dashboard header
  lg: "w-24 h-24 text-xl",     // PublisherProfile hero
};

export default function PublisherAvatar({
  imageUrl,
  initials,
  name,
  size = "md",
  shape = "circle",
  className = "",
}: {
  imageUrl: string | null;
  initials: string;
  name: string;
  size?: "sm" | "md" | "lg";
  /**
   * "circle" suits a person's photo. "tile" suits a business logo: logos are
   * usually already round or square with their own border, so cropping them
   * into a circle (object-cover) produced a doubled ring and clipped edges.
   * The tile shows the whole logo on white, inside the billboard-style
   * rounded-square frame.
   */
  shape?: "circle" | "tile";
  className?: string;
}) {
  const tile = shape === "tile";
  const base = `${SIZE_CLASS[size]} ${tile ? "rounded-xl" : "rounded-full"} border-[3px] border-billboard-ink flex items-center justify-center font-display shrink-0 overflow-hidden ${className}`;

  if (imageUrl) {
    return (
      <div className={`${base}${tile ? " bg-white" : ""}`}>
        <img src={imageUrl} alt={name} className={tile ? "w-full h-full object-contain p-1.5" : "w-full h-full object-cover"} loading="lazy" />
      </div>
    );
  }

  // Matches the bg-billboard-yellow initials circle every caller already
  // rendered before this component existed — same look, just centralized.
  return (
    <div className={`${base} bg-billboard-yellow`}>
      {initials}
    </div>
  );
}
