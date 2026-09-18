/**
 * Deno-side counterpart to src/lib/currency.ts. Edge functions run in a
 * separate Deno runtime that isn't bundled with the Vite app, so they
 * can't import that file directly (see
 * scripts/check-currency-formatting.mjs, which is what actually enforces
 * that every Rand amount shown to a person — in either runtime — goes
 * through one of these two formatters rather than an ad-hoc
 * `R${amount}` or a fresh `Intl.NumberFormat` call). Deno's Intl support
 * is the same ICU-backed implementation as a browser's, so this produces
 * byte-identical output to formatCurrency() for the same input — if you
 * change one, change the other, and check both still agree on a few
 * sample amounts.
 */

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "R 12 500" — see src/lib/currency.ts's formatCurrency() for the full rationale. */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "R—";
  return ZAR_FORMATTER.format(amount);
}
