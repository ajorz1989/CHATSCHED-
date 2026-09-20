import type { Category, Platform, WorkWithUsCategory, PartnerCategory, PartnerType, AdvertiseProduct, CommunityEventType, CommunityQuestionCategory } from "./types";
import { formatCurrency } from "./currency";

export const CATEGORIES: Category[] = [
  { slug: "food", name: "Food & Drink", icon: "food" },
  { slug: "fitness", name: "Fitness & Wellness", icon: "fitness" },
  { slug: "beauty", name: "Beauty & Grooming", icon: "beauty" },
  { slug: "home", name: "Home & Trade Services", icon: "home" },
  { slug: "family", name: "Family & Community", icon: "family" },
  { slug: "auto", name: "Automotive", icon: "auto" },
  { slug: "fashion", name: "Fashion & Lifestyle", icon: "fashion" },
  { slug: "tech", name: "Tech & Gaming", icon: "tech" },
  { slug: "local-lifestyle", name: "Local Lifestyle", icon: "lifestyle" },
  { slug: "regional-news", name: "Regional News", icon: "news" },
  { slug: "community-groups", name: "Community Groups", icon: "community" },
  { slug: "retail", name: "Retail & Shopping", icon: "retail" },
  { slug: "property", name: "Property & Real Estate", icon: "property" },
  { slug: "pets", name: "Pets & Animals", icon: "pets" },
  { slug: "events", name: "Events & Entertainment", icon: "events" },
  { slug: "social-followers", name: "Social Followers", icon: "social" },
];

export const PROVINCES = [
  "Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape",
  "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape",
];

export const PLATFORMS: Platform[] = ["Facebook Page", "Facebook Group", "Instagram", "TikTok", "WhatsApp Channel", "X", "LinkedIn", "YouTube"];

export const PLACEMENT_TYPES = [
  "Story Post",
  "Main Feed / Page Post",
  "Short-form Video (Reels / TikTok / Shorts)",
  "Dedicated Video",
  "Carousel Post",
  "Bio Link / Link-in-Bio Placement",
] as const;

export type PlacementType = (typeof PLACEMENT_TYPES)[number];

export const RECOMMENDED_PLACEMENT_TYPES_BY_PLATFORM: Record<Platform, PlacementType[]> = {
  "Facebook Page": ["Main Feed / Page Post", "Story Post", "Short-form Video (Reels / TikTok / Shorts)"],
  "Facebook Group": ["Main Feed / Page Post"],
  "Instagram": ["Story Post", "Main Feed / Page Post", "Short-form Video (Reels / TikTok / Shorts)", "Carousel Post", "Bio Link / Link-in-Bio Placement"],
  "TikTok": ["Short-form Video (Reels / TikTok / Shorts)", "Bio Link / Link-in-Bio Placement"],
  "WhatsApp Channel": ["Main Feed / Page Post"],
  "X": ["Main Feed / Page Post", "Short-form Video (Reels / TikTok / Shorts)"],
  "LinkedIn": ["Main Feed / Page Post", "Carousel Post", "Dedicated Video"],
  "YouTube": ["Dedicated Video", "Short-form Video (Reels / TikTok / Shorts)"],
};

export function recommendedPlacementTypes(platforms: Platform[]): PlacementType[] {
  const set = new Set<PlacementType>();
  for (const p of platforms) {
    for (const t of RECOMMENDED_PLACEMENT_TYPES_BY_PLATFORM[p] ?? []) set.add(t);
  }
  return [...set];
}

export const LANGUAGES = [
  "English", "Afrikaans", "Zulu", "Xhosa", "Sotho", "Tswana",
  "Venda", "Tsonga", "Ndebele", "Swati", "Portuguese", "French",
];

export interface CitySuburbs { city: string; province: string; suburbs: string[] }

