import { describe, it, expect } from "vitest";
import { formatCurrency, formatCurrencyRange } from "./currency";

// The space between "R" and the digits, and between thousands groups, is
// U+00A0 (non-breaking space) — real Intl.NumberFormat("en-ZA", ...)
// output, checked directly (Node, dumping code points) rather than
// assumed to be a regular space.
const NBSP = "\u00a0";

describe("formatCurrency", () => {
  it("formats a whole Rand amount with no cents by default", () => {
    expect(formatCurrency(12500)).toBe(`R${NBSP}12${NBSP}500`);
  });

  it("formats with cents when explicitly asked", () => {
    expect(formatCurrency(1234.5, { cents: true })).toBe(`R${NBSP}1${NBSP}234,50`);
  });

  it("returns a placeholder for a non-finite amount rather than throwing", () => {
    expect(formatCurrency(NaN)).toBe("R—");
    expect(formatCurrency(Infinity)).toBe("R—");
  });
});

describe("formatCurrencyRange", () => {
  it("formats a real range", () => {
    expect(formatCurrencyRange(500, 1000)).toBe(`R${NBSP}500–R${NBSP}1${NBSP}000`);
  });

  it("collapses to a single amount when min equals max", () => {
    expect(formatCurrencyRange(500, 500)).toBe(`R${NBSP}500`);
  });
});
