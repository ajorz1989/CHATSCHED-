import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  LockKeyhole,
  MessageSquareText,
} from "lucide-react";
import Seo from "../components/Seo";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
} from "../lib/constants";
import { getEnabledChannels } from "../lib/channelRegistry";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

const requestChannels = getEnabledChannels().filter(
  (channel) => channel.definition.bookingFlow === "request"
);

interface Step {
  n: string;
  title: string;
  body: string;
  detail?: string;
  icon: typeof MessageSquareText;
}

const SOCIAL_STEPS: Step[] = [
  {
    n: "01",
    title: "Choose a publisher and send your booking request",
    body: "Pick a social publisher, agree the placement and submit the request. You are not charged at this first step.",
    icon: MessageSquareText,
  },
  {
    n: "02",
    title: "The booking is confirmed",
    body: "Once the booking is accepted and the amount is agreed, your dashboard shows the payment options for that booking.",
    icon: CheckCircle2,
  },
  {
    n: "03",
    title: "Pay by PayFast or EFT",
    body: "Use PayFast for card or Instant EFT, or choose manual EFT when that option is shown. PayFast can confirm automatically; manual EFT is confirmed by the ChatSched team after the funds arrive.",
    detail: "Your EFT banking instructions are shown only at the actual payment step, together with the correct amount and payment reference — they are intentionally not published on this information page.",
    icon: CreditCard,
  },
  {
    n: "04",
    title: "The placement runs",
    body: "After payment clears, the publisher carries out the agreed placement and marks the campaign live in ChatSched.",
    icon: CheckCircle2,
  },
  {
    n: "05",
    title: "The publisher is paid",
    body: `The publisher receives their share after the booking is completed and the payment has cleared. ChatSched's marketplace fee is ${commissionPct}% and the publisher share is ${sharePct}%.`,
    icon: Banknote,
  },
];

const REQUEST_STEPS: Step[] = [
  {
    n: "01",
    title: "Submit a channel request",
    body: "For channels such as influencer, podcast, website and radio, you send a booking request with your brief, preferred advertising method and proposed budget.",
    icon: MessageSquareText,
  },
  {
    n: "02",
    title: "The publisher reviews the request",
    body: `The publisher has ${CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline the request. A counter-offer can also be agreed when supported by the booking.`,
    detail: "No payment is required before the publisher accepts the request and the final amount is agreed.",
    icon: Clock3,
  },
  {
    n: "03",
    title: "Pay ChatSched by manual EFT",
    body: `After approval, the business has ${BUSINESS_PAYMENT_WINDOW_DAYS} days to make the payment. The bank details, amount and unique reference are shown in the booking's payment step and dashboard — not on this public page.`,
    icon: Building2,
  },
  {
    n: "04",
    title: "ChatSched verifies the payment",
    body: "You confirm that the transfer was made, then the ChatSched team checks that the funds have actually arrived before the booking can move forward.",
    icon: CheckCircle2,
  },
  {
    n: "05",
    title: "The publisher delivers the placement",
    body: "The agreed placement is delivered and marked live. For physical, broadcast or event-based placements, delivery may require manual proof such as screenshots, photos, dates or campaign evidence.",
    icon: FileText,
  },
  {
    n: "06",
    title: "Publisher payout is processed",
    body: `The request-based flow targets publisher payout within ${CREATOR_PAYOUT_WINDOW_HOURS} hours of the placement going live, subject to the booking reaching its payout conditions.`,
    icon: Banknote,
  },
];