export const SA_CITIES_SUBURBS: CitySuburbs[] = [
  {
    city: "Cape Town", province: "Western Cape",
    suburbs: [
      "City Bowl", "Sea Point", "Green Point", "Camps Bay", "Woodstock",
      "Observatory", "Claremont", "Rondebosch", "Newlands", "Constantia",
      "Century City", "Table View", "Milnerton", "Bellville", "Durbanville",
      "Parow", "Goodwood", "Muizenberg", "Somerset West", "Mitchells Plain",
    ],
  },
  {
    city: "Johannesburg", province: "Gauteng",
    suburbs: [
      "Sandton", "Rosebank", "Randburg", "Fourways", "Midrand",
      "Melville", "Parktown", "Bryanston", "Soweto", "Bedfordview",
      "Northcliff", "Greenside", "Linden", "Houghton", "Parkview",
      "Emmarentia", "Bassonia", "Glenvista", "Lenasia", "Braamfontein",
    ],
  },
  {
    city: "Pretoria", province: "Gauteng",
    suburbs: [
      "Centurion", "Hatfield", "Brooklyn", "Menlyn", "Waterkloof",
      "Lynnwood", "Arcadia", "Sunnyside", "Montana", "Silverton",
      "Garsfontein", "Faerie Glen", "Moreleta Park", "Equestria", "Mamelodi",
      "Soshanguve", "Akasia", "Groenkloof", "Mooikloof", "Menlo Park",
    ],
  },
  {
    city: "Durban", province: "KwaZulu-Natal",
    suburbs: [
      "Umhlanga", "Durban North", "Berea", "Glenwood", "Westville",
      "Pinetown", "Hillcrest", "Kloof", "Amanzimtoti", "La Lucia",
      "Morningside", "Musgrave", "Chatsworth", "Phoenix", "Umlazi",
      "Bluff", "Queensburgh", "Umbilo", "Overport", "Mount Edgecombe",
    ],
  },
  {
    city: "Pietermaritzburg", province: "KwaZulu-Natal",
    suburbs: [
      "Ashburton", "Athlone", "Bellevue", "Bisley", "Blackridge",
      "Boughton", "Clarendon", "Edendale", "Epworth", "Hayfields",
      "Imbali", "Lynnfield Park", "Pelham", "Prestbury", "Scottsville",
      "Sweetwaters", "Wembley", "Westgate", "Winterskloof", "Northdale",
    ],
  },
  {
    city: "Gqeberha", province: "Eastern Cape",
    suburbs: [
      "Summerstrand", "Mill Park", "Walmer", "Humewood", "Lorraine",
      "Fairview", "Bluewater Bay", "Lovemore Heights", "Sunridge Park", "Fernglen",
      "Mount Croix", "Newton Park", "Greenacres", "Algoa Park", "Motherwell",
      "Central", "Kabega Park", "Charlo", "Sydenham", "Framesby",
    ],
  },
  {
    city: "East London", province: "Eastern Cape",
    suburbs: [
      "Gonubie", "Vincent", "Beacon Bay", "Berea", "Nahoon",
      "Quigney", "Selborne", "Southernwood", "Stirling", "Amalinda",
      "Cambridge", "Bonnie Doone", "Bunker's Hill", "Baysville", "West Bank",
      "Sunnyridge", "Bonza Bay", "Winterstrand", "Braelyn", "Dorchester",
    ],
  },
  {
    city: "Bloemfontein", province: "Free State",
    suburbs: [
      "Heidedal", "Bainsvlei", "Brandwag", "Fauna", "Fichardt Park",
      "Fleurdal", "Pellissier", "Uitsig", "Universitas", "Westdene",
      "Wilgehof", "Willows", "Langenhoven Park", "Arboretum", "Bayswater",
      "Dan Pienaar", "Heuwelsig", "Naval Hill", "Waverley", "Hospitaalpark",
    ],
  },
  {
    city: "Polokwane", province: "Limpopo",
    suburbs: [
      "Westenburg", "Nirvana", "Bendor", "Welgelegen", "Moregloed",
      "Annadale", "Ivydale", "Flora Park", "Fauna Park", "Penina Park",
      "Ivy Park", "Ster Park", "Dalmada", "Broadlands", "Woodlands",
      "Thornhill", "Seshego", "Mahlasedi Park", "Ladine", "Capricorn Park",
    ],
  },
  {
    city: "Mbombela", province: "Mpumalanga",
    suburbs: [
      "West Acres", "Sonheuwel", "Steiltes", "Riverside Park", "Bateleur Estate",
      "Drum Rock", "Karino", "The Rest", "Stonehenge", "Valencia Park",
      "Nelspruit Central", "Nelsville", "Kamagugu", "Kanyamazane", "Matumi Valley",
      "Nelpark", "White River", "Kabokweni", "Matsulu", "Mataffin",
    ],
  },
  {
    city: "Kimberley", province: "Northern Cape",
    suburbs: [
      "New Park", "Hadison Park", "Belgravia", "Rhodesdene", "Herlear",
      "Hillcrest", "Royldene", "Monument Heights", "Carters Glen", "El Toro Park",
      "Roodepan", "Riviera", "Beaconsfield", "Albertynshof", "Cassandra",
      "Kimberley North", "Southridge", "Vergenoeg", "Galeshewe", "Kestellhof",
    ],
  },
  {
    city: "Rustenburg", province: "North West",
    suburbs: [
      "Cashan", "Geelhoutpark", "Kroondal", "Olifantsnek", "Oos-Einde",
      "Protea Park", "Rustenburg Central", "Rustenburg North", "Safari Gardens", "Tlhabane",
      "Waterkloof", "Waterval East", "Wigwam", "Safarituine", "Bo-dorp",
      "Boitekong", "Freedom Park", "Karlienpark", "Meriting", "Zinniaville",
    ],
  },
];

