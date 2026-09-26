import { CONTACT_EMAIL, CONTACT_WEBSITE } from "./constants";
import { LEVEL_META, scoreLabel } from "./publisherDisplay";
import { getChannelBySlug } from "./channelRegistry";
import { formatCurrency as formatCurrencyShared } from "./currency";
import type { Publisher, Review } from "./types";

// Generates a branded, multi-page media kit PDF entirely client-side — same
// approach as invoice.ts (lazy-loaded jsPDF, no server round trip, nothing
// stored). This is the publisher's own sales collateral: everything in it
// is already public on their profile page. Deliberately excludes anything
// admin-only or internal — authenticity_risk/authenticity_notes, admin_notes,
// rejected_reason — since this is a document meant to be handed to a
// prospective advertiser, not a moderation record.
//
// jsPDF's standard 14 fonts (helvetica included) only reliably encode
// WinAnsi/Latin-1 characters (0x00-0xFF). Characters outside that range —
// a checkmark (✓), an empty circle (○), stars (★ ☆) — silently render as
// garbage bytes instead of failing loudly, which is why an earlier version
// of this file produced things like "%Ë Email verified" in the exported
// PDF. Every place that needs a check/rating mark below draws a small
// vector shape (a filled or outlined circle/square) instead of relying on
// a font glyph for it.

const INK = "#1A1712";
const INK_SOFT = "#4A4335";
const PAPER_DIM = "#F0EEE6";
const YELLOW = "#F5B700";
const YELLOW_DEEP = "#D9A400";
const GREEN = "#1C6B45";
const GREEN_DEEP = "#134F34";
const RULE_DIM = "#DCD5C2";
const PAGE_WIDTH = 210;
const MARGIN = 20;
const FOOTER_Y = 283;

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

class PdfCursor {
  y = 0;
  private doc: import("jspdf").jsPDF;
  constructor(doc: import("jspdf").jsPDF) {
    this.doc = doc;
  }

  /** Adds a new page and resets y whenever the next block wouldn't fit above the footer line. */
  ensure(needed: number) {
    if (this.y + needed > FOOTER_Y) {
      this.doc.addPage();
      this.y = 24;
    }
  }

  space(n: number) {
    this.y += n;
  }
}

/** Small filled square marker drawn to the left of a section heading, for brand consistency with the logo. */
function drawAccentMark(doc: import("jspdf").jsPDF, x: number, baselineY: number, size: number) {
  doc.setFillColor(YELLOW);
  doc.rect(x, baselineY - size, size, size, "F");
}

/**
 * The real ChatSched mark: a bracket/sign outline with two short "legs",
 * ported directly from ChatSchedMark in VisualIdentitySystem.tsx (viewBox
 * "0 0 26 22": a 24x14 rect at (1,1), plus two vertical legs at x=8 and
 * x=18 running from y=15 to y=21) so the media kit's header uses the same
 * mark as the rest of the product rather than a one-off drawn from scratch.
 * Returns the mark's width for positioning the wordmark next to it.
 */
function drawChatschedMark(doc: import("jspdf").jsPDF, x: number, y: number, h: number, color: string): number {
  const w = h * (26 / 22);
  doc.setDrawColor(color);
  doc.setLineWidth(h * (2.4 / 22));
  doc.rect(x + w * (1 / 26), y + h * (1 / 22), w * (24 / 26), h * (14 / 22), "S");
  const legX1 = x + w * (8 / 26);
  const legX2 = x + w * (18 / 26);
  const legY1 = y + h * (15 / 22);
  const legY2 = y + h * (21 / 22);
  doc.line(legX1, legY1, legX1, legY2);
  doc.line(legX2, legY1, legX2, legY2);
  return w;
}

