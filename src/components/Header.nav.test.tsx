import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { AuthProvider } from "../contexts/AuthContext";
import { ComparisonProvider } from "../contexts/ComparisonContext";

describe("Header primary links", () => {
  beforeAll(() => {
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false, onchange: null }),
      });
    }
  });
  it("shows For Businesses (not Pricing) in the main navigation", () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ComparisonProvider>
            <Header />
          </ComparisonProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    const nav = screen.getAllByRole("navigation")[0];
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/for-businesses");
    expect(hrefs).not.toContain("/pricing");
    expect(screen.getAllByText("For Businesses").length).toBeGreaterThan(0);
  });
});
