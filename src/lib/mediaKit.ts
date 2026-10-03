import { CONTACT_EMAIL, CONTACT_WEBSITE } from "./constants";
import { LEVEL_META, scoreLabel } from "./publisherDisplay";
import { getChannelBySlug } from "./channelRegistry";
import { formatCurrency as formatCurrencyShared } from "./currency";
import type { Platform, Publisher, Review } from "./types";
import {
  countFollowerPlatforms,
  getAdPlatforms,
  getFollowersByPlatform,
  getPackagePrice,
  getTotalFollowers,
  platformHeadline,
} from "./platforms";
import { ICON_PATHS, type IconKey } from "./platformIconPaths";

// Generates the branded media kit PDF entirely client-side — same approach as
// invoice.ts (lazy-loaded jsPDF, no server round trip, nothing stored). This is
// the publisher's own sales collateral: everything in it is already public on
// their profile page. Deliberately excludes anything admin-only or internal —
// authenticity_risk/authenticity_notes, admin_notes, rejected_reason — since
// this is a document handed to a prospective advertiser, not a moderation
// record.
//
// Look: the site's "billboard" language — paper background, thick ink borders,
// hard offset shadows, signal yellow, Archivo Black headlines, IBM Plex Mono
// labels. The brand fonts are registered from mediaKitFonts.ts (dynamic import,
// so they never touch the main bundle). Platform logos are drawn from the same
// vector paths the website uses, written straight into the page as PDF path
// operators. Checks and ratings are vector shapes too, never font glyphs.

const INK = "#1A1712";
const INK_SOFT = "#4A4335";
const PAPER = "#FAF9F5";
const YELLOW = "#F5B700";
const YELLOW_DEEP = "#D9A400";
const WHITE = "#FFFFFF";
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 11;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 8;

type Doc = import("jspdf").jsPDF;

const DISPLAY = "Archivo";
const SANS = "PlexSans";
const MONO = "PlexMono";

export interface MediaKitInput {
  publisher: Publisher;
  reviews: Review[];
  /** Completed campaigns across both the directory request flow and the channel-request flow — see mediaKitData.ts. */
  completedCampaigns: number;
  profileUrl: string;
}

function rand(n: number): string {
  return formatCurrencyShared(n);
}

async function registerBrandFonts(doc: Doc) {
  const f = await import("./mediaKitFonts");
  const add = (file: string, data: string, name: string, style: "normal" | "bold") => {
    doc.addFileToVFS(file, data);
    doc.addFont(file, name, style);
  };
  add("ArchivoBlack.ttf", f.ARCHIVO_BLACK, DISPLAY, "normal");
  add("PlexSans-Regular.ttf", f.PLEX_SANS_REGULAR, SANS, "normal");
  add("PlexSans-SemiBold.ttf", f.PLEX_SANS_SEMIBOLD, SANS, "bold");
  add("PlexMono-Medium.ttf", f.PLEX_MONO_MEDIUM, MONO, "normal");
  add("PlexMono-Bold.ttf", f.PLEX_MONO_BOLD, MONO, "bold");
}

