import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ComparisonProvider } from "../contexts/ComparisonContext";
import { makePublisher } from "../test/fixtures";

const publishers = [
  makePublisher({ id: "w1", name: "News Site", channel_slug: "website", engagement: 0, channel_metadata: { monthlyUniqueVisitors: 20000 } }),
  makePublisher({ id: "w2", name: "Deals Site", channel_slug: "website", engagement: 0, channel_metadata: { monthlyUniqueVisitors: 8000 } }),
  makePublisher({ id: "r1", name: "Corner Grill", channel_slug: "restaurants", engagement: 0, followers: 1, channel_metadata: { estimatedDailyCovers: 120 } }),
  makePublisher({ id: "s1", name: "Insta Page", channel_slug: "social-media" }),
  makePublisher({ id: "s2", name: "TikTok Page", channel_slug: "social-media" }),
];

vi.mock("../hooks/usePublishers", () => ({ usePublishers: () => ({ publishers, loading: false, error: null }) }));

import ComparePublishers from "./ComparePublishers";

function renderPage(ids: string[], channel?: string) {
  localStorage.setItem("mb_comparison", JSON.stringify(ids));
  if (channel) localStorage.setItem("mb_comparison_channel", channel);
  return render(
    <MemoryRouter>
      <ComparisonProvider><ComparePublishers /></ComparisonProvider>
    </MemoryRouter>,
  );
}

describe("ComparePublishers", () => {
  beforeEach(() => localStorage.clear());

  it("leaves out listings from another channel and says so", () => {
    renderPage(["w1", "w2", "r1"]);
    expect(screen.getAllByText("News Site").length).toBeGreaterThan(0);
    expect(screen.getByTestId("compare-left-out")).toHaveTextContent("Corner Grill");
    expect(screen.queryByTestId("compare-left-out")).not.toHaveTextContent("News Site");
  });

  it("shows no left-out notice for a single-channel comparison", () => {
    renderPage(["w1", "w2"], "website");
    expect(screen.queryByTestId("compare-left-out")).not.toBeInTheDocument();
  });

  it("hides reach and engagement rows unless the channel is social media or influencer", () => {
    const { unmount } = renderPage(["w1", "w2"], "website");
    expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly reach")).not.toBeInTheDocument();
    unmount();
    renderPage(["s1", "s2"], "social-media");
    expect(screen.getByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("Monthly reach")).toBeInTheDocument();
  });
});
