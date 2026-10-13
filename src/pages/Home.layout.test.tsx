import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Pins the two homepage layouts behind HOME_LAYOUT: exactly one H1 in either
// layout, both videos in either layout, and the section order of each.
vi.mock("../hooks/usePublishers", () => ({ usePublishers: () => ({ loading: false, publishers: [] }) }));

async function renderHome(layout: "agency" | "marketplace") {
  vi.resetModules();
  vi.doMock("../lib/constants", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/constants")>()), HOME_LAYOUT: layout }));
  if (typeof IntersectionObserver === "undefined") {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    }
    vi.stubGlobal("IntersectionObserver", IO);
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false, onchange: null }),
    });
  }
  // Providers are imported after resetModules so they share Home's fresh module registry.
  const { default: Home } = await import("./Home");
  const { AuthProvider } = await import("../contexts/AuthContext");
  const { ComparisonProvider } = await import("../contexts/ComparisonContext");
  const { SavedListsProvider } = await import("../contexts/SavedListsContext");
  return render(
    <MemoryRouter>
        <AuthProvider>
          <ComparisonProvider>
            <SavedListsProvider>
              <Home />
            </SavedListsProvider>
          </ComparisonProvider>
        </AuthProvider>
    </MemoryRouter>,
  );
}

function sectionTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("section")).map((s) => {
    const id = s.getAttribute("aria-labelledby");
    return id ?? (s.querySelector("h2")?.textContent ?? "").slice(0, 24);
  });
}

describe("Home layouts", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("agency: one H1 (the hero), pitch first, proof video second, wall demoted", async () => {
    const { container } = await renderHome("agency");
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/Local advertising,\s*done for you\./);
    const order = sectionTitles(container);
    const idx = (id: string) => order.indexOf(id);
    expect(idx("hero-top-title")).toBe(0);
    expect(idx("what-we-do-title")).toBeGreaterThan(idx("hero-top-title"));
    expect(idx("cross-branding-title")).toBeGreaterThan(idx("what-we-do-title"));
    expect(idx("inventory-wall-intro")).toBeGreaterThan(idx("cross-branding-title"));
    expect(container.querySelectorAll("video")).toHaveLength(2);
    expect(container.querySelector(".sr-only ol")).not.toBeNull();
    expect(container.textContent).toMatch(/Prefer to choose yourself\? Browse publishers\./);
    expect(document.querySelector("title")?.textContent).toMatch(/^ChatSched — Managed Advertising/);
  });

  it("marketplace: today's order, wall first with the only H1", async () => {
    const { container } = await renderHome("marketplace");
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/Buy local attention\./);
    const order = sectionTitles(container);
    expect(order[0]).toBe("inventory-wall-title");
    expect(order.indexOf("hero-top-title")).toBe(1);
    expect(order).not.toContain("what-we-do-title");
    expect(order).not.toContain("cross-branding-title");
    expect(container.querySelectorAll("video")).toHaveLength(2);
    expect(container.textContent).toMatch(/Tell us what you need\./);
  });
});