function font(doc: Doc, face: string, style: "normal" | "bold", size: number, color: string) {
  doc.setFont(face, style);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

/** Thick-bordered block with the site's hard offset shadow. */
function hardBlock(doc: Doc, x: number, y: number, w: number, h: number, fill: string, shadow = 1.8, border = 0.7) {
  if (shadow > 0) {
    doc.setFillColor(INK);
    doc.rect(x + shadow, y + shadow, w, h, "F");
  }
  doc.setFillColor(fill);
  doc.setDrawColor(INK);
  doc.setLineWidth(border);
  doc.rect(x, y, w, h, "FD");
}

/** Mono label chip; returns its width so callers can lay several in a row. */
function chip(doc: Doc, x: number, baselineY: number, text: string, opts: { fill?: string; color?: string; border?: boolean } = {}): number {
  font(doc, MONO, "bold", 6.6, opts.color ?? PAPER);
  const label = text.toUpperCase();
  const w = doc.getTextWidth(label) + 5;
  const h = 5.8;
  const top = baselineY - 4.1;
  if (opts.fill) {
    doc.setFillColor(opts.fill);
    doc.rect(x, top, w, h, "F");
  }
  if (opts.border) {
    doc.setDrawColor(INK);
    doc.setLineWidth(0.4);
    doc.rect(x, top, w, h, "S");
  }
  doc.text(label, x + 2.5, baselineY);
  return w;
}

/** The real ChatSched mark (see ChatSchedMark in VisualIdentitySystem.tsx, viewBox 26x22). */
function drawChatschedMark(doc: Doc, x: number, y: number, h: number, color: string, lineScale = 1): number {
  const w = h * (26 / 22);
  doc.setDrawColor(color);
  doc.setLineWidth(h * (2.4 / 22) * lineScale);
  doc.rect(x + w * (1 / 26), y + h * (1 / 22), w * (24 / 26), h * (14 / 22), "S");
  const legX1 = x + w * (8 / 26);
  const legX2 = x + w * (18 / 26);
  doc.line(legX1, y + h * (15 / 22), legX1, y + h * (21 / 22));
  doc.line(legX2, y + h * (15 / 22), legX2, y + h * (21 / 22));
  return w;
}

function platformIconKey(p: Platform): IconKey {
  if (p === "Facebook Page" || p === "Facebook Group") return "Facebook";
  if (p === "WhatsApp Channel") return "WhatsApp";
  return p as IconKey;
}

/**
 * Draws a platform logo by writing its SVG path (absolute M/L/C/Z only) into
 * the page as PDF path operators, scaled to fit a `size` mm square at (x, y).
 */
function drawPlatformIcon(doc: Doc, platform: Platform, x: number, y: number, size: number, color: string) {
  const data = ICON_PATHS[platformIconKey(platform)];
  const [vx, vy, vw, vh] = data.viewBox.split(" ").map(Number);
  const scale = size / Math.max(vw, vh);
  const k = doc.internal.scaleFactor;
  const pageH = doc.internal.pageSize.getHeight();
  // jsPDF exposes a raw content-stream writer at runtime but not in its typings.
  const internal = doc.internal as unknown as { write: (part: string) => void };
  const write = (part: string) => internal.write(part);
  const px = (n: number) => ((x + (n - vx) * scale) * k).toFixed(3);
  const py = (n: number) => ((pageH - (y + (n - vy) * scale)) * k).toFixed(3);
  doc.setFillColor(color);
  for (const path of data.paths) {
    const tokens = path.d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
    const ops: string[] = [];
    for (let i = 0; i < tokens.length; ) {
      const t = tokens[i++];
      if (t === "M" || t === "L") {
        ops.push(`${px(Number(tokens[i]))} ${py(Number(tokens[i + 1]))} ${t === "M" ? "m" : "l"}`);
        i += 2;
      } else if (t === "C") {
        const n = tokens.slice(i, i + 6).map(Number);
        ops.push(`${px(n[0])} ${py(n[1])} ${px(n[2])} ${py(n[3])} ${px(n[4])} ${py(n[5])} c`);
        i += 6;
      } else if (t === "Z") {
        ops.push("h");
      }
    }
    write("q");
    for (const op of ops) write(op);
    write(path.evenodd ? "f*" : "f");
    write("Q");
  }
}

/** A white tick inside a filled circle, drawn with lines (no ✓ glyph — see header note). */
function drawCheckBadge(doc: Doc, cx: number, cy: number, r: number, verified: boolean) {
  if (verified) {
    doc.setFillColor(YELLOW);
    doc.setDrawColor(YELLOW);
    doc.circle(cx, cy, r, "F");
    doc.setDrawColor(INK);
    doc.setLineWidth(0.75);
    doc.setLineCap(1);
    doc.setLineJoin(1);
    doc.line(cx - r * 0.5, cy + r * 0.02, cx - r * 0.12, cy + r * 0.42);
    doc.line(cx - r * 0.12, cy + r * 0.42, cx + r * 0.55, cy - r * 0.38);
    doc.setLineCap(0);
    doc.setLineJoin(0);
  } else {
    doc.setDrawColor("#8C8575");
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, r, "S");
  }
}

/** Row of squares filled up to `rating`. Returns the width drawn. */
function drawRatingChips(doc: Doc, x: number, baselineY: number, rating: number, max = 5): number {
  const size = 3.6;
  const gap = 1.1;
  const filled = Math.round(rating);
  for (let i = 0; i < max; i++) {
    const cx = x + i * (size + gap);
    const cy = baselineY - size + 0.6;
    doc.setLineWidth(0.4);
    doc.setDrawColor(INK);
    doc.setFillColor(i < filled ? YELLOW : WHITE);
    doc.rect(cx, cy, size, size, "FD");
  }
  return max * (size + gap) - gap;
}

