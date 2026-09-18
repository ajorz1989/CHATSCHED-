import { PLATFORM_COMMISSION_RATE, CONTACT_EMAIL, CONTACT_ADDRESS_LINES } from "./constants";
import { formatCurrency as formatCurrencyShared } from "./currency";

// Generates a clean, self-contained PDF entirely client-side — no server
// round trip, no stored file. Used from both the business dashboard (for a
// completed payment) and the publisher dashboard (as a payout statement for
// the same underlying payment). Two calls into the same builder so the two
// documents always agree on figures, they just present the money split
// from opposite sides of it.

const INK = "#1A1712";
const INK_SOFT = "#6B6250";
const GREEN = "#1F7A4D";
const ACCENT = "#F4C542"; // ChatSched yellow, used sparingly as a header/footer accent band
const RULE_LIGHT = "#DCD5C3";
const TABLE_HEADER_BG = 245; // light paper-tone fill for the line-item header row (R=G=B kept close to CONTACT_ADDRESS_LINES-era styling)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;

interface InvoicePartyLine {
  heading: string;
  lines: string[];
}

export interface InvoiceInput {
  /** e.g. "MB-A1B2C3D4" */
  invoiceNumber: string;
  /** Human display date, e.g. "6 August 2026" */
  issueDate: string;
  statusLabel: string;
  billTo: InvoicePartyLine;
  from: InvoicePartyLine;
  description: string;
  channelLabel: string;
  grossAmount: number;
  /** When set, breaks the total down into platform commission + net payout — used for the publisher's copy. */
  showCommissionSplit: boolean;
  /** File name without extension. */
  fileName: string;
}

function rand(n: number): string {
  return formatCurrencyShared(n, { cents: true });
}

export async function buildAndDownloadInvoice(input: InvoiceInput) {
  // Loaded on demand — jsPDF (and its optional image-export dependencies)
  // is only needed by the handful of users who actually click "Download
  // Invoice", so it shouldn't sit in the bundle everyone downloads on
  // first load.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Top accent band — a thin brand-color rule rather than a plain white
  // page, so the document reads as an official ChatSched document at a
  // glance rather than a generic text dump.
  doc.setFillColor(ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 3, "F");

  let y = 22;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text("CHATSCHED", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  y += 6;
  doc.text("Managed Advertising + Marketplace + Publisher Network", MARGIN, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.text(input.showCommissionSplit ? "PAYOUT STATEMENT" : "INVOICE", PAGE_WIDTH - MARGIN, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text(`No. ${input.invoiceNumber}`, PAGE_WIDTH - MARGIN, 28, { align: "right" });
  doc.text(input.issueDate, PAGE_WIDTH - MARGIN, 33, { align: "right" });

  y = 42;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  // Bill to / From
  y += 10;
  const colWidth = (PAGE_WIDTH - MARGIN * 2) / 2;
  [{ x: MARGIN, party: input.from }, { x: MARGIN + colWidth, party: input.billTo }].forEach(({ x, party }) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(INK_SOFT);
    doc.text(party.heading.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    let ly = y + 6;
    party.lines.forEach((line) => {
      doc.text(line, x, ly);
      ly += 5.2;
    });
  });

  // Line-items table — a fully bordered box rather than bare top/bottom
  // rules, so it reads as a distinct table rather than loose text columns.
  y += 34;
  const tableTop = y;
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  doc.setFillColor(TABLE_HEADER_BG, TABLE_HEADER_BG - 5, TABLE_HEADER_BG - 18);
  doc.rect(MARGIN, y, tableWidth, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK);
  doc.text("DESCRIPTION", MARGIN + 3, y + 6);
  doc.text("CHANNEL", MARGIN + 105, y + 6);
  doc.text("AMOUNT", PAGE_WIDTH - MARGIN - 3, y + 6, { align: "right" });

  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  const descLines = doc.splitTextToSize(input.description, 80);
  doc.text(descLines, MARGIN + 3, y);
  doc.text(input.channelLabel, MARGIN + 105, y);
  doc.text(rand(input.grossAmount), PAGE_WIDTH - MARGIN - 3, y, { align: "right" });

  const rowBottom = y + Math.max(descLines.length * 5, 10) + 4;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, tableTop, tableWidth, rowBottom - tableTop); // full border around header + row

  y = rowBottom + 12;

  // Totals — boxed and right-aligned, the way a bank or accounting
  // statement presents a final figure rather than a plain text line.
  const totalsBoxWidth = 65;
  const totalsBoxX = PAGE_WIDTH - MARGIN - totalsBoxWidth;
  let totalsY = y;

  if (input.showCommissionSplit) {
    const commission = input.grossAmount * PLATFORM_COMMISSION_RATE;
    const net = input.grossAmount - commission;
    const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK_SOFT);
    doc.text("Campaign value", totalsBoxX, totalsY);
    doc.text(rand(input.grossAmount), PAGE_WIDTH - MARGIN, totalsY, { align: "right" });
    totalsY += 6.5;
    doc.text(`Platform commission (${commissionPct}%)`, totalsBoxX, totalsY);
    doc.text(`-${rand(commission)}`, PAGE_WIDTH - MARGIN, totalsY, { align: "right" });
    totalsY += 5;
    doc.setDrawColor(INK);
    doc.setLineWidth(0.4);
    doc.line(totalsBoxX, totalsY, PAGE_WIDTH - MARGIN, totalsY);
    totalsY += 8;
    doc.setFillColor(GREEN);
    doc.rect(totalsBoxX - 4, totalsY - 6, totalsBoxWidth + 4, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor("#FFFFFF");
    doc.text("Your payout", totalsBoxX, totalsY + 1.5);
    doc.text(rand(net), PAGE_WIDTH - MARGIN, totalsY + 1.5, { align: "right" });
    totalsY += 12;
  } else {
    doc.setFillColor(INK);
    doc.rect(totalsBoxX - 4, totalsY - 6, totalsBoxWidth + 4, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor("#FFFFFF");
    doc.text("Total paid", totalsBoxX, totalsY + 1.5);
    doc.text(rand(input.grossAmount), PAGE_WIDTH - MARGIN, totalsY + 1.5, { align: "right" });
    totalsY += 12;
  }

  y = totalsY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_SOFT);
  doc.text("STATUS", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(GREEN);
  doc.text(input.statusLabel, MARGIN, y + 5.5);

  // Footer
  const footerY = PAGE_HEIGHT - 22;
  doc.setDrawColor(RULE_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 12, PAGE_WIDTH - MARGIN, footerY - 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_SOFT);
  doc.text("Thank you for doing business through ChatSched.", MARGIN, footerY - 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`ChatSched · ${CONTACT_ADDRESS_LINES.join(", ")}`, MARGIN, footerY);
  doc.text(CONTACT_EMAIL, MARGIN, footerY + 4.5);
  doc.text("This is a system-generated document and is valid without a signature.", PAGE_WIDTH - MARGIN, footerY, { align: "right" });

  // Bottom accent band, mirroring the top one, so the brand mark bookends
  // the page rather than only appearing once at the very top.
  doc.setFillColor(ACCENT);
  doc.rect(0, PAGE_HEIGHT - 3, PAGE_WIDTH, 3, "F");

  doc.save(`${input.fileName}.pdf`);
}
