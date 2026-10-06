import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ComparisonProvider, useComparison, comparisonChannelOf } from "./ComparisonContext";

const wrapper = ({ children }: { children: ReactNode }) => <ComparisonProvider>{children}</ComparisonProvider>;

describe("ComparisonContext: one channel per comparison", () => {
  beforeEach(() => localStorage.clear());

  it("treats a listing with no channel as social media", () => {
    expect(comparisonChannelOf({ channel_slug: null })).toBe("social-media");
    expect(comparisonChannelOf({ channel_slug: "podcast" })).toBe("podcast");
  });

  it("refuses to add a listing from a different channel", () => {
    const { result } = renderHook(() => useComparison(), { wrapper });
    act(() => result.current.togglePublisher("a", "website"));
    act(() => result.current.togglePublisher("b", "podcast"));
    expect(result.current.ids).toEqual(["a"]);
    expect(result.current.channel).toBe("website");
    expect(result.current.isBlockedByChannel("podcast")).toBe(true);
    expect(result.current.isBlockedByChannel("website")).toBe(false);
    act(() => result.current.togglePublisher("c", "website"));
    expect(result.current.ids).toEqual(["a", "c"]);
  });

  it("lets a new channel start once the comparison is emptied", () => {
    const { result } = renderHook(() => useComparison(), { wrapper });
    act(() => result.current.togglePublisher("a", "website"));
    act(() => result.current.removePublisher("a"));
    expect(result.current.isBlockedByChannel("podcast")).toBe(false);
    act(() => result.current.togglePublisher("b", "podcast"));
    expect(result.current.ids).toEqual(["b"]);
    expect(result.current.channel).toBe("podcast");
  });

  it("still removes a listing that is already in the comparison", () => {
    const { result } = renderHook(() => useComparison(), { wrapper });
    act(() => result.current.togglePublisher("a", "radio"));
    act(() => result.current.togglePublisher("a", "radio"));
    expect(result.current.ids).toEqual([]);
  });
});
