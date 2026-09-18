import { formatCurrency } from "./currency";

// Same "load jsPDF on demand, build client-side, no server round trip"
// approach as invoice.ts — see that file's header for the reasoning.
// This is a summary of the wizard's recommendation, not the legal brief
// itself (that's the notes field on the submitted agency_leads row); a
// business downloads this to keep or share internally before or after
// submitting.

const INK = "#1A1712";
const INK_SOFT = "#6B6250";
const GREEN = "#1F7A4D";
const ACCENT = "#F4C542";
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;

export interface CampaignBriefPdfInput {
  businessName: string;
  packageName: string;
  strategySummary: string;
  estimatedReach: string;
  channels: string[];
  deliverables: string[];
  matchedPublisherNames: string[];
  creatorInventoryZar: number;
  managementFeeZar: number;
  totalBudgetZar: number;
  timingSummary: string;
  locationSummary: string;
}

export async function buildAndDownloadCampaignBrief(input: CampaignBriefPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFillColor(ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 3, "F");

  let y = 22;

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
  doc.text("CAMPAIGN BRIEF", PAGE_WIDTH - MARGIN, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text(new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), PAGE_WIDTH - MARGIN, 28, { align: "right" });

  y = 42;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text("PREPARED FOR", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(input.businessName, MARGIN, y + 7);

  y += 20;
  doc.setFillColor(ACCENT);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 16, "F");
  doc.setDrawColor(INK);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(input.packageName, MARGIN + 4, y + 10);
  doc.setFontSize(9.5);
  doc.text(input.estimatedReach, PAGE_WIDTH - MARGIN - 4, y + 10, { align: "right" });

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  const strategyLines = doc.splitTextToSize(input.strategySummary, PAGE_WIDTH - MARGIN * 2);
  doc.text(strategyLines, MARGIN, y);
  y += strategyLines.length * 5 + 8;

  function sectionHeading(title: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 6;
  }

  sectionHeading("Channels & Timing");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK_SOFT);
  doc.text(`Channels: ${input.channels.join(", ")}`, MARGIN, y);
  y += 5.5;
  doc.text(`Timing: ${input.timingSummary}`, MARGIN, y);
  y += 5.5;
  doc.text(`Location: ${input.locationSummary}`, MARGIN, y);
  y += 10;

  if (input.matchedPublisherNames.length > 0) {
    sectionHeading("Matched Publishers & Creators");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK_SOFT);
    const pubLines = doc.splitTextToSize(input.matchedPublisherNames.join(" · "), PAGE_WIDTH - MARGIN * 2);
    doc.text(pubLines, MARGIN, y);
    y += pubLines.length * 5 + 6;
  }

  sectionHeading("Deliverables");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  for (const item of input.deliverables) {
    const lines = doc.splitTextToSize(`•  ${item}`, PAGE_WIDTH - MARGIN * 2 - 4);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5;
  }
  y += 8;

  // Cost breakdown, boxed like invoice.ts's totals block.
  const boxWidth = 70;
  const boxX = PAGE_WIDTH - MARGIN - boxWidth;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK_SOFT);
  doc.text("Creator media spend", boxX, y);
  doc.text(formatCurrency(input.creatorInventoryZar), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 6.5;
  doc.text("ChatSched management fee", boxX, y);
  doc.text(formatCurrency(input.managementFeeZar), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 5;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.4);
  doc.line(boxX, y, PAGE_WIDTH - MARGIN, y);
  y += 8;
  doc.setFillColor(GREEN);
  doc.rect(boxX - 4, y - 6, boxWidth + 4, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#FFFFFF");
  doc.text("Total investment", boxX, y + 1.5);
  doc.text(formatCurrency(input.totalBudgetZar), PAGE_WIDTH - MARGIN, y + 1.5, { align: "right" });

  const footerY = PAGE_HEIGHT - 22;
  doc.setDrawColor("#DCD5C3");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 8, PAGE_WIDTH - MARGIN, footerY - 8);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text("This is a planning estimate, not a final invoice — a ChatSched campaign manager confirms exact pricing before anything is charged.", MARGIN, footerY - 1, { maxWidth: PAGE_WIDTH - MARGIN * 2 });

  doc.setFillColor(ACCENT);
  doc.rect(0, PAGE_HEIGHT - 3, PAGE_WIDTH, 3, "F");

  const safeName = input.businessName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "campaign";
  doc.save(`chatsched-campaign-brief-${safeName}.pdf`);
}
