/**
 * Shared currency formatting. Built because `n.toLocaleString(...)` for
 * Rand amounts was independently reimplemented across the codebase and
 * had genuinely drifted — 8 files passed the locale explicitly
 * (`"en-ZA"`), 3 passed `undefined` (whichever locale the visitor's own
 * browser reports), confirmed by `grep -rl` against this actual
 * codebase, not assumed from an earlier account of a different upload.
 * `undefined` isn't a hypothetical bug: a visitor with a German or French
 * browser locale sees `R 12.500,00`-style grouping instead of
 * `R12,500.00`, on the exact same platform, depending only on which of
 * these `undefined`-locale call sites they happened to land on.
 *
 * `"en-ZA"` explicitly, always — South African grouping/decimal
 * convention regardless of the visitor's own browser settings, since
 * this is a South African marketplace showing Rand amounts to South
 * African businesses and publishers, not a currency that should follow
 * whichever locale a browser happens to report.
 */

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ZAR_FORMATTER_DECIMALS = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a Rand amount using South African convention: a space as the
 * thousands separator and a comma as the decimal separator (real
 * `Intl.NumberFormat("en-ZA", ...)` output, checked directly rather than
 * assumed — it's "R 12 500", not the US-style "R12,500" this file's own
 * first draft assumed before actually running the formatter). No-cents
 * ("R 12 500") is the default, since most amounts on this platform are
 * round-Rand campaign budgets/rate-card prices, not transaction-level
 * cent amounts — pass `cents: true` explicitly for the few places that
 * actually show a precise payment/payout figure ("R 1 234,50").
 */
export function formatCurrency(amount: number, opts: { cents?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return "R—";
  return (opts.cents ? ZAR_FORMATTER_DECIMALS : ZAR_FORMATTER).format(amount);
}

/**
 * "R 500–R 1 000". Equal min/max collapses to a single amount rather
 * than "R 500–R 500", which is what several of the ad-hoc inline
 * versions this replaces did not bother to check for.
 */
export function formatCurrencyRange(min: number, max: number, opts: { cents?: boolean } = {}): string {
  if (min === max) return formatCurrency(min, opts);
  return `${formatCurrency(min, opts)}–${formatCurrency(max, opts)}`;
}
