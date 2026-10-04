import { CONTACT_EMAIL, CONTACT_WEBSITE, PLATFORM_BANK_DETAILS } from "./constants";
import { formatCurrency } from "./currency";
import { channelRequestBreakdown, fromCents } from "./fees";
import { getChannelBySlug } from "./channelRegistry";
import {
  DISPLAY, INK, INK_SOFT, MONO, PAPER, SANS, WHITE, YELLOW,
  chip, drawChatschedMark, font, hardBlock, registerBrandFonts, type Doc,
} from "./mediaKit";
import type { ChannelRequest, Profile } from "./types";

/**
 * The Payment Card: what a business is shown (and can download) the moment a
 * creator accepts. It is deliberately NOT called an invoice. It states the
 * service booked, what is due, and where to pay.
 *
 * It says nothing about VAT or tax status: that wording is for the
 * accountant. See the hand-over notes.
 */

export interface PaymentCardModel {
  reference: string;
  issuedDate: string;
  dueDate: string | null;
  billedTo: string;
  creatorName: string;
  channelName: string;
  platform: string | null;
  placement: string;
  postDate: string | null;
  goLiveDate: string | null;
  summary: string;
  creatorPriceCents: number;
  bookingFeeCents: number;
  totalDueCents: number;
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

/** The request form prefixes "Platform: X (only)" onto the campaign message. */
export function splitPlatformFromMessage(message: string): { platform: string | null; rest: string } {
  const m = message.match(/^Platform:\s*(.+?)(?:\s*\(only\))?\s*(?:\n+|$)/);
  if (!m) return { platform: null, rest: message.trim() };
  return { platform: m[1].trim(), rest: message.slice(m[0].length).trim() };
}

export function buildPaymentCardModel(
  r: ChannelRequest,
  profile: Pick<Profile, "company_name" | "full_name"> | null,
): PaymentCardModel {
  const bd = channelRequestBreakdown(r);
  const { platform, rest } = splitPlatformFromMessage(r.campaign_message ?? "");
  const meta = (r.request_metadata ?? {}) as Record<string, unknown>;
  const preferred = typeof meta.preferredPostDate === "string" ? meta.preferredPostDate : null;
  return {
    reference: r.payment_reference ?? `CS-${r.id.slice(0, 8).toUpperCase()}`,
    issuedDate: fmtDate(r.responded_at ?? r.created_at) ?? "",
    dueDate: fmtDate(r.payment_due_at),
    billedTo: profile?.company_name || profile?.full_name || "Your business",
    creatorName: r.creator?.name ?? "Creator",
    channelName: getChannelBySlug(r.channel_slug)?.definition.name ?? r.channel_slug,
    platform,
    placement: r.advertising_method,
    postDate: fmtDate(preferred),
    goLiveDate: fmtDate(r.scheduled_live_at),
    summary: rest,
    creatorPriceCents: bd.creatorPriceCents,
    bookingFeeCents: bd.bookingFeeCents,
    totalDueCents: bd.totalDueCents,
  };
}

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const CW = PAGE_W - M * 2;

function money(cents: number): string {
  return formatCurrency(fromCents(cents), { cents: true });
}

function label(doc: Doc, text: string, x: number, y: number) {
  font(doc, MONO, "bold", 6.6, INK_SOFT);
  doc.text(text.toUpperCase(), x, y);
}

export async function buildAndDownloadPaymentCard(model: PaymentCardModel) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerBrandFonts(doc);

  doc.setFillColor(PAPER);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Header band
  doc.setFillColor(YELLOW);
  doc.rect(0, 0, PAGE_W, 34, "F");
  doc.setFillColor(INK);
  doc.rect(0, 34, PAGE_W, 1.2, "F");
  const mw = drawChatschedMark(doc, M, 10, 11, INK);
  font(doc, DISPLAY, "normal", 20, INK);
  doc.text("ChatSched", M + mw + 4, 19.5);
  font(doc, MONO, "bold", 7, INK);
  doc.text("THE SA AD MARKETPLACE", M + mw + 4, 25);
  hardBlock(doc, PAGE_W - M - 46, 11, 46, 13, INK, 0, 0.4);
  font(doc, MONO, "bold", 8.5, YELLOW);
  doc.text("PAYMENT CARD", PAGE_W - M - 23, 19.2, { align: "center" });

  // Title + reference
  font(doc, DISPLAY, "normal", 26, INK);
  doc.text("Your booking is approved.", M, 52);
  font(doc, SANS, "normal", 10.5, INK_SOFT);
  doc.text(`${model.creatorName} said yes. Pay ChatSched to lock it in.`, M, 59);

  // Meta row
  const cols = [M, M + CW / 3, M + (CW / 3) * 2];
  label(doc, "Billed to", cols[0], 72);
  label(doc, "Issued", cols[1], 72);
  label(doc, "Pay by", cols[2], 72);
  font(doc, SANS, "bold", 10.5, INK);
  doc.text(doc.splitTextToSize(model.billedTo, CW / 3 - 4).slice(0, 2), cols[0], 78);
  doc.text(model.issuedDate || "-", cols[1], 78);
  doc.text(model.dueDate ?? "Within 7 days of approval", cols[2], 78);

