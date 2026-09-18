import * as LucideIcons from "lucide-react";
import { Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Same visual badge language as ChannelIcon (rounded-xl, 3px ink border,
 * yellow fill) so a ChatSched Tools card reads as the same family as a
 * channel card, not a different product bolted on. Unlike ChannelIcon's
 * fixed per-slug hand-drawn glyphs, a tool's icon is admin-entered free
 * text (any lucide-react export name, e.g. "Calculator") — resolved here
 * against the full icon set at render time, falling back to a generic
 * wrench for a blank, typo'd, or not-yet-set icon name so this never
 * renders empty.
 */
export default function ToolIcon({ name, size = "md" }: { name: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const Icon = (name && (LucideIcons as unknown as Record<string, LucideIcon>)[name]) || Wrench;
  const dims = size === "lg" ? "w-16 h-16" : size === "sm" ? "w-9 h-9" : "w-12 h-12";
  const iconDims = size === "lg" ? 28 : size === "sm" ? 16 : 22;
  return (
    <div className={`${dims} shrink-0 rounded-xl border-[3px] border-billboard-ink bg-billboard-yellow flex items-center justify-center shadow-blockSm text-billboard-ink`}>
      <Icon size={iconDims} strokeWidth={2} />
    </div>
  );
}
