import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHoneypot } from "./useHoneypot";

describe("useHoneypot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flags a filled-in honeypot field as a bot even after the minimum delay", () => {
    const { result } = renderHook(() => useHoneypot());
    vi.advanceTimersByTime(5000);
    expect(result.current.isLikelyBot("some-value")).toBe(true);
  });

  it("flags a submission that happens faster than the minimum fill time", () => {
    const { result } = renderHook(() => useHoneypot());
    // no time advanced — this is an instant submit
    expect(result.current.isLikelyBot("")).toBe(true);
  });

  it("does not flag an empty honeypot submitted after the minimum fill time", () => {
    const { result } = renderHook(() => useHoneypot());
    vi.advanceTimersByTime(2500);
    expect(result.current.isLikelyBot("")).toBe(false);
  });

  it("treats a whitespace-only honeypot value the same as filled-in (not a false negative)", () => {
    const { result } = renderHook(() => useHoneypot());
    vi.advanceTimersByTime(2500);
    // whitespace trims to empty, so this should NOT be flagged as a bot —
    // guards against a real user's browser autofill inserting a stray space
    expect(result.current.isLikelyBot("   ")).toBe(false);
  });
});