  // Booked service
  let y = 90;
  const rows: Array<[string, string]> = [
    ["Creator", model.creatorName],
    ["Channel", model.channelName],
    ["Platform", model.platform ?? "-"],
    ["Placement", model.placement],
    ["Dates", [model.goLiveDate ? `Go-live ${model.goLiveDate}` : null, model.postDate ? `Requested ${model.postDate}` : null].filter(Boolean).join("  ·  ") || "To be confirmed with the creator"],
  ];
  const summaryLines = model.summary ? (doc.splitTextToSize(model.summary, CW - 12) as string[]).slice(0, 3) : [];
  const blockH = 14 + rows.length * 8 + (summaryLines.length ? 6 + summaryLines.length * 4.4 : 0);
  hardBlock(doc, M, y, CW, blockH, WHITE, 1.6, 0.7);
  chip(doc, M + 6, y + 8, "Booked service", { fill: INK });
  let ry = y + 17;
  for (const [k, v] of rows) {
    label(doc, k, M + 6, ry);
    font(doc, SANS, "bold", 10, INK);
    doc.text(doc.splitTextToSize(v, CW - 48)[0] as string, M + 40, ry);
    ry += 8;
  }
  if (summaryLines.length) {
    font(doc, SANS, "normal", 8.6, INK_SOFT);
    doc.text(summaryLines, M + 6, ry + 1);
  }

  // Price
  y += blockH + 12;
  const line = (k: string, v: string, yy: number, bold = false) => {
    font(doc, SANS, bold ? "bold" : "normal", 10.5, INK);
    doc.text(k, M + 2, yy);
    doc.text(v, PAGE_W - M - 2, yy, { align: "right" });
  };
  line("Creator price", money(model.creatorPriceCents), y);
  line("ChatSched booking fee", money(model.bookingFeeCents), y + 7);
  doc.setDrawColor(INK);
  doc.setLineWidth(0.4);
  doc.line(M, y + 11, PAGE_W - M, y + 11);
  hardBlock(doc, M, y + 15, CW, 17, YELLOW, 1.6, 0.9);
  font(doc, MONO, "bold", 8, INK);
  doc.text("TOTAL DUE", M + 6, y + 25.6);
  font(doc, DISPLAY, "normal", 20, INK);
  doc.text(money(model.totalDueCents), PAGE_W - M - 6, y + 26.4, { align: "right" });

  // How to pay
  y += 44;
  const payH = 54;
  hardBlock(doc, M, y, CW, payH, PAPER, 1.6, 0.9);
  chip(doc, M + 6, y + 8, "How to pay · bank transfer", { fill: INK });
  const bank: Array<[string, string]> = [
    ["Account holder", PLATFORM_BANK_DETAILS.accountHolder],
    ["Bank", PLATFORM_BANK_DETAILS.bank],
    ["Account number", PLATFORM_BANK_DETAILS.accountNumber],
    ["Branch code", PLATFORM_BANK_DETAILS.branchCode],
    ["Account type", PLATFORM_BANK_DETAILS.accountType],
  ];
  const colW = (CW - 12) / 2;
  bank.forEach(([k, v], i) => {
    const cx = M + 6 + (i % 2) * colW;
    const cy = y + 18 + Math.floor(i / 2) * 10;
    label(doc, k, cx, cy);
    font(doc, SANS, "bold", 10, INK);
    doc.text(v, cx, cy + 4.6);
  });
  // Reference gets its own highlighted slot (6th cell)
  const rx = M + 6 + colW;
  const rY = y + 18 + 2 * 10;
  doc.setFillColor(YELLOW);
  doc.rect(rx - 2, rY - 4.2, colW - 2, 11.5, "F");
  label(doc, "Reference (use exactly)", rx, rY);
  font(doc, MONO, "bold", 12, INK);
  doc.text(model.reference, rx, rY + 5.4);
  font(doc, SANS, "normal", 8.2, INK_SOFT);
  doc.text(
    "Your placement goes live once the money has cleared in our bank account, not on a proof of payment.",
    M + 6, y + payH - 5,
  );

  // Footer
  font(doc, SANS, "normal", 7.8, INK_SOFT);
  doc.text(
    "Cancellation and refund terms are in the ChatSched Terms. Questions? Reply to your booking on your dashboard.",
    M, PAGE_H - 16,
  );
  font(doc, MONO, "bold", 7, INK);
  doc.text(`${CONTACT_WEBSITE}  ·  ${CONTACT_EMAIL}`, M, PAGE_H - 10);
  doc.text(model.reference, PAGE_W - M, PAGE_H - 10, { align: "right" });

  doc.save(`payment-card-${model.reference}.pdf`);
}
