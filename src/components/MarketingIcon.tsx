export type MarketingIconName =
  | "location" | "rocket" | "chart" | "chat" | "bag" | "event"
  | "document" | "check" | "megaphone" | "money" | "star"
  | "building" | "wave" | "lock" | "shield" | "globe" | "pin"
  | "mail" | "microphone" | "smartphone" | "people" | "bolt" | "camera"
  | "briefcase";

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function MarketingIcon({ name, className = "w-7 h-7" }: { name: MarketingIconName; className?: string }) {
  const base = { viewBox: "0 0 24 24", className, ...common };
  switch (name) {
    case "location": return <svg {...base}><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.3" /></svg>;
    case "rocket": return <svg {...base}><path d="M14 4c2.8-.8 5.2-.8 6 0 .8.8.8 3.2 0 6l-7.5 7.5-4-4L16 6Z" /><path d="M8.5 15.5 5 19" /><path d="M6 14 3 13l3-3" /><circle cx="16.5" cy="7.5" r="1.3" /></svg>;
    case "chart": return <svg {...base}><line x1="4" y1="20" x2="4" y2="10" /><line x1="10" y1="20" x2="10" y2="6" /><line x1="16" y1="20" x2="16" y2="12" /><line x1="22" y1="20" x2="22" y2="3" /></svg>;
    case "chat": return <svg {...base}><path d="M4 5.5h16v10H9l-5 4v-14Z" /><path d="M8 9h8M8 12h5" /></svg>;
    case "bag": return <svg {...base}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case "event": return <svg {...base}><path d="M4 6h16v14H4z" /><path d="M8 3v6M16 3v6M4 10h16" /></svg>;
    case "document": return <svg {...base}><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>;
    case "check": return <svg {...base}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "megaphone": return <svg {...base}><path d="M4 12v-2l13-5v14L4 14v-2Z" /><path d="M17 9.5 21 8v8l-4-1.5M7 15l1 5" /></svg>;
    case "money": return <svg {...base}><rect x="3" y="6" width="18" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9h.01M18 15h.01" /></svg>;
    case "star": return <svg {...base}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
    case "building": return <svg {...base}><path d="M4 21V5h10v16M14 9h6v12M7 8h4M7 12h4M7 16h4M17 13h1M17 17h1" /></svg>;
    case "wave": return <svg {...base}><path d="M3 9c2.2 0 2.2 6 4.5 6S9.8 9 12 9s2.2 6 4.5 6S18.8 9 21 9" /><path d="M3 5c2.2 0 2.2 6 4.5 6S9.8 5 12 5s2.2 6 4.5 6S18.8 5 21 5" /></svg>;
    case "lock": return <svg {...base}><rect x="5" y="10" width="14" height="11" rx="1.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "shield": return <svg {...base}><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "globe": return <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.5 3.2 5.5 3.2 9s-1 6.5-3.2 9c-2.2-2.5-3.2-5.5-3.2-9S9.8 5.5 12 3Z" /></svg>;
    case "pin": return <svg {...base}><path d="M12 21s6-5.6 6-11A6 6 0 0 0 6 10c0 5.4 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></svg>;
    case "mail": return <svg {...base}><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="m4 7 8 6 8-6" /></svg>;
    case "microphone": return <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>;
    case "smartphone": return <svg {...base}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M10 5h4M11 18.5h2" /></svg>;
    case "people": return <svg {...base}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 14c3.5 0 5.5 2 5.5 6" /></svg>;
    case "bolt": return <svg {...base}><path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" /></svg>;
    case "camera": return <svg {...base}><path d="M4 7h4l1.5-2h5L16 7h4v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
    case "briefcase": return <svg {...base}><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2" /></svg>;
  }
}
