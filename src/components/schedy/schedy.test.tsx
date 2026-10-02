import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SchedyLoader, SchedyNotFound, SchedyEmptyCampaigns, SchedySticker } from "./index";

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Schedy components", () => {
  it("loader animates by default and keeps the message as live text", () => {
    mockReducedMotion(false);
    const { container } = render(<SchedyLoader />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/schedy/schedy-loading-animated.svg");
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("loader shows the still image when the visitor prefers reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<SchedyLoader />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/schedy/schedy-loading-preview.png");
  });

  it("404 scene has a real h1, decorative art and renders its actions", () => {
    mockReducedMotion(false);
    const { container } = render(<SchedyNotFound title="Page not found."><a href="/">Home</a></SchedyNotFound>);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found.");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("empty-campaigns scene renders an h2 inside a page", () => {
    render(<SchedyEmptyCampaigns />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("No campaigns yet");
  });

  it("stickers are decorative", () => {
    const { container } = render(<SchedySticker name="sharp" />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});
