import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  beforeEach(() => {
    mockUsePublishers.mockReset();
    window.location.hash = "";
  });

  it("names all three branches, with no live-inventory tag line", () => {
    mockUsePublishers.mockReturnValue({ loading: false, publishers: [makePublisher({ channel_slug: first })] });
    renderWall();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/Buy local attention\./);
    expect(h1).toHaveTextContent(/Or get paid for yours\./);
    const tabs = screen.getByRole("tablist");
    expect(within(tabs).getAllByRole("tab")).toHaveLength(3);
    expect(within(tabs).getByRole("tab", { name: /Marketplace/i })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: /Agency/i })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /Publisher network/i })).toBeInTheDocument();
    expect(screen.queryByText(/live marketplace inventory/i)).not.toBeInTheDocument();
  });

  it("opens on the marketplace with real listings and filters by channel", () => {
    mockUsePublishers.mockReturnValue({
      loading: false,
      publishers: [
        makePublisher({ id: "a", name: "Alpha Listing", channel_slug: first }),
        makePublisher({ id: "b", name: "Beta Listing", channel_slug: second }),
      ],
    });
    renderWall();
    expect(screen.getByText("Alpha Listing")).toBeInTheDocument();
    expect(screen.getByText("Beta Listing")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /Filter inventory by channel/i });
    const channelButtons = Array.from(group.querySelectorAll("button")).slice(1);
    fireEvent.click(channelButtons[0]);
    expect(["Alpha Listing", "Beta Listing"].filter((n) => screen.queryByText(n))).toHaveLength(1);
  });

  it("switches to the agency and publisher network branches", () => {
    mockUsePublishers.mockReturnValue({ loading: false, publishers: [makePublisher({ id: "a", name: "Alpha Listing", channel_slug: first })] });
    renderWall();

    fireEvent.click(screen.getByRole("tab", { name: /Agency/i }));
    expect(screen.getByRole("link", { name: /Build my campaign/i })).toHaveAttribute("href", "/build-my-campaign");
    expect(screen.queryByText("Alpha Listing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Publisher network/i }));
    expect(screen.getByRole("link", { name: /Join as a publisher/i })).toHaveAttribute("href", "/register?role=publisher");
    expect(screen.getByText("Alpha Listing")).toBeInTheDocument();
  });

  it("supports arrow-key navigation between branches", () => {
    mockUsePublishers.mockReturnValue({ loading: false, publishers: [] });
    renderWall();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Marketplace/i }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Agency/i })).toHaveAttribute("aria-selected", "true");
  });

  it("never invents numbers when there is no inventory", () => {
    mockUsePublishers.mockReturnValue({ loading: false, publishers: [] });
    renderWall();
    expect(screen.queryByText(/^\d+ live listings$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ verified publishers$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Listings are on the way/i)).toBeInTheDocument();
  });
});
