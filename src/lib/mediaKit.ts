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

const INK = "#1A1712";
const INK_SOFT = "#6B6250";
const GREEN = "#1F7A4D";
const YELLOW_DEEP = "#8A6600";
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

function drawSectionHeading(doc: import("jspdf").jsPDF, cursor: PdfCursor, title: string) {
  cursor.ensure(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(title.toUpperCase(), MARGIN, cursor.y);
  cursor.space(2);
  doc.setDrawColor(INK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
  cursor.space(8);
}

function drawStatGrid(doc: import("jspdf").jsPDF, cursor: PdfCursor, stats: { label: string; value: string }[]) {
  const cols = Math.min(stats.length, 3);
  const colWidth = (PAGE_WIDTH - MARGIN * 2) / cols;
  const rowHeight = 20;
  cursor.ensure(rowHeight + 4);
  stats.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * colWidth;
    const y = cursor.y + row * rowHeight;
    doc.setDrawColor(INK);
    doc.setLineWidth(0.4);
    doc.rect(x, y, colWidth - 4, rowHeight - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(s.value, x + 4, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK_SOFT);
    doc.text(s.label.toUpperCase(), x + 4, y + 15);
  });
  const rows = Math.ceil(stats.length / cols);
  cursor.space(rows * rowHeight + 6);
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

  // ── Cover / header ──────────────────────────────────────────────
  cursor.y = 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text("CHATSCHED", MARGIN, cursor.y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  cursor.space(6);
  doc.text("Managed Advertising + Marketplace + Publisher Network", MARGIN, cursor.y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.text("MEDIA KIT", PAGE_WIDTH - MARGIN, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text(new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), PAGE_WIDTH - MARGIN, 28, { align: "right" });

  cursor.y = 42;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, cursor.y, PAGE_WIDTH - MARGIN, cursor.y);
  cursor.space(14);

  // ── Profile ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(INK);
  doc.text(p.name, MARGIN, cursor.y);
  cursor.space(2);

  const badges: string[] = [];
  if (p.verified) badges.push("✓ Verified");
  if (p.level) badges.push(LEVEL_META[p.level].label);
  if (badges.length) {
    cursor.space(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(GREEN);
    doc.text(badges.join("   ·   "), MARGIN, cursor.y);
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

  // ── Audience ─────────────────────────────────────────────────────
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

  // ── Pricing & ad formats ─────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Pricing & Ad Formats");

  if (isRequestFlowChannel && channelDef) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(GREEN);
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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(GREEN);
    cursor.ensure(9);
    doc.text(`${rand(p.price_per_post)} per post`, MARGIN, cursor.y);
    cursor.space(10);
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

  // ── Trust & verification ──────────────────────────────────────────
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

  const verificationLines: string[] = [];
  verificationLines.push(`${p.email_verified ? "✓" : "○"} Email verified`);
  verificationLines.push(`${p.phone_verified ? "✓" : "○"} Phone verified`);
  verificationLines.push(`${p.identity_verified ? "✓" : "○"} Identity verified`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  cursor.ensure(verificationLines.length * 5.5 + 4);
  verificationLines.forEach((line) => {
    doc.setTextColor(line.startsWith("✓") ? GREEN : INK_SOFT);
    doc.text(line, MARGIN, cursor.y);
    cursor.space(5.5);
  });
  cursor.space(4);

  // ── Campaign history ──────────────────────────────────────────────
  drawSectionHeading(doc, cursor, "Campaign History");
  const memberSince = p.created_at
    ? new Date(p.created_at).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
    : null;
  const historyStats: { label: string; value: string }[] = [
    { label: "Completed campaigns", value: String(input.completedCampaigns) },
  ];
  if (memberSince) historyStats.push({ label: "On ChatSched since", value: memberSince });
  drawStatGrid(doc, cursor, historyStats);

  // ── Reviews ──────────────────────────────────────────────────────
  if (input.reviews.length > 0) {
    drawSectionHeading(doc, cursor, "Reviews");
    const avgRating = input.reviews.reduce((sum, r) => sum + r.rating, 0) / input.reviews.length;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    cursor.ensure(8);
    doc.text(`${"★".repeat(Math.round(avgRating))}${"☆".repeat(5 - Math.round(avgRating))}  ${avgRating.toFixed(1)} average from ${input.reviews.length} review${input.reviews.length === 1 ? "" : "s"}`, MARGIN, cursor.y);
    cursor.space(10);

    input.reviews.slice(0, 4).forEach((rev) => {
      const author = rev.business?.company_name || rev.business?.full_name || "A business";
      const stars = "★".repeat(rev.rating) + "☆".repeat(5 - rev.rating);
      const commentLines = rev.comment ? doc.splitTextToSize(rev.comment, PAGE_WIDTH - MARGIN * 2 - 4) : [];
      const blockHeight = 6 + commentLines.length * 4.6 + 6;
      cursor.ensure(blockHeight);
      doc.setDrawColor(INK);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, cursor.y - 4, MARGIN, cursor.y + blockHeight - 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(INK);
      doc.text(`${author}  `, MARGIN + 4, cursor.y);
      doc.setTextColor(YELLOW_DEEP);
      doc.text(stars, MARGIN + 4 + doc.getTextWidth(`${author}  `), cursor.y);
      cursor.space(5.5);
      if (commentLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(INK_SOFT);
        doc.text(commentLines, MARGIN + 4, cursor.y);
        cursor.space(commentLines.length * 4.6);
      }
      cursor.space(6);
    });
  }

  // ── Portfolio ──────────────────────────────────────────────────────
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

  // ── Footer on every page ────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    footer(`${input.profileUrl}  ·  Page ${i} of ${pageCount}`);
  }

  const fileSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`chatsched-media-kit-${fileSlug || "publisher"}.pdf`);
}