class Page {
  y = 0;
  private doc: Doc;
  private onNewPage: () => void;
  constructor(doc: Doc, onNewPage: () => void) {
    this.doc = doc;
    this.onNewPage = onNewPage;
  }
  ensure(needed: number) {
    if (this.y + needed > CONTENT_BOTTOM) {
      this.doc.addPage();
      this.onNewPage();
    }
  }
  space(n: number) {
    this.y += n;
  }
}

function sectionHeading(doc: Doc, page: Page, title: string, keepWith = 0) {
  // keepWith: height of the first block under the heading, so a heading never strands at a page bottom.
  page.ensure(22 + keepWith);
  font(doc, DISPLAY, "normal", 12.5, INK);
  doc.text(title.toUpperCase(), MARGIN, page.y);
  doc.setFillColor(INK);
  doc.rect(MARGIN, page.y + 2.4, CONTENT_W, 0.7, "F");
  doc.setFillColor(YELLOW);
  doc.rect(MARGIN, page.y + 1.9, 26, 1.9, "F");
  page.space(11);
}

function labelText(doc: Doc, text: string, x: number, y: number) {
  font(doc, MONO, "bold", 6.6, INK_SOFT);
  doc.text(text.toUpperCase(), x, y);
}

/** Wrapping row of outlined mono chips. Returns the height used. */
function chipRow(doc: Doc, page: Page, items: string[]) {
  let x = MARGIN;
  let y = page.y;
  items.forEach((item) => {
    font(doc, MONO, "bold", 6.8, INK);
    const w = doc.getTextWidth(item.toUpperCase()) + 6;
    if (x + w > PAGE_W - MARGIN) {
      x = MARGIN;
      y += 8;
      page.y = y;
      page.ensure(8);
      y = page.y;
    }
    doc.setFillColor(WHITE);
    doc.setDrawColor(INK);
    doc.setLineWidth(0.4);
    doc.rect(x, y - 4.4, w, 6.4, "FD");
    doc.text(item.toUpperCase(), x + 3, y);
    x += w + 2.6;
  });
  page.y = y;
  page.space(13);
}

function statCard(doc: Doc, x: number, y: number, w: number, h: number, label: string, value: string, sub: string | null, accent: boolean) {
  hardBlock(doc, x, y, w, h, accent ? YELLOW : WHITE);
  labelText(doc, label, x + 4, y + 7);
  const compact = h < 26;
  let size = compact ? 16 : 23;
  font(doc, DISPLAY, "normal", size, INK);
  while (doc.getTextWidth(value) > w - 8 && size > 12) {
    size -= 1;
    doc.setFontSize(size);
  }
  doc.text(value, x + 4, y + (compact ? 16.5 : 20));
  if (sub) {
    font(doc, MONO, "normal", 6.4, accent ? INK : INK_SOFT);
    doc.text(sub.toUpperCase(), x + 4, y + h - 4);
  }
}

