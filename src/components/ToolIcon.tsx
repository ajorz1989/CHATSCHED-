import {
  BarChart3, Bell, BookOpen, Briefcase, Calculator, Calendar, CheckCircle, ClipboardList, Compass, FileText,
  Gauge, Gift, Globe, Heart, Image, Lightbulb, LineChart, Link as LinkIcon, Mail, Map, Megaphone, MessageCircle,
  Mic, Percent, PieChart, Radio, Rocket, Search, Share2, ShieldCheck, Sparkles, Store, Tag, Target, Timer,
  TrendingUp, Users, Video, Wallet, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The icons a tool can use. Only these are bundled: importing the whole lucide
 * set (`import * as`) added about 1.4 MB of source to the main JS file every
 * visitor downloads. A name not in this list (or a blank one) shows the wrench.
 * To offer another icon, add it to the import above and to this map.
 */
const TOOL_ICONS: Record<string, LucideIcon> = {
  BarChart3, Bell, BookOpen, Briefcase, Calculator, Calendar, CheckCircle, ClipboardList, Compass, FileText,
  Gauge, Gift, Globe, Heart, Image, Lightbulb, LineChart, Link: LinkIcon, Mail, Map, Megaphone, MessageCircle,
  Mic, Percent, PieChart, Radio, Rocket, Search, Share2, ShieldCheck, Sparkles, Store, Tag, Target, Timer,
  TrendingUp, Users, Video, Wallet, Wrench, Zap,
};

export const TOOL_ICON_NAMES = Object.keys(TOOL_ICONS);

/**
 * Same visual badge language as ChannelIcon (rounded-xl, 3px ink border,
 * yellow fill) so a ChatSched Tools card reads as the same family as a
 * channel card, not a different product bolted on. Unlike ChannelIcon's
 * fixed per-slug hand-drawn glyphs, a tool's icon is admin-entered free
 * text (any lucide-react export name, e.g. "Calculator") — resolved here
 * against TOOL_ICONS at render time, falling back to a generic
 * wrench for a blank, typo'd, or not-yet-set icon name so this never
 * renders empty.
 */
export default function ToolIcon({ name, size = "md" }: { name: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const Icon = (name && Object.prototype.hasOwnProperty.call(TOOL_ICONS, name) ? TOOL_ICONS[name] : null) || Wrench;
  const dims = size === "lg" ? "w-16 h-16" : size === "sm" ? "w-9 h-9" : "w-12 h-12";
  const iconDims = size === "lg" ? 28 : size === "sm" ? 16 : 22;
  return (
    <div className={`${dims} shrink-0 rounded-xl border-[3px] border-billboard-ink bg-billboard-yellow flex items-center justify-center shadow-blockSm text-billboard-ink`}>
      <Icon size={iconDims} strokeWidth={2} />
    </div>
  );
}