function drawSectionHeading(doc: import("jspdf").jsPDF, cursor: PdfCursor, title: string) {
  cursor.ensure(14);
  drawAccentMark(doc, MARGIN, cursor.y, 3.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(title.toUpperCase(), MARGIN + 5.5, cursor.y);
  cursor.space(2);
  doc.setDrawColor(RULE_DIM);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
  cursor.space(8);
}

function drawStatGrid(doc: import("jspdf").jsPDF, cursor: PdfCursor, stats: { label: string; value: string }[]) {
  const cols = Math.min(stats.length, 3);
  const colWidth = (PAGE_WIDTH - MARGIN * 2) / cols;
  const rowHeight = 20;
  const gap = 3;
  cursor.ensure(rowHeight + 4);
  stats.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * colWidth;
    const y = cursor.y + row * rowHeight;
    const boxW = colWidth - gap;
    const boxH = rowHeight - gap;
    doc.setFillColor(PAPER_DIM);
    doc.setDrawColor(INK);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, boxW, boxH, 1.6, 1.6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(s.value, x + 4, y + 9.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK_SOFT);
    doc.text(s.label.toUpperCase(), x + 4, y + 15.5);
  });
  const rows = Math.ceil(stats.length / cols);
  cursor.space(rows * rowHeight + 6);
}

/**
 * Draws a filled pill sized to fit `text` at the current font/size, with its baseline at
 * (x, baselineY). Returns the pill's width so callers can chain several in a row.
 */
function drawPill(doc: import("jspdf").jsPDF, x: number, baselineY: number, text: string, fill: string, textColor: string): number {
  const padX = 3;
  const pillH = 5.6;
  const textW = doc.getTextWidth(text);
  const pillW = textW + padX * 2;
  doc.setFillColor(fill);
  doc.roundedRect(x, baselineY - pillH + 1.6, pillW, pillH, pillH / 2, pillH / 2, "F");
  doc.setTextColor(textColor);
  doc.text(text, x + padX, baselineY);
  return pillW;
}

/** A small filled circle for "verified", an outlined one for "not verified" — see the encoding note up top for why this isn't a ✓/○ glyph. */
function drawVerificationDot(doc: import("jspdf").jsPDF, x: number, baselineY: number, verified: boolean) {
  const r = 1.7;
  const cy = baselineY - r * 0.9;
  if (verified) {
    doc.setFillColor(GREEN);
    doc.circle(x + r, cy, r, "F");
  } else {
    doc.setDrawColor(INK_SOFT);
    doc.setLineWidth(0.35);
    doc.circle(x + r, cy, r, "S");
  }
}

/** A row of small squares, filled up to `rating` — see the encoding note up top for why this isn't a ★/☆ glyph. Returns the total width drawn. */
function drawRatingChips(doc: import("jspdf").jsPDF, x: number, baselineY: number, rating: number, max = 5): number {
  const size = 3.4;
  const gap = 1.1;
  const filledCount = Math.round(rating);
  for (let i = 0; i < max; i++) {
    const cx = x + i * (size + gap);
    const cy = baselineY - size + 0.5;
    if (i < filledCount) {
      doc.setFillColor(YELLOW_DEEP);
      doc.setDrawColor(YELLOW_DEEP);
      doc.roundedRect(cx, cy, size, size, 0.7, 0.7, "F");
    } else {
      doc.setDrawColor(RULE_DIM);
      doc.setLineWidth(0.35);
      doc.roundedRect(cx, cy, size, size, 0.7, 0.7, "S");
    }
  }
  return max * (size + gap) - gap;
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
  const cursor = new PdfCursor(doc);
  const p = input.publisher;
  const channelDef = getChannelBySlug(p.channel_slug)?.definition;
  const isRequestFlowChannel = !!channelDef && channelDef.bookingFlow === "request";

  function footer(pageLabel: string) {
    doc.setDrawColor(220, 213, 195);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y - 6, PAGE_WIDTH - MARGIN, FOOTER_Y - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK_SOFT);
    doc.text(`${CONTACT_WEBSITE} · ${CONTACT_EMAIL}`, MARGIN, FOOTER_Y);
    doc.text(pageLabel, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
  }

  // ── Cover / header ───────────────────────────────────────────────────
  const markH = 7;
  const headerTop = 16;
  const markW = drawChatschedMark(doc, MARGIN, headerTop, markH, INK);

  // Two-tone wordmark ("Chat" in brand green, "Sched" in ink) next to the mark —
  // same pairing the product's own PDF-less pages use for "ChatSched".
  const wordBaseline = headerTop + markH - 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(GREEN);
  doc.text("Chat", MARGIN + markW + 4, wordBaseline);
  const chatWidth = doc.getTextWidth("Chat");
  doc.setTextColor(INK);
  doc.text("Sched", MARGIN + markW + 4 + chatWidth, wordBaseline);

  const subtitleY = wordBaseline + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text("Managed Advertising + Marketplace + Publisher Network", MARGIN, subtitleY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.text("MEDIA KIT", PAGE_WIDTH - MARGIN, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text(new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), PAGE_WIDTH - MARGIN, 26, { align: "right" });

  cursor.y = subtitleY + 5;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
  doc.setDrawColor(YELLOW);
  doc.setLineWidth(1.3);
  doc.line(MARGIN, cursor.y + 1.8, MARGIN + 30, cursor.y + 1.8);
  cursor.space(14);

  // ── Profile ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(INK);
  doc.text(p.name, MARGIN, cursor.y);
  cursor.space(2);

  const badges: string[] = [];
  if (p.verified) badges.push("Verified");
  if (p.level) badges.push(LEVEL_META[p.level].label);
  if (badges.length) {
    cursor.space(7);
    let badgeX = MARGIN;
    badges.forEach((b) => {
      badgeX += drawPill(doc, badgeX, cursor.y, b, GREEN, "#FFFFFF") + 3;
    });
  }

  cursor.space(8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK_SOFT);
  const locationLine = `${p.city}${p.suburb ? ` (${p.suburb})` : ""}, ${p.province} · ${p.category}${isRequestFlowChannel && channelDef ? ` · ${channelDef.name}` : ""}`;
  doc.text(locationLine, MARGIN, cursor.y);
  cursor.space(10);

  if (p.bio) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const bioLines = doc.splitTextToSize(p.bio, PAGE_WIDTH - MARGIN * 2);
    cursor.ensure(bioLines.length * 5 + 4);
    doc.text(bioLines, MARGIN, cursor.y);
    cursor.space(bioLines.length * 5 + 10);
  }

  // ── Audience ────────────────────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Audience");
  const audienceStats = [
    { label: "Followers", value: p.followers.toLocaleString() },
    { label: "Engagement rate", value: `${p.engagement}%` },
  ];
  if (p.monthly_reach != null) audienceStats.push({ label: "Monthly reach", value: p.monthly_reach.toLocaleString() });
  drawStatGrid(doc, cursor, audienceStats);

  if (p.platforms.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(INK_SOFT);
    cursor.ensure(6);
    doc.text("PLATFORMS", MARGIN, cursor.y);
    cursor.space(5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(p.platforms.join("   ·   "), MARGIN, cursor.y);
    cursor.space(9);
  }

  if (p.languages?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(INK_SOFT);
    cursor.ensure(6);
    doc.text("LANGUAGES", MARGIN, cursor.y);
    cursor.space(5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(p.languages.join("   ·   "), MARGIN, cursor.y);
    cursor.space(9);
  }

  if (p.audience) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(INK_SOFT);
    cursor.ensure(6);
    doc.text("AUDIENCE DESCRIPTION", MARGIN, cursor.y);
    cursor.space(5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const audienceLines = doc.splitTextToSize(p.audience, PAGE_WIDTH - MARGIN * 2);
    cursor.ensure(audienceLines.length * 5 + 4);
    doc.text(audienceLines, MARGIN, cursor.y);
    cursor.space(audienceLines.length * 5 + 10);
  }

  // ── Pricing & ad formats ───────────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Pricing & Ad Formats");

  if (isRequestFlowChannel && channelDef) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(GREEN_DEEP);
    cursor.ensure(7);
    doc.text(`Pricing varies by campaign — recommended minimum ${rand(channelDef.minBudgetZAR)}`, MARGIN, cursor.y);
    cursor.space(8);

    if (channelDef.pricingModels?.length) {
      channelDef.pricingModels.forEach((pm) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(INK);
        cursor.ensure(5);
        doc.text(`${pm.label} — from ${rand(pm.minPrice)}`, MARGIN, cursor.y);
        cursor.space(5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(INK_SOFT);
        const pmLines = doc.splitTextToSize(pm.description, PAGE_WIDTH - MARGIN * 2);
        cursor.ensure(pmLines.length * 4.2 + 3);
        doc.text(pmLines, MARGIN, cursor.y);
        cursor.space(pmLines.length * 4.2 + 5);
      });
    }
  } else {
    const priceText = `${rand(p.price_per_post)} per post`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const padX = 5;
    const boxW = doc.getTextWidth(priceText) + padX * 2;
    const boxH = 12;
    cursor.ensure(boxH + 4);
    doc.setFillColor(YELLOW);
    doc.roundedRect(MARGIN, cursor.y, boxW, boxH, 2.2, 2.2, "F");
    doc.setTextColor(INK);
    doc.text(priceText, MARGIN + padX, cursor.y + boxH - 4.2);
    cursor.space(boxH + 8);
  }

  const adFormats = isRequestFlowChannel
    ? (p.accepted_ad_formats && p.accepted_ad_formats.length > 0 ? p.accepted_ad_formats : channelDef?.advertisingMethods?.map((m) => m.label) ?? [])
    : p.placement_types ?? [];
  if (adFormats.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(INK_SOFT);
    cursor.ensure(6);
    doc.text("AD FORMATS OFFERED", MARGIN, cursor.y);
    cursor.space(5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const formatLines = doc.splitTextToSize(adFormats.join("   ·   "), PAGE_WIDTH - MARGIN * 2);
    cursor.ensure(formatLines.length * 5 + 4);
    doc.text(formatLines, MARGIN, cursor.y);
    cursor.space(formatLines.length * 5 + 10);
  }

  // ── Trust & verification ─────────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Trust & Verification");
  const trustStats: { label: string; value: string }[] = [];
  if (p.trust_score > 0) trustStats.push({ label: "Trust score", value: `${p.trust_score}/100` });
  if (p.publisher_score > 0) trustStats.push({ label: "Publisher score", value: scoreLabel(p.publisher_score) });
  if (p.avg_response_hours != null && p.response_count >= 3) {
    const hrs = p.avg_response_hours;
    const label = hrs < 1 ? "< 1 hour" : hrs < 24 ? `${Math.round(hrs)} hours` : `${Math.round(hrs / 24)} days`;
    trustStats.push({ label: "Avg. response time", value: label });
  }
  if (trustStats.length) drawStatGrid(doc, cursor, trustStats);

  const verificationRows: { label: string; verified: boolean }[] = [
    { label: "Email verified", verified: p.email_verified },
    { label: "Phone verified", verified: p.phone_verified },
    { label: "Identity verified", verified: p.identity_verified },
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  cursor.ensure(verificationRows.length * 5.5 + 4);
  verificationRows.forEach((row) => {
    drawVerificationDot(doc, MARGIN, cursor.y, row.verified);
    doc.setTextColor(row.verified ? GREEN : INK_SOFT);
    doc.text(row.label, MARGIN + 6.5, cursor.y);
    cursor.space(5.5);
  });
  cursor.space(4);

  // ── Campaign history ───────────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Campaign History");
  const memberSince = p.created_at
    ? new Date(p.created_at).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
    : null;
  const historyStats: { label: string; value: string }[] = [
    { label: "Completed campaigns", value: String(input.completedCampaigns) },
  ];
  if (memberSince) historyStats.push({ label: "On ChatSched since", value: memberSince });
  drawStatGrid(doc, cursor, historyStats);

  // ── Reviews ────────────────────────────────────────────────────────────
  if (input.reviews.length > 0) {
    drawSectionHeading(doc, cursor, "Reviews");
    const avgRating = input.reviews.reduce((sum, r) => sum + r.rating, 0) / input.reviews.length;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    cursor.ensure(9);
    const chipsWidth = drawRatingChips(doc, MARGIN, cursor.y, avgRating);
    doc.text(`${avgRating.toFixed(1)} average from ${input.reviews.length} review${input.reviews.length === 1 ? "" : "s"}`, MARGIN + chipsWidth + 4, cursor.y);
    cursor.space(11);

    input.reviews.slice(0, 4).forEach((rev) => {
      const author = rev.business?.company_name || rev.business?.full_name || "A business";
      const commentLines = rev.comment ? doc.splitTextToSize(rev.comment, PAGE_WIDTH - MARGIN * 2 - 4) : [];
      const blockHeight = 6 + commentLines.length * 4.6 + 6;
      cursor.ensure(blockHeight);
      doc.setFillColor(YELLOW);
      doc.rect(MARGIN, cursor.y - 4, 1.3, blockHeight - 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(INK);
      doc.text(author, MARGIN + 4.5, cursor.y);
      drawRatingChips(doc, MARGIN + 4.5 + doc.getTextWidth(author) + 3, cursor.y, rev.rating);
      cursor.space(5.5);
      if (commentLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(INK_SOFT);
        doc.text(commentLines, MARGIN + 4.5, cursor.y);
        cursor.space(commentLines.length * 4.6);
      }
      cursor.space(6);
    });
  }

  // ── Portfolio ────────────────────────────────────────────────────────────
  if (p.portfolio_images?.length || p.intro_video_url) {
    drawSectionHeading(doc, cursor, "Portfolio");

    if (p.intro_video_url) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(INK_SOFT);
      cursor.ensure(6);
      doc.text(`Intro video: ${p.intro_video_url}`, MARGIN, cursor.y);
      cursor.space(9);
    }

    if (p.portfolio_images?.length) {
      const thumbSize = 42;
      const gap = 4;
      const perRow = Math.floor((PAGE_WIDTH - MARGIN * 2 + gap) / (thumbSize + gap));
      const loaded = await Promise.all(p.portfolio_images.slice(0, 5).map(fetchImageAsDataUrl));
      const anyLoaded = loaded.some(Boolean);

      if (anyLoaded) {
        const rows = Math.ceil(loaded.length / perRow);
        cursor.ensure(rows * (thumbSize + gap) + 4);
        loaded.forEach((img, i) => {
          if (!img) return;
          const col = i % perRow;
          const row = Math.floor(i / perRow);
          const x = MARGIN + col * (thumbSize + gap);
          const y = cursor.y + row * (thumbSize + gap);
          const ratio = img.width / img.height;
          let w = thumbSize;
          let h = thumbSize;
          if (ratio > 1) h = thumbSize / ratio;
          else w = thumbSize * ratio;
          doc.setDrawColor(INK);
          doc.setLineWidth(0.4);
          doc.rect(x, y, thumbSize, thumbSize);
          try {
            doc.addImage(img.dataUrl, x + (thumbSize - w) / 2, y + (thumbSize - h) / 2, w, h);
          } catch {
            // A handful of formats jsPDF can't embed (e.g. some WebP builds) —
            // the border stays so the layout doesn't visibly break.
          }
        });
        cursor.space(rows * (thumbSize + gap) + 6);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(INK_SOFT);
        cursor.ensure(6);
        doc.text(`${p.portfolio_images.length} portfolio image${p.portfolio_images.length === 1 ? "" : "s"} — view on the full profile online.`, MARGIN, cursor.y);
        cursor.space(9);
      }
    }
  }

  // ── Footer on every page ────────────────────────────────────────────
  // Deliberately doesn't repeat input.profileUrl here — this document is handed out as its
  // own piece of collateral (emailed, printed, AirDropped), so a page footer is not the
  // place for a link back to the listing it came from.
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    footer(`Page ${i} of ${pageCount}`);
  }

  const fileSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`chatsched-media-kit-${fileSlug || "publisher"}.pdf`);
}