export const SA_SUBURBS_AUTOCOMPLETE = SA_CITIES_SUBURBS.flatMap((c) => c.suburbs);

export const SA_CITY_COORDS: Record<string, [number, number]> = {
  "Cape Town": [-33.9249, 18.4241],
  "Johannesburg": [-26.2041, 28.0473],
  "Pretoria": [-25.7479, 28.2293],
  "Durban": [-29.8587, 31.0218],
  "Pietermaritzburg": [-29.6006, 30.3794],
  "Gqeberha": [-33.9608, 25.6022],
  "East London": [-33.0153, 27.9116],
  "Bloemfontein": [-29.0852, 26.1596],
  "Polokwane": [-23.9045, 29.4689],
  "Mbombela": [-25.4753, 30.9694],
  "Kimberley": [-28.7282, 24.7499],
  "Rustenburg": [-25.6672, 27.2424],
};

export const CAPE_TOWN_SUBURBS = SA_CITIES_SUBURBS[0].suburbs;

export const PLATFORM_COMMISSION_RATE = 0.08;
export const PUBLISHER_SHARE = 1 - PLATFORM_COMMISSION_RATE;

export const WHATSAPP_NUMBER = "27608973472";
export const WHATSAPP_NUMBER_DISPLAY = "060 897 3472";
export const CONTACT_EMAIL = "info@chatsched.com";
export const CONTACT_WEBSITE = "chatsched.com";
export const CONTACT_ADDRESS_LINES = ["Century Boulevard, Century City Dr", "Century City", "Cape Town, 7441", "South Africa"];

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const PAYOUT_DUE_DAYS = 7;

export const FEATURED_DURATION_DAYS = 14;

// ── Channel request escrow timing (influencer / website / podcast / radio) ──
// Mirrors the generated-column deadlines in schema_phase17 exactly — kept as
// named constants here so the UI copy (disclaimers, countdowns) never drifts
// from what the database actually enforces.
//
// IMPORTANT: Changing CREATOR_APPROVAL_WINDOW_DAYS here updates every UI
// reference (ForPublishers, HowItWorks, countdowns, disclaimers) automatically
// because all those files import this constant. However, the database enforces
// this deadline via a generated column in schema_phase17. A matching migration
// is required to change the enforced deadline at the database level too —
// this constant change alone is not enough for full enforcement.
export const CREATOR_APPROVAL_WINDOW_DAYS = 30;  // changed from 7 — publishers now have 30 days to approve or decline
export const BUSINESS_PAYMENT_WINDOW_DAYS = 7;   // business must pay within this many days of creator approval
export const CREATOR_PAYOUT_WINDOW_HOURS = 48;   // creator is paid within this many hours of the post going live

export const PLATFORM_BANK_DETAILS = {
  accountHolder: "Chatsched",
  bank: "Capitec Bank",
  accountNumber: "1149592735",
  branchCode: "470010",
  accountType: "Business / Cheque",
};

export const MAX_PORTFOLIO_IMAGES = 5;
export const MAX_PORTFOLIO_IMAGE_BYTES = 3 * 1024 * 1024;
export const ALLOWED_PORTFOLIO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_PROFILE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MIN_BIO_LENGTH = 40;

export const CAREER_CV_MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const CAREER_CV_BUCKET = "career-cvs";

