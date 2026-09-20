import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getEnabledPlatformRules = vi.fn();
const getCategoryRules = vi.fn();

vi.mock("../lib/compliance", () => ({
  getEnabledPlatformRules: (...args: unknown[]) => getEnabledPlatformRules(...args),
  getCategoryRules: (...args: unknown[]) => getCategoryRules(...args),
}));

import Compliance from "./Compliance";

function renderPage() {
  return render(
    <MemoryRouter>
      <Compliance />
    </MemoryRouter>
  );
}

describe("Compliance Centre", () => {
  beforeEach(() => {
    getEnabledPlatformRules.mockReset();
    getCategoryRules.mockReset();
  });

  it("renders platform rules, categories and the FAQ once loaded", async () => {
    getEnabledPlatformRules.mockResolvedValue([
      {
        platform: "tiktok",
        display_name: "TikTok",
        disclosure_required: true,
        required_creator_actions: ["Use the branded content toggle"],
        required_business_actions: [],
        required_proof: [],
        content_restrictions: [],
        restricted_categories: [],
        prohibited_categories: [],
        notes: null,
        last_reviewed_at: null,
      },
    ]);
    getCategoryRules.mockResolvedValue([{ category: "Retail", chatsched_status: "allowed" }]);
    renderPage();

    expect(await screen.findByText("TikTok")).toBeInTheDocument();
    expect(await screen.findByText(/Retail · Allowed/)).toBeInTheDocument();
    expect(screen.getByText(/What is sponsored content\?/)).toBeInTheDocument();
  });

  it("shows a load-failure notice instead of crashing when the rules can't be fetched", async () => {
    getEnabledPlatformRules.mockRejectedValue(new Error("network down"));
    getCategoryRules.mockRejectedValue(new Error("network down"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load the platform rules just now/i);
    });
    // Sections must say "couldn't be loaded", never imply an empty policy set.
    expect(screen.getByText(/Platform rules couldn't be loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/Advertising categories couldn't be loaded/i)).toBeInTheDocument();
  });

  it("renders a bottom CTA that opens a campaign's compliance page", async () => {
    getEnabledPlatformRules.mockResolvedValue([]);
    getCategoryRules.mockResolvedValue([]);
    renderPage();

    const cta = await screen.findByRole("link", { name: /open your campaigns/i });
    expect(cta).toHaveAttribute("href", "/dashboard");
  });
});