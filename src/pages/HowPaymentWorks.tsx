import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
  PLATFORM_BANK_DETAILS,
} from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

interface Step {
  n: string;
  title: string;
  who: "business" | "creator" | "platform";
  body: string;
  detail?: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Business sends a request",
    who: "business",
    body: "No online checkout at this point — a business picks a publisher or creator and submits what they want featured, with a proposed budget.",
  },
  {
    n: "02",
    title: "Creator approves or declines",
    who: "creator",
    body: `The creator reviews the request in their dashboard and has ${CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline it.`,
    detail: `If it's not actioned within ${CREATOR_APPROVAL_WINDOW_DAYS} days, the request closes automatically — nobody's left waiting indefinitely.`,
  },
  {
    n: "03",
    title: "Business pays — ChatSched holds it",
    who: "business",
    body: `Once approved, the business has ${BUSINESS_PAYMENT_WINDOW_DAYS} days to pay — by card/instant EFT through PayFast, or manual EFT straight to ChatSched's bank account.`,
    detail: "Money sits with the platform at this point, not with the creator — it isn't released until the placement actually goes live.",
  },
  {
    n: "04",
    title: "Payment is confirmed",
    who: "platform",
    body: "PayFast payments confirm automatically via webhook. Manual EFT payments are matched and confirmed by the ChatSched team once the funds land.",
  },
  {
    n: "05",
    title: "Creator posts and marks it live",
    who: "creator",
    body: "The creator carries out the placement on their own schedule within the agreed window, then marks the request as live.",
  },
  {
    n: "06",
    title: "Creator gets paid out",
    who: "platform",
    body: `The creator's share is paid out within ${CREATOR_PAYOUT_WINDOW_HOURS} hours of the post going live.`,
    detail: `Creators keep ${sharePct}% of every booking. ChatSched's commission is a flat ${commissionPct}% — the same rate for every channel, every time, no tiers or hidden fees.`,
  },
];

const WHO_STYLE: Record<Step["who"], { label: string; className: string }> = {
  business: { label: "Business", className: "bg-billboard-yellow text-billboard-ink border-billboard-ink" },
  creator: { label: "Creator", className: "bg-billboard-green text-white border-billboard-greenDeep" },
  platform: { label: "ChatSched", className: "bg-billboard-ink text-white border-billboard-ink" },
};

export default function HowPaymentWorks() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="How Payment Works · ChatSched"
        description={`How money moves on ChatSched — payment held until the placement is live, a ${CREATOR_APPROVAL_WINDOW_DAYS}-day approval window, and payout within ${CREATOR_PAYOUT_WINDOW_HOURS} hours of a post going live.`}
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        How payment works
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Money doesn't move until the work does.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        Every booking on ChatSched follows the same held-payment timeline, whether it's a WhatsApp
        directory request or a channel campaign. Here's exactly what happens, in order.
      </p>

      {/* Transparent pricing */}
      <div className="border-[3px] border-billboard-ink rounded-lg p-5 mb-12 bg-white flex flex-wrap items-center gap-6">
        <div className="text-2xl shrink-0" aria-hidden="true">🔒</div>
        <p className="text-sm text-billboard-inkSoft flex-1 min-w-[220px]">
          <strong className="text-billboard-ink">Simple, transparent marketplace pricing.</strong>{" "}
          Same flat rate on every booking, every channel — no tiered pricing and nothing extra deducted at payout.
        </p>
        <Link to="/fees" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm shrink-0 hover:-translate-y-0.5 transition">See exact fees →</Link>
      </div>

      {/* Timeline */}
      <div className="relative pl-8 mb-14">
        <div className="absolute left-[13px] top-2 bottom-2 w-[3px] bg-billboard-ink/15" aria-hidden="true" />
        <div className="flex flex-col gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="absolute -left-8 top-0 w-7 h-7 rounded-full bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center font-mono text-[10px] font-bold">
                {s.n}
              </div>
              <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="font-display text-lg">{s.title}</h2>
                  <span className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded border-2 ${WHO_STYLE[s.who].className}`}>
                    {WHO_STYLE[s.who].label}
                  </span>
                </div>
                <p className="text-sm text-billboard-inkSoft">{s.body}</p>
                {s.detail && <p className="text-xs text-billboard-inkSoft mt-2 border-t border-billboard-ink/10 pt-2">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment-hold explainer */}
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5 mb-10">
        <p className="text-sm font-semibold mb-1">🔒 Why does ChatSched hold the payment?</p>
        <p className="text-sm text-billboard-inkSoft">
          Holding payment until the placement is live protects both sides — a business isn't paying for
          something that hasn't happened yet, and a creator isn't doing the work on a promise. Nobody
          fronts the risk alone.
        </p>
      </div>

      {/* Payment methods */}
      <div className="grid sm:grid-cols-2 gap-5 mb-10">
        <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
          <h3 className="font-display text-base mb-1.5">Card / Instant EFT</h3>
          <p className="text-sm text-billboard-inkSoft">Paid through PayFast — confirms automatically, no waiting on manual checks.</p>
        </div>
        <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
          <h3 className="font-display text-base mb-1.5">Manual EFT</h3>
          <p className="text-sm text-billboard-inkSoft mb-2">Pay directly into ChatSched's business account and confirmation follows once it's matched.</p>
          <p className="font-mono text-[11px] text-billboard-inkSoft leading-relaxed">
            {PLATFORM_BANK_DETAILS.bank} · {PLATFORM_BANK_DETAILS.accountType}<br />
            Acc: {PLATFORM_BANK_DETAILS.accountNumber} · Branch: {PLATFORM_BANK_DETAILS.branchCode}
          </p>
        </div>
      </div>

      <div className="text-center border-t-2 border-billboard-paperDim pt-8">
        <p className="text-billboard-inkSoft mb-4">Ready to see it in practice?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/browse" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            Browse publishers
          </Link>
          <Link to="/how-it-works" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            See the full request flow
          </Link>
        </div>
      </div>
    </div>
  );
}