export const WORK_WITH_US_CATEGORIES: { value: WorkWithUsCategory; label: string }[] = [
  { value: "developers", label: "Developers" },
  { value: "designers", label: "Designers" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "creators", label: "Creators" },
  { value: "community_managers", label: "Community Managers" },
  { value: "sales_representatives", label: "Sales Representatives" },
  { value: "freelancers", label: "Freelancers" },
  { value: "internships", label: "Internships" },
];
export const WORK_WITH_US_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_WORK_WITH_US_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/webp",
];
export const WORK_WITH_US_ATTACHMENT_BUCKET = "work-with-us-attachments";

export const PARTNER_CATEGORIES: { value: PartnerCategory; label: string; blurb: string }[] = [
  { value: "marketing_agencies", label: "Marketing Agencies", blurb: "Bring your clients local reach they can't get from a feed algorithm." },
  { value: "web_developers", label: "Web Developers", blurb: "Refer clients who need advertising, or build on top of the platform." },
  { value: "pr_agencies", label: "PR Agencies", blurb: "Add real local placements to the campaigns you're already running." },
  { value: "photographers", label: "Photographers", blurb: "Turn campaign creative work into an ongoing referral relationship." },
  { value: "event_companies", label: "Event Companies", blurb: "Connect event sponsors and exhibitors with local audiences." },
  { value: "payment_providers", label: "Payment Providers", blurb: "Explore integration and processing partnerships." },
  { value: "software_companies", label: "Software Companies", blurb: "Explore integrations that put ChatSched in front of your users." },
  { value: "creator_networks", label: "Creator Networks", blurb: "Bring your network of creators onto the platform as publishers." },
  { value: "media_organisations", label: "Media Organisations", blurb: "List your channels and reach the local businesses looking for them." },
  { value: "business_associations", label: "Business Associations", blurb: "Give your members a trusted way to reach local customers." },
];

export const PARTNER_TYPES: { value: PartnerType; label: string; blurb: string }[] = [
  { value: "agency", label: "Agency Partner", blurb: "Manage campaigns for clients." },
  { value: "technology", label: "Technology Partner", blurb: "Integrate with ChatSched." },
  { value: "media", label: "Media Partner", blurb: "Bring publisher networks." },
  { value: "community", label: "Community Partner", blurb: "Bring business communities." },
  { value: "referral", label: "Referral Partner", blurb: "Refer businesses/publishers." },
];

export const FEATURED_PLACEMENT_MONTHLY_PRICE = 99;

export const ADVERTISE_PRODUCTS: { value: AdvertiseProduct; label: string; blurb: string }[] = [
  { value: "website_advertising", label: "Website Advertising", blurb: "Banner and display placements across chatsched.com." },
  { value: "newsletter_sponsorship", label: "Newsletter Sponsorship", blurb: "A dedicated mention or slot in ChatSched's own newsletter." },
  { value: "featured_placement", label: "Featured Marketplace Placement", blurb: `Priority visibility in the publisher directory and homepage. From ${formatCurrency(FEATURED_PLACEMENT_MONTHLY_PRICE)}/month — real inventory (e.g. homepage takeover slots) can be priced above this.` },
  { value: "sponsored_article", label: "Sponsored Article", blurb: "A branded piece alongside the Blog and Success Centre guides." },
  { value: "brand_partnership", label: "Brand Partnership", blurb: "A broader, ongoing partnership with the ChatSched brand itself." },
];

export const MAX_PROOF_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PROOF_SCREENSHOT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const CONTENT_STUDIO_MONTHLY_PRICE = 99;
export const CONTENT_STUDIO_DAILY_LIMIT = 15;

export const PUBLISHER_SUBSCRIPTION_PRICE = 199;
export const BUSINESS_SUBSCRIPTION_PRICE = 399;
export const BUSINESS_LAUNCH_CREDIT_AMOUNT = 199;
export const CONTENT_STUDIO_MONTHLY_LIMIT = 150;

export const CONTENT_STUDIO_FREE_MONTHLY_LIMIT = 15;
export const CONTENT_STUDIO_FREE_DAILY_LIMIT = 5;

export interface ContentStudioFormat {
  id: string;
  label: string;
  hint: string;
}

export const CONTENT_STUDIO_FORMATS: ContentStudioFormat[] = [
  { id: "facebook", label: "Facebook Post", hint: "Feed post with a natural CTA" },
  { id: "instagram", label: "Instagram Caption", hint: "Caption + relevant hashtags" },
  { id: "linkedin", label: "LinkedIn Post", hint: "Slightly more professional tone" },
  { id: "tiktok", label: "TikTok Caption", hint: "Short, punchy, hashtags" },
  { id: "whatsapp", label: "WhatsApp Status", hint: "Under 140 characters" },
  { id: "x", label: "X Post", hint: "Under 280 characters" },
  { id: "google_business", label: "Google Business Profile Update", hint: "Clear offer + CTA" },
  { id: "blog", label: "Blog Article", hint: "Short article, ~250–400 words" },
  { id: "email", label: "Email Newsletter", hint: "Subject line + body" },
];

export const SWATCHES = [
  { label: "Yellow", value: "from-billboard-yellow to-billboard-yellowDeep" },
  { label: "Green", value: "from-billboard-green to-billboard-greenDeep" },
  { label: "Red → Yellow deep", value: "from-billboard-red to-billboard-yellowDeep" },
  { label: "Ink", value: "from-billboard-ink to-billboard-inkSoft" },
  { label: "Yellow → Red", value: "from-billboard-yellow to-billboard-red" },
  { label: "Green → Ink", value: "from-billboard-green to-billboard-ink" },
  { label: "Red → Yellow", value: "from-billboard-red to-billboard-yellow" },
  { label: "Ink → Green", value: "from-billboard-ink to-billboard-green" },
];

export const COMMUNITY_EVENT_TYPES: { value: CommunityEventType; label: string }[] = [
  { value: "webinar", label: "Webinar" },
  { value: "online", label: "Online event" },
  { value: "in_person", label: "In person" },
];
export const COMMUNITY_QUESTION_CATEGORIES: { value: CommunityQuestionCategory; label: string }[] = [
  { value: "publisher", label: "Publisher Community" },
  { value: "business", label: "Business Community" },
  { value: "marketing", label: "Marketing Discussions" },
];

export const MAX_CONTENT_ASSET_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CONTENT_ASSET_VIDEO_BYTES = 50 * 1024 * 1024;
export const ALLOWED_CONTENT_ASSET_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_CONTENT_ASSET_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"];

export const DELIVERABLE_QUICK_ADD = [
  "Instagram Reel",
  "Instagram Story",
  "Instagram Post",
  "TikTok Video",
  "YouTube Video",
  "Website Placement",
  "Podcast Mention",
  "Radio Spot",
  "Tracking Link",
  "Promo Code",
] as const;

export const TOOL_CATEGORIES: { value: import("./types").ToolCategory; label: string; blurb: string }[] = [
  { value: "get_customers", label: "Get Customers", blurb: "Lead generation, lead capture and customer acquisition." },
  { value: "convert", label: "Convert", blurb: "Quotes, bookings, offers and customer communication." },
  { value: "keep_customers", label: "Keep Customers", blurb: "Reviews, follow-ups and retention." },
  { value: "advertise", label: "Advertise", blurb: "Campaign creation, advertising and promotional tools." },
  { value: "measure", label: "Measure", blurb: "Analytics, ROI, reporting and performance." },
];

export const TOOL_STATUSES: import("./types").ToolStatus[] = ["draft", "coming_soon", "active", "paused", "archived"];
export const TOOL_STATUS_LABEL: Record<import("./types").ToolStatus, string> = {
  draft: "Draft",
  coming_soon: "Coming Soon",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const TOOL_TYPES: import("./types").ToolType[] = ["native", "integrated", "white_label", "service"];
export const TOOL_TYPE_LABEL: Record<import("./types").ToolType, string> = {
  native: "Native ChatSched tool",
  integrated: "Integrated (third-party)",
  white_label: "White-label",
  service: "Managed service",
};

export const TOOL_PRICING_MODELS: import("./types").ToolPricingModel[] = ["free", "included", "paid_once", "paid_monthly", "paid_annual", "custom", "tbd"];
export const TOOL_PRICING_LABEL: Record<import("./types").ToolPricingModel, string> = {
  free: "Free",
  included: "Included with your plan",
  paid_once: "Once-off",
  paid_monthly: "Monthly",
  paid_annual: "Annual",
  custom: "Custom pricing",
  tbd: "To be announced",
};

export function defaultToolCtaLabel(status: import("./types").ToolStatus, pricingModel: import("./types").ToolPricingModel): string {
  if (status === "coming_soon") return "Join Waitlist";
  if (status !== "active") return "View Tool";
  if (pricingModel === "free" || pricingModel === "included") return "Use Tool";
  if (pricingModel === "tbd" || pricingModel === "custom") return "Request Setup";
  return "Get Tool";
}