function PaymentStepList({ steps }: { steps: Step[] }) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-[13px] top-2 bottom-2 w-[3px] bg-billboard-ink/10" aria-hidden="true" />
      <div className="flex flex-col gap-5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.n} className="relative">
              <div className="absolute -left-8 top-0 w-7 h-7 rounded-full bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center font-mono text-[10px] font-bold">
                {step.n}
              </div>
              <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white shadow-blockSm">
                <div className="flex items-start gap-3 mb-2">
                  <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-8 h-8 rounded border-2 border-billboard-ink bg-billboard-paperDim">
                    <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg leading-tight">{step.title}</h3>
                    <p className="text-sm text-billboard-inkSoft mt-1.5 leading-relaxed">{step.body}</p>
                  </div>
                </div>
                {step.detail && (
                  <p className="text-xs text-billboard-inkSoft mt-3 ml-11 border-t border-billboard-ink/10 pt-3">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelFlowCard({
  title,
  eyebrow,
  description,
  items,
  accent,
}: {
  title: string;
  eyebrow: string;
  description: string;
  items: string[];
  accent: "yellow" | "green";
}) {
  const accentClass = accent === "yellow"
    ? "border-billboard-yellow bg-billboard-yellow/10"
    : "border-billboard-green bg-billboard-green/10";

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
      <div className={`p-5 border-b-[3px] ${accentClass}`}>
        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-billboard-inkSoft mb-1">{eyebrow}</div>
        <h2 className="font-display text-xl">{title}</h2>
        <p className="text-sm text-billboard-inkSoft mt-2 leading-relaxed">{description}</p>
      </div>
      <div className="p-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-billboard-greenDeep" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HowPaymentWorks() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo
        title="How Payment Works | ChatSched"
        description="See how ChatSched payments work across social media, influencer, podcast, website, radio and other advertising channels, including PayFast, manual EFT, payment confirmation and publisher payouts."
      />

      <header className="max-w-3xl mb-12">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
          How payment works
        </span>
        <h1 className="text-3xl md:text-5xl mb-4 max-w-3xl">The payment method depends on the channel.</h1>
        <p className="text-billboard-inkSoft text-lg max-w-2xl leading-relaxed">
          ChatSched does not force every advertising channel into the same checkout. Social media uses the original marketplace flow, while request-based channels use a reviewed booking process before payment. Managed campaigns are handled separately by a campaign manager.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-5 mb-14">
        <ChannelFlowCard
          eyebrow="Self-serve marketplace"
          title="Social media posts"
          description="This is the original ChatSched directory flow for Facebook, Instagram, TikTok and WhatsApp-channel publishers."
          accent="yellow"
          items={[
            "Request the publisher first — no charge just for sending the request.",
            "Once confirmed, pay by PayFast (card or Instant EFT) or manual EFT when the option is available.",
            "PayFast payments can confirm automatically; manual EFT is checked by ChatSched.",
            "Your payment instructions and reference are shown inside the authenticated booking/payment step.",
          ]}
        />
        <ChannelFlowCard
          eyebrow="Request-based channels"
          title="Influencer, podcast, website, radio & other channels"
          description="These channels use a request-and-approval workflow because placements, deliverables and pricing can vary by publisher."
          accent="green"
          items={[
            "Choose the advertising method and submit a brief with your proposed budget.",
            `The publisher normally has ${CREATOR_APPROVAL_WINDOW_DAYS} days to respond; payment starts only after approval and price agreement.`,
            "Payment is made to ChatSched by manual EFT and then verified by the team.",
            "The placement can only move into its live stage after payment is confirmed.",
          ]}
        />
      </section>

      <section className="mb-14">
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded border-[3px] border-billboard-ink bg-billboard-paperDim shrink-0">
            <CreditCard size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Payment methods, in plain English</h2>
            <p className="text-sm text-billboard-inkSoft mt-1.5 max-w-2xl">You only see the payment option that applies to your booking. No public banking details are displayed here.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
            <CreditCard size={19} className="mb-3" aria-hidden="true" />
            <h3 className="font-display text-lg mb-1.5">PayFast</h3>
            <p className="text-sm text-billboard-inkSoft leading-relaxed">Used for the social-directory payment flow and selected ChatSched products. Where offered, PayFast supports card and Instant EFT and can confirm the transaction automatically.</p>
          </div>
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
            <Building2 size={19} className="mb-3" aria-hidden="true" />
            <h3 className="font-display text-lg mb-1.5">Manual EFT</h3>
            <p className="text-sm text-billboard-inkSoft leading-relaxed">Used for request-based channel bookings and managed campaign payments. The exact bank instructions, amount and reference appear inside the payment step or invoice.</p>
          </div>
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
            <FileText size={19} className="mb-3" aria-hidden="true" />
            <h3 className="font-display text-lg mb-1.5">Invoice / managed campaign</h3>
            <p className="text-sm text-billboard-inkSoft leading-relaxed">For done-for-you campaigns, a ChatSched campaign manager finalises the schedule and payment amount, then provides the invoice and payment instructions.</p>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
          <div className="p-5 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
            <div className="flex items-center gap-2 mb-1">
              <LockKeyhole size={18} strokeWidth={2.5} aria-hidden="true" />
              <h2 className="font-display text-xl">What happens to the money?</h2>
            </div>
            <p className="text-sm text-billboard-inkSoft max-w-2xl">ChatSched is the payment checkpoint between the business and the publisher. Payment is not sent straight to the publisher before the booking reaches its required payment and delivery stage.</p>
          </div>
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x-2 divide-billboard-ink/10">
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">1 · Pay</div>
              <p className="text-sm font-semibold">Business pays the platform using the method shown for the booking.</p>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">2 · Verify</div>
              <p className="text-sm font-semibold">Automatic confirmation handles PayFast; manual EFT is checked by ChatSched.</p>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">3 · Deliver & pay out</div>
              <p className="text-sm font-semibold">The placement goes live, then the publisher payout follows the rules for that booking flow.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-2xl mb-2">How request-based channels work</h2>
        <p className="text-sm text-billboard-inkSoft max-w-2xl mb-5">
          These channels do not use the social-media one-click checkout. They need a little more coordination because an ad can be a content deliverable, an audio placement, a website slot, a broadcast spot or another negotiated media asset.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {requestChannels.map((channel) => {
            const methods = (channel.definition.advertisingMethods ?? []).slice(0, 3).map((method) => method.label);
            return (
              <div key={channel.definition.slug} className="border-2 border-billboard-ink/20 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm">{channel.definition.name}</h3>
                    <p className="text-xs text-billboard-inkSoft mt-1.5 leading-relaxed">Request → publisher approval → manual EFT → payment verification → delivery.</p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wider border border-billboard-ink/30 rounded px-2 py-1 text-billboard-inkSoft shrink-0">Request flow</span>
                </div>
                {methods.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {methods.map((method) => (
                      <span key={method} className="text-[11px] border border-billboard-ink/15 bg-billboard-paperDim rounded px-2 py-1">{method}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-14">
        <div className="flex items-start gap-3 mb-6">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded border-[3px] border-billboard-ink bg-billboard-paperDim shrink-0">
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Detailed timelines</h2>
            <p className="text-sm text-billboard-inkSoft mt-1.5">The steps below show exactly where payment enters each booking flow.</p>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
          <div>
            <div className="inline-flex items-center gap-2 border-2 border-billboard-yellow bg-billboard-yellow/10 text-billboard-ink px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-semibold mb-4">
              Social media
            </div>
            <PaymentStepList steps={SOCIAL_STEPS} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 border-2 border-billboard-green bg-billboard-green/10 text-billboard-greenDeep px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-semibold mb-4">
              Request-based channels
            </div>
            <PaymentStepList steps={REQUEST_STEPS} />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded-lg p-5">
          <h2 className="font-display text-lg mb-2">Why the payment step is inside the booking</h2>
          <p className="text-sm text-billboard-inkSoft leading-relaxed">
            Your payment amount and reference belong to a specific booking, not to the general information page. Keeping those instructions inside the authenticated payment step reduces mistakes, keeps private banking information off the public site, and makes it easier for ChatSched to match the right payment to the right campaign.
          </p>
        </div>
      </section>

      <section className="text-center border-t-2 border-billboard-paperDim pt-8">
        <p className="text-billboard-inkSoft mb-4">Want to see pricing or start a booking?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/fees" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            See fees →
          </Link>
          <Link to="/browse" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            Browse publishers <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/build-my-campaign" className="inline-flex items-center gap-2 bg-billboard-green text-white border-[3px] border-billboard-greenDeep font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            Build a campaign <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
