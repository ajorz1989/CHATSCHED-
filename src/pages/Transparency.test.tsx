import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getTransparencyStats = vi.fn();
const getEnabledChannels = vi.fn();

vi.mock("../lib/transparencyStats", () => ({
  getTransparencyStats: (...a: unknown[]) => getTransparencyStats(...a),
}));

vi.mock("../lib/channelRegistry", () => ({
  getEnabledChannels: (...a: unknown[]) => getEnabledChannels(...a),
}));

vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: true }));

import Transparency from "./Transparency";

function renderPage() {
  return render(
    <MemoryRouter>
      <Transparency />
    </MemoryRouter>
  );
}

const oneChannel = [
  { definition: { slug: "social-media", name: "Social Media", tagline: "Reach people where they scroll." } },
];

describe("Transparency", () => {
  beforeEach(() => {
    getTransparencyStats.mockReset();
    getEnabledChannels.mockReset().mockReturnValue(oneChannel);
  });

  it("renders the live stats once loaded", async () => {
    getTransparencyStats.mockResolvedValue({
      total_requests: 10,
      completed_requests: 8,
      completion_rate: 80,
      responded_requests: 9,
      avg_response_hours: 12.5,
    });
    renderPage();

    expect(await screen.findByText("80%")).toBeInTheDocument();
    expect(screen.getByText("8 of 10 requests completed")).toBeInTheDocument();
    expect(screen.getByText("12.5h")).toBeInTheDocument();
  });

  it("does not hang on skeletons when the stats call rejects", async () => {
    getTransparencyStats.mockRejectedValue(new Error("network down"));
    renderPage();

    // The cards must resolve out of the loading state, and say we couldn't
    // read the figures rather than claiming a platform-wide zero.
    await waitFor(() => {
      expect(screen.getAllByText("Couldn't load right now").length).toBe(2);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("distinguishes a failed stats load from a genuine lack of data", async () => {
    getTransparencyStats.mockResolvedValue(null);
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i);
    });
    expect(screen.queryByText(/Not enough data yet/)).not.toBeInTheDocument();
  });

  it("renders a bottom CTA linking to the Trust Centre", async () => {
    getTransparencyStats.mockResolvedValue(null);
    renderPage();

    // The page already has a Trust Centre card in the governed section, so
    // target the CTA by its distinct label.
    const cta = await screen.findByRole("link", { name: /read the trust centre/i });
    expect(cta).toHaveAttribute("href", "/trust");
  });
});