import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeInventoryWall from "./HomeInventoryWall";
import { AuthProvider } from "../contexts/AuthContext";
import { ComparisonProvider } from "../contexts/ComparisonContext";
import { SavedListsProvider } from "../contexts/SavedListsContext";
import { makePublisher } from "../test/fixtures";
import { getEnabledChannels } from "../lib/channelRegistry";

const mockUsePublishers = vi.fn();
vi.mock("../hooks/usePublishers", () => ({ usePublishers: () => mockUsePublishers() }));

function renderWall() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ComparisonProvider>
          <SavedListsProvider>
            <HomeInventoryWall />
          </SavedListsProvider>
        </ComparisonProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("HomeInventoryWall", () => {
  const [first, second] = getEnabledChannels().map((c) => c.definition.slug);

  beforeEach(() => mockUsePublishers.mockReset());

  it("renders the headline, real counts and listing cards", () => {
    mockUsePublishers.mockReturnValue({
      loading: false,
      publishers: [
        makePublisher({ id: "a", name: "Alpha Listing", channel_slug: first, price_per_post: 250 }),
        makePublisher({ id: "b", name: "Beta Listing", channel_slug: second, price_per_post: 900 }),
      ],
    });
    renderWall();
    expect(screen.getByRole("heading", { level: 1, name: /Browse live ad inventory/i })).toBeInTheDocument();
    expect(screen.getByText("Alpha Listing")).toBeInTheDocument();
    expect(screen.getByText("Beta Listing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all/i })).toHaveAttribute("href", "/browse");
  });

  it("filters cards in place when a channel tile is chosen", () => {
    mockUsePublishers.mockReturnValue({
      loading: false,
      publishers: [
        makePublisher({ id: "a", name: "Alpha Listing", channel_slug: first }),
        makePublisher({ id: "b", name: "Beta Listing", channel_slug: second }),
      ],
    });
    renderWall();
    const group = screen.getByRole("group", { name: /Filter inventory by channel/i });
    const tiles = group.querySelectorAll("button");
    // tiles[0] is "All"; pick the tile that holds the first channel's listing
    const target = Array.from(tiles).find((b) => b.textContent?.includes("1 live") && b !== tiles[0]);
    expect(target).toBeTruthy();
    fireEvent.click(target!);
    const visibleNames = ["Alpha Listing", "Beta Listing"].filter((n) => screen.queryByText(n));
    expect(visibleNames).toHaveLength(1);
  });

  it("hides counters and shows an empty state instead of inventing numbers", () => {
    mockUsePublishers.mockReturnValue({ loading: false, publishers: [] });
    renderWall();
    expect(screen.queryByText(/Verified listings/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Listings are on the way/i)).toBeInTheDocument();
  });
});