/** Fetches a portfolio image and returns a base64 data URL, or null if it can't be loaded (cross-origin bucket without CORS, network failure, etc.) — callers fall back to a text list rather than failing the whole PDF. */
async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims: { width: number; height: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export async function buildAndDownloadMediaKit(input: MediaKitInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerBrandFonts(doc);

  const p = input.publisher;
  const channelDef = getChannelBySlug(p.channel_slug)?.definition;
  const isRequestFlowChannel = !!channelDef && channelDef.bookingFlow === "request";
  const adPlatforms = getAdPlatforms(p);
  const followersByPlatform = getFollowersByPlatform(p);
  const platformCount = countFollowerPlatforms(p);
  const packagePrice = getPackagePrice(p);
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  function paintPageBase() {
    doc.setFillColor(PAPER);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  // Pages after the first get a slim running header so the kit still reads as one branded piece.
  function runningHeader() {
    paintPageBase();
    doc.setFillColor(YELLOW);
    doc.rect(0, 0, PAGE_W, 13, "F");
    doc.setFillColor(INK);
    doc.rect(0, 13, PAGE_W, 1, "F");
    const w = drawChatschedMark(doc, MARGIN, 4.2, 5, INK);
    font(doc, DISPLAY, "normal", 10, INK);
    doc.text("ChatSched", MARGIN + w + 2.5, 8.6);
    font(doc, MONO, "bold", 6.8, INK);
    doc.text(`MEDIA KIT · ${p.name.toUpperCase()}`, PAGE_W - MARGIN, 8.6, { align: "right" });
    page.y = 28;
  }

  const page = new Page(doc, runningHeader);

  // ── Cover band ───────────────────────────────────────────────────────
  paintPageBase();
  const bandH = 92;
  doc.setFillColor(YELLOW);
  doc.rect(0, 0, PAGE_W, bandH, "F");
  doc.setFillColor(INK);
  doc.rect(0, bandH, PAGE_W, 1.6, "F");

  // Oversized mark as a watermark, in the deeper yellow.
  drawChatschedMark(doc, 128, 26, 52, YELLOW_DEEP, 1.15);

  const markW = drawChatschedMark(doc, MARGIN, 12, 7.5, INK);
  font(doc, DISPLAY, "normal", 17, INK);
  doc.text("ChatSched", MARGIN + markW + 3, 18.3);
  font(doc, MONO, "normal", 6.4, INK);
  doc.text("MANAGED ADVERTISING + MARKETPLACE + PUBLISHER NETWORK", MARGIN, 25);

  const tagW = (() => {
    font(doc, MONO, "bold", 7, PAPER);
    return doc.getTextWidth("MEDIA KIT") + 7;
  })();
  doc.setFillColor(INK);
  doc.rect(PAGE_W - MARGIN - tagW, 11.5, tagW, 7, "F");
  font(doc, MONO, "bold", 7, PAPER);
  doc.text("MEDIA KIT", PAGE_W - MARGIN - tagW + 3.5, 16.3);
  font(doc, MONO, "normal", 6.4, INK);
  doc.text(today.toUpperCase(), PAGE_W - MARGIN, 24, { align: "right" });

  // Publisher name: as large as fits on at most two lines.
  const nameMaxW = 112;
  let nameSize = 32;
  let nameLines: string[] = [];
  for (; nameSize >= 20; nameSize -= 2) {
    font(doc, DISPLAY, "normal", nameSize, INK);
    nameLines = doc.splitTextToSize(p.name, nameMaxW);
    if (nameLines.length <= 2) break;
  }
  font(doc, DISPLAY, "normal", nameSize, INK);
  const nameLead = nameSize * 0.3528 * 1.08;
  let ny = 44;
  nameLines.slice(0, 2).forEach((line) => {
    doc.text(line, MARGIN, ny);
    ny += nameLead;
  });

  // Badges
  let bx = MARGIN;
  const by = ny + 1.5;
  if (p.verified) bx += chip(doc, bx, by, "Verified", { fill: INK, color: PAPER }) + 2.4;
  if (p.level) bx += chip(doc, bx, by, LEVEL_META[p.level].label, { fill: WHITE, color: INK, border: true }) + 2.4;
  if (isRequestFlowChannel && channelDef) bx += chip(doc, bx, by, channelDef.name, { fill: WHITE, color: INK, border: true }) + 2.4;
  if (p.category) chip(doc, bx, by, p.category, { color: INK, border: true });

  font(doc, SANS, "bold", 9.5, INK);
  doc.text(`${p.city}${p.suburb ? ` (${p.suburb})` : ""}, ${p.province}`, MARGIN, by + 8);

  // ── Headline stat cards straddling the band edge ─────────────────────
  const cardH = 31;
  const cardY = bandH - 11;
  const followers = getTotalFollowers(p);
  const cards: Array<{ label: string; value: string; sub: string | null; accent: boolean }> = [
    {
      label: platformCount > 1 ? "Followers combined" : "Followers",
      value: followers.toLocaleString(),
      sub: platformCount > 1 ? `across ${platformCount} platforms` : adPlatforms[0] ?? null,
      accent: true,
    },
    { label: "Engagement rate", value: `${p.engagement}%`, sub: "average per post", accent: false },
  ];
  if (p.monthly_reach != null) cards.push({ label: "Monthly reach", value: p.monthly_reach.toLocaleString(), sub: "people per month", accent: false });
  else if (p.trust_score > 0) cards.push({ label: "Trust score", value: `${p.trust_score}/100`, sub: "ChatSched verified", accent: false });
  else cards.push({ label: "Platforms", value: String(adPlatforms.length || 1), sub: adPlatforms.length ? platformHeadline(adPlatforms) : null, accent: false });
  const cardCols = cards.length;
  const cw = (CONTENT_W - (cardCols - 1) * 6) / cardCols;
  cards.forEach((c, i) => statCard(doc, MARGIN + i * (cw + 6), cardY, cw, cardH, c.label, c.value, c.sub, c.accent));

  page.y = cardY + cardH + 15;

  // ── Bio ───────────────────────────────────────────────────────────────
  if (p.bio) {
    font(doc, SANS, "normal", 10.5, INK);
    const bioLines: string[] = doc.splitTextToSize(p.bio, CONTENT_W - 8);
    const bioH = bioLines.length * 5.3;
    page.ensure(bioH + 8);
    doc.setFillColor(YELLOW);
    doc.rect(MARGIN, page.y - 4, 2, bioH + 1, "F");
    doc.text(bioLines, MARGIN + 6, page.y);
    page.space(bioH + 11);
  }

  // ── Where your ad runs ───────────────────────────────────────────────
  if (adPlatforms.length > 0) {
    sectionHeading(doc, page, "Where your ad runs", 25);
    const single = adPlatforms.length === 1;

    if (single) {
      const only = adPlatforms[0];
      const h = 21;
      page.ensure(h + 8);
      hardBlock(doc, MARGIN, page.y, CONTENT_W, h, YELLOW);
      drawPlatformIcon(doc, only, MARGIN + 6, page.y + 4.5, 12, INK);
      font(doc, DISPLAY, "normal", 15, INK);
      doc.text(`${only.toUpperCase()} ONLY`, MARGIN + 23, page.y + 11);
      font(doc, MONO, "normal", 6.8, INK);
      const f = followersByPlatform[only] ?? followers;
      doc.text(`${f.toLocaleString()} FOLLOWERS · YOUR AD APPEARS NOWHERE ELSE`, MARGIN + 23, page.y + 16.5);
      page.space(h + 11);
    } else {
      // Up to five platforms share one row; more than that wrap at four per row.
      const perRow = adPlatforms.length <= 5 ? adPlatforms.length : 4;
      const gap = 4;
      const tw = (CONTENT_W - gap * (perRow - 1)) / perRow;
      const th = 24;
      const rows = Math.ceil(adPlatforms.length / perRow);
      page.ensure(rows * (th + gap + 2) + 8);
      adPlatforms.forEach((pl, i) => {
        const x = MARGIN + (i % perRow) * (tw + gap);
        const y = page.y + Math.floor(i / perRow) * (th + gap + 2);
        hardBlock(doc, x, y, tw, th, WHITE, 1.4, 0.6);
        drawPlatformIcon(doc, pl, x + 3.5, y + 3.5, 9, INK);
        let nameSize = 7.8;
        font(doc, SANS, "bold", nameSize, INK);
        while (doc.getTextWidth(pl) > tw - 7 && nameSize > 5.6) {
          nameSize -= 0.3;
          doc.setFontSize(nameSize);
        }
        doc.text(pl, x + 3.5, y + 17.5);
        const f = followersByPlatform[pl];
        if (f) {
          font(doc, MONO, "normal", 5.8, INK_SOFT);
          doc.text(`${f.toLocaleString()} FOLLOWERS`, x + 3.5, y + 21.4);
        }
      });
      page.space(rows * (th + gap + 2) + 1);

      // All-platforms package banner
      const bh = 14;
      page.ensure(bh + 8);
      hardBlock(doc, MARGIN, page.y, CONTENT_W, bh, INK, 1.8, 0.7);
      font(doc, DISPLAY, "normal", 10.5, YELLOW);
      doc.text(`ALL ${adPlatforms.length} PLATFORMS · ONE PACKAGE`, MARGIN + 5, page.y + 6.4);
      font(doc, MONO, "normal", 6.4, PAPER);
      doc.text("ONE BOOKING RUNS YOUR AD ON EVERY PLATFORM ABOVE", MARGIN + 5, page.y + 10.8);
      font(doc, DISPLAY, "normal", packagePrice != null ? 13 : 9, YELLOW);
      doc.text(packagePrice != null ? rand(packagePrice) : "PRICE ON REQUEST", PAGE_W - MARGIN - 5, page.y + 8.6, { align: "right" });
      page.space(bh + 12);
    }

    if (p.languages?.length) {
      page.ensure(16);
      labelText(doc, "Languages", MARGIN, page.y);
      page.space(6.5);
      chipRow(doc, page, p.languages);
    }
    if (p.audience) {
      font(doc, SANS, "normal", 10, INK);
      const lines: string[] = doc.splitTextToSize(p.audience, CONTENT_W);
      page.ensure(lines.length * 5 + 12);
      labelText(doc, "Who they reach", MARGIN, page.y);
      page.space(5.5);
      font(doc, SANS, "normal", 10, INK);
      doc.text(lines, MARGIN, page.y);
      page.space(lines.length * 5 + 9);
    }
  } else if (p.audience) {
    sectionHeading(doc, page, "Audience");
    font(doc, SANS, "normal", 10, INK);
    const lines: string[] = doc.splitTextToSize(p.audience, CONTENT_W);
    doc.text(lines, MARGIN, page.y);
    page.space(lines.length * 5 + 9);
  }

  // ── Pricing & ad formats ──────────────────────────────────────────────
  sectionHeading(doc, page, "Pricing & ad formats", 30);

  if (isRequestFlowChannel && channelDef) {
    const h = 17;
    page.ensure(h + 10);
    hardBlock(doc, MARGIN, page.y, CONTENT_W, h, YELLOW);
    labelText(doc, "Recommended minimum", MARGIN + 5, page.y + 6.5);
    font(doc, DISPLAY, "normal", 16, INK);
    doc.text(`FROM ${rand(channelDef.minBudgetZAR)}`, MARGIN + 5, page.y + 13.8);
    font(doc, MONO, "normal", 6.6, INK);
    doc.text("PRICING VARIES BY CAMPAIGN", PAGE_W - MARGIN - 5, page.y + 13.8, { align: "right" });
    page.space(h + 10);
    channelDef.pricingModels?.forEach((pm) => {
      font(doc, SANS, "normal", 8.8, INK_SOFT);
      const lines: string[] = doc.splitTextToSize(pm.description, CONTENT_W - 6);
      page.ensure(lines.length * 4.4 + 12);
      font(doc, SANS, "bold", 9.6, INK);
      doc.text(`${pm.label} — from ${rand(pm.minPrice)}`, MARGIN + 6, page.y);
      doc.setFillColor(YELLOW);
      doc.rect(MARGIN, page.y - 3.2, 3, 3, "F");
      page.space(4.8);
      font(doc, SANS, "normal", 8.8, INK_SOFT);
      doc.text(lines, MARGIN + 6, page.y);
      page.space(lines.length * 4.4 + 5);
    });
  } else {
    const multi = adPlatforms.length > 1;
    const priceStr = rand(p.price_per_post);
    font(doc, DISPLAY, "normal", 30, INK);
    const priceW = doc.getTextWidth(priceStr);
    const h = 25;
    const bw = priceW + 64;
    page.ensure(h + 10);
    hardBlock(doc, MARGIN, page.y, bw, h, YELLOW);
    font(doc, DISPLAY, "normal", 30, INK);
    doc.text(priceStr, MARGIN + 6, page.y + 17.5);
    font(doc, MONO, "bold", 7.2, INK);
    doc.text("PER POST", MARGIN + 6 + priceW + 5, page.y + 12);
    font(doc, MONO, "normal", 6.4, INK);
    doc.text(multi ? "ON ONE PLATFORM" : adPlatforms[0] ? `ON ${adPlatforms[0].toUpperCase()}` : "STANDARD RATE", MARGIN + 6 + priceW + 5, page.y + 16.8);
    page.space(h + 11);
  }

  const adFormats = isRequestFlowChannel
    ? p.accepted_ad_formats && p.accepted_ad_formats.length > 0
      ? p.accepted_ad_formats
      : channelDef?.advertisingMethods?.map((m) => m.label) ?? []
    : p.placement_types ?? [];
  if (adFormats.length) {
    page.ensure(24);
    labelText(doc, "Ad formats offered", MARGIN, page.y);
    page.space(7);
    chipRow(doc, page, adFormats);
  }

  // ── Trust & verification ─────────────────────────────────────────────
  sectionHeading(doc, page, "Trust & verification", 40);
  const rows: { label: string; verified: boolean }[] = [
    { label: "Email verified", verified: p.email_verified },
    { label: "Phone verified", verified: p.phone_verified },
    { label: "Identity verified", verified: p.identity_verified },
  ];
  const panelH = 38;
  page.ensure(panelH + 10);
  hardBlock(doc, MARGIN, page.y, CONTENT_W, panelH, INK, 1.8, 0.7);
  const px0 = MARGIN + 8;
  const py0 = page.y;
  let scoreX = px0;
  if (p.trust_score > 0) {
    font(doc, MONO, "bold", 6.6, PAPER);
    doc.text("TRUST SCORE", scoreX, py0 + 9);
    font(doc, DISPLAY, "normal", 28, YELLOW);
    doc.text(`${p.trust_score}`, scoreX, py0 + 24);
    const tw = doc.getTextWidth(`${p.trust_score}`);
    font(doc, DISPLAY, "normal", 11, PAPER);
    doc.text("/100", scoreX + tw + 1.5, py0 + 24);
    scoreX += 52;
  }
  if (p.publisher_score > 0) {
    font(doc, MONO, "bold", 6.6, PAPER);
    doc.text("PUBLISHER SCORE", scoreX, py0 + 9);
    font(doc, DISPLAY, "normal", 14, PAPER);
    doc.text(scoreLabel(p.publisher_score).toUpperCase(), scoreX, py0 + 22);
  }
  if (p.avg_response_hours != null && p.response_count >= 3) {
    const hrs = p.avg_response_hours;
    const label = hrs < 1 ? "< 1 hour" : hrs < 24 ? `${Math.round(hrs)} hours` : `${Math.round(hrs / 24)} days`;
    font(doc, MONO, "bold", 6.6, PAPER);
    doc.text("AVG. RESPONSE", px0, py0 + 33);
    font(doc, SANS, "bold", 9.5, YELLOW);
    doc.text(label, px0 + 30, py0 + 33);
  }
  const rowsX = MARGIN + CONTENT_W - 62;
  rows.forEach((row, i) => {
    const ry = py0 + 11 + i * 9.5;
    drawCheckBadge(doc, rowsX + 2.6, ry - 1.2, 2.9, row.verified);
    font(doc, SANS, "bold", 9.2, row.verified ? PAPER : "#8C8575");
    doc.text(row.label, rowsX + 8, ry);
  });
  page.space(panelH + 13);

  // ── Campaign history ───────────────────────────────────────────────
  sectionHeading(doc, page, "Campaign history", 22);
  const memberSince = p.created_at ? new Date(p.created_at).toLocaleDateString("en-ZA", { month: "long", year: "numeric" }) : null;
  const history: Array<{ label: string; value: string }> = [{ label: "Completed campaigns", value: String(input.completedCampaigns) }];
  if (memberSince) history.push({ label: "On ChatSched since", value: memberSince });
  page.ensure(24 + 10);
  const hw = (CONTENT_W - 6) / 2;
  history.forEach((s, i) => statCard(doc, MARGIN + i * (hw + 6), page.y, hw, 22, s.label, s.value, null, false));
  page.space(22 + 12);

  // ── Reviews ────────────────────────────────────────────────────────────
  if (input.reviews.length > 0) {
    sectionHeading(doc, page, "Reviews", 30);
    const avg = input.reviews.reduce((sum, r) => sum + r.rating, 0) / input.reviews.length;
    page.ensure(12);
    const chipsW = drawRatingChips(doc, MARGIN, page.y, avg);
    font(doc, SANS, "bold", 10.5, INK);
    doc.text(`${avg.toFixed(1)} average from ${input.reviews.length} review${input.reviews.length === 1 ? "" : "s"}`, MARGIN + chipsW + 4, page.y);
    page.space(9);

    input.reviews.slice(0, 4).forEach((rev) => {
      const author = rev.business?.company_name || rev.business?.full_name || "A business";
      font(doc, SANS, "normal", 9, INK_SOFT);
      const lines: string[] = rev.comment ? doc.splitTextToSize(rev.comment, CONTENT_W - 12) : [];
      const h = 13 + lines.length * 4.5;
      page.ensure(h + 6);
      hardBlock(doc, MARGIN, page.y, CONTENT_W, h, WHITE, 1.2, 0.5);
      font(doc, SANS, "bold", 9.4, INK);
      doc.text(author, MARGIN + 5, page.y + 7);
      drawRatingChips(doc, MARGIN + 5 + doc.getTextWidth(author) + 4, page.y + 7, rev.rating);
      if (lines.length) {
        font(doc, SANS, "normal", 9, INK_SOFT);
        doc.text(lines, MARGIN + 5, page.y + 12.5);
      }
      page.space(h + 6);
    });
    page.space(3);
  }

  // ── Portfolio ────────────────────────────────────────────────────────────
  if (p.portfolio_images?.length || p.intro_video_url) {
    sectionHeading(doc, page, "Portfolio");
    if (p.intro_video_url) {
      font(doc, SANS, "normal", 9.5, INK_SOFT);
      page.ensure(8);
      doc.text(`Intro video: ${p.intro_video_url}`, MARGIN, page.y);
      page.space(9);
    }
    if (p.portfolio_images?.length) {
      const thumb = 40;
      const gap = 6;
      const perRow = Math.floor((CONTENT_W + gap) / (thumb + gap));
      const loaded = await Promise.all(p.portfolio_images.slice(0, 5).map(fetchImageAsDataUrl));
      if (loaded.some(Boolean)) {
        const rowsN = Math.ceil(loaded.length / perRow);
        page.ensure(rowsN * (thumb + gap) + 6);
        loaded.forEach((img, i) => {
          if (!img) return;
          const x = MARGIN + (i % perRow) * (thumb + gap);
          const y = page.y + Math.floor(i / perRow) * (thumb + gap);
          const ratio = img.width / img.height;
          let w = thumb;
          let h = thumb;
          if (ratio > 1) h = thumb / ratio;
          else w = thumb * ratio;
          hardBlock(doc, x, y, thumb, thumb, WHITE, 1.2, 0.5);
          try {
            doc.addImage(img.dataUrl, x + (thumb - w) / 2, y + (thumb - h) / 2, w, h);
          } catch {
            // Formats jsPDF can't embed (some WebP builds) — the frame stays so the layout holds.
          }
        });
        page.space(rowsN * (thumb + gap) + 6);
      } else {
        font(doc, SANS, "normal", 9.5, INK_SOFT);
        page.ensure(8);
        doc.text(`${p.portfolio_images.length} portfolio image${p.portfolio_images.length === 1 ? "" : "s"} — view on the full profile online.`, MARGIN, page.y);
        page.space(10);
      }
    }
  }

  // ── Call to action ─────────────────────────────────────────────────────
  font(doc, SANS, "normal", 9.2, INK);
  const ctaLines: string[] = doc.splitTextToSize(
    `Book ${p.name} through ChatSched. We handle the briefing, scheduling, verification and payment protection — your money is protected until your placement goes live.`,
    CONTENT_W - 14
  );
  const ctaH = 24 + ctaLines.length * 4.4 + 9;
  page.ensure(ctaH + 8);
  hardBlock(doc, MARGIN, page.y, CONTENT_W, ctaH, YELLOW, 2.2, 0.8);
  font(doc, DISPLAY, "normal", 17, INK);
  doc.text("READY TO ADVERTISE?", MARGIN + 7, page.y + 12);
  font(doc, SANS, "normal", 9.2, INK);
  doc.text(ctaLines, MARGIN + 7, page.y + 18.5);
  font(doc, MONO, "bold", 7.4, PAPER);
  const contact = `${CONTACT_WEBSITE} · ${CONTACT_EMAIL}`.toUpperCase();
  const cW = doc.getTextWidth(contact) + 7;
  const chipY = page.y + 18.5 + ctaLines.length * 4.4 + 1.5;
  doc.setFillColor(INK);
  doc.rect(MARGIN + 7, chipY, cW, 6.6, "F");
  doc.text(contact, MARGIN + 10.5, chipY + 4.6);
  page.space(ctaH + 6);

  // ── Footer on every page ─────────────────────────────────────────────
  // Deliberately doesn't repeat input.profileUrl — this document is handed out as its
  // own piece of collateral (emailed, printed, AirDropped).
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(INK);
    doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");
    font(doc, MONO, "normal", 6.8, PAPER);
    doc.text(`${CONTACT_WEBSITE} · ${CONTACT_EMAIL}`.toUpperCase(), MARGIN, PAGE_H - 4.4);
    const label = `PAGE ${i} / ${pageCount}`;
    font(doc, MONO, "bold", 6.8, INK);
    const lw = doc.getTextWidth(label) + 5;
    doc.setFillColor(YELLOW);
    doc.rect(PAGE_W - MARGIN - lw, PAGE_H - FOOTER_H + 2.4, lw, 6.2, "F");
    doc.text(label, PAGE_W - MARGIN - lw + 2.5, PAGE_H - 4.4);
  }

  const fileSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`chatsched-media-kit-${fileSlug || "publisher"}.pdf`);
}
