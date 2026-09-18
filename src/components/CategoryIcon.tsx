type IconName = "food" | "fitness" | "beauty" | "home" | "family" | "auto" | "fashion" | "tech"
  | "lifestyle" | "news" | "community" | "retail" | "property" | "pets" | "events" | "social";

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function CategoryIcon({ name, className = "w-7 h-7" }: { name: IconName; className?: string }) {
  switch (name) {
    case "food":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
          <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
          <path d="M8 3.5c0 1-1 1-1 2M12 3.5c0 1-1 1-1 2" strokeWidth={1.5} />
        </svg>
      );
    case "fitness":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="2" y="9" width="4" height="6" rx="1" />
          <rect x="18" y="9" width="4" height="6" rx="1" />
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      );
    case "beauty":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
          <rect x="10" y="14" width="4" height="6" />
        </svg>
      );
    case "family":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <circle cx="9" cy="12" r="6" />
          <circle cx="15" cy="12" r="6" />
        </svg>
      );
    case "auto":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2" />
          <line x1="12" y1="3" x2="12" y2="10" />
          <line x1="5" y1="16" x2="10.5" y2="13.3" />
          <line x1="19" y1="16" x2="13.5" y2="13.3" />
        </svg>
      );
    case "fashion":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M6 8h12l-1 12H7L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case "tech":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      );
    case "lifestyle":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="4" y="5" width="16" height="14" rx="1" />
          <line x1="7" y1="9" x2="17" y2="9" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="15" x2="13" y2="15" />
        </svg>
      );
    case "community":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <circle cx="7" cy="14" r="4" />
          <circle cx="17" cy="14" r="4" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "retail":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
          <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "property":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <circle cx="7.5" cy="16.5" r="3.5" />
          <path d="M10 14l9-9" />
          <path d="M16 8l2.5 2.5M19 5.5L21.5 8" />
        </svg>
      );
    case "pets":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <circle cx="7" cy="8" r="1.8" />
          <circle cx="12" cy="6" r="1.8" />
          <circle cx="17" cy="8" r="1.8" />
          <path d="M12 12c-3 0-5.5 2-5.5 4.5S9 20 12 20s5.5-1 5.5-3.5S15 12 12 12z" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
          <line x1="12" y1="6" x2="12" y2="18" strokeDasharray="2 2" />
        </svg>
      );
    case "social":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <line x1="9" y1="4" x2="7" y2="20" />
          <line x1="17" y1="4" x2="15" y2="20" />
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
        </svg>
      );
  }
}
