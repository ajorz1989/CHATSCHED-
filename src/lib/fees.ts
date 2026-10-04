import { PLATFORM_COMMISSION_RATE } from "./constants";

/**
 * Single source of truth for what a booking costs and who gets what.
 *
 * Model (decided Oct 2026):
 *  - Commission: 12% of the creator's price, taken ONLY from the creator.
 *  - Booking fee: paid ONLY by the business, added on top of the creator's
 *    price. R30 when the creator's price is under R500, R50 from R500 up.
 *  - Same for marketplace bookings and managed campaigns.
 *
 * All arithmetic is in integer cents so totals can never drift by a cent
 * between the dashboard, the Payment Card PDF and admin.
 */

export const BOOKING_FEE_THRESHOLD_CENTS = 50_000; // R500
export const BOOKING_FEE_SMALL_CENTS = 3_000; // R30 (price under R500)
export const BOOKING_FEE_STANDARD_CENTS = 5_000; // R50 (price R500 and over)

// Basis points avoid float error (0.12 * 29900 is not an exact integer).
const COMMISSION_BPS = Math.round(PLATFORM_COMMISSION_RATE * 10_000);

export interface BookingBreakdown {
  creatorPriceCents: number;
  commissionRate: number;
  commissionCents: number;
  creatorPayoutCents: number;
  bookingFeeCents: number;
  totalDueCents: number;
  platformRevenueCents: number;
}

export function bookingFeeCents(creatorPriceCents: number): number {
  return creatorPriceCents < BOOKING_FEE_THRESHOLD_CENTS ? BOOKING_FEE_SMALL_CENTS : BOOKING_FEE_STANDARD_CENTS;
}

export function toCents(rand: number): number {
  return Math.round(rand * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function computeBookingBreakdown(creatorPriceCents: number): BookingBreakdown {
  if (!Number.isInteger(creatorPriceCents) || creatorPriceCents < 0) {
    throw new Error("creatorPriceCents must be a non-negative integer");
  }
  const commissionCents = Math.round((creatorPriceCents * COMMISSION_BPS) / 10_000);
  const fee = bookingFeeCents(creatorPriceCents);
  return {
    creatorPriceCents,
    commissionRate: COMMISSION_BPS / 10_000,
    commissionCents,
    creatorPayoutCents: creatorPriceCents - commissionCents,
    bookingFeeCents: fee,
    totalDueCents: creatorPriceCents + fee,
    platformRevenueCents: commissionCents + fee,
  };
}

/** Convenience for UI that holds Rand amounts. */
export function computeBookingBreakdownFromRand(creatorPriceRand: number): BookingBreakdown {
  return computeBookingBreakdown(toCents(creatorPriceRand));
}

/**
 * The breakdown for a channel request. Uses the database snapshot when it
 * exists (so rate or fee changes never rewrite history), otherwise
 * computes from the amount currently on the request.
 */
export function channelRequestBreakdown(r: {
  proposed_amount: number;
  creator_price_cents?: number | null;
  commission_rate?: number | null;
  commission_cents?: number | null;
  booking_fee_cents?: number | null;
  total_due_cents?: number | null;
  creator_payout_cents?: number | null;
}): BookingBreakdown {
  if (
    r.creator_price_cents != null && r.commission_cents != null && r.booking_fee_cents != null &&
    r.total_due_cents != null && r.creator_payout_cents != null
  ) {
    return {
      creatorPriceCents: r.creator_price_cents,
      commissionRate: r.commission_rate ?? COMMISSION_BPS / 10_000,
      commissionCents: r.commission_cents,
      creatorPayoutCents: r.creator_payout_cents,
      bookingFeeCents: r.booking_fee_cents,
      totalDueCents: r.total_due_cents,
      platformRevenueCents: r.commission_cents + r.booking_fee_cents,
    };
  }
  return computeBookingBreakdownFromRand(r.proposed_amount);
}

export const REFUND_CUTOFF_HOURS = 48;
export const FIRST_BOOKINGS_REVIEW_TARGET = 50;

/**
 * What a business gets back if it cancels a booking whose funds have cleared.
 * Mirrors public.cancel_channel_request() in schema_phase114: the creator
 * price comes back (booking fee kept) when there are at least 48 hours to
 * go-live, otherwise nothing automatic. A missing go-live date counts as safe.
 */
export function businessCancelRefundCents(
  r: Parameters<typeof channelRequestBreakdown>[0] & { scheduled_live_at?: string | null; funds_cleared_at?: string | null },
  now: Date = new Date(),
): number {
  if (!r.funds_cleared_at) return 0;
  const bd = channelRequestBreakdown(r);
  if (!r.scheduled_live_at) return bd.creatorPriceCents;
  const cutoff = new Date(r.scheduled_live_at).getTime() - REFUND_CUTOFF_HOURS * 3_600_000;
  return now.getTime() <= cutoff ? bd.creatorPriceCents : 0;
}
