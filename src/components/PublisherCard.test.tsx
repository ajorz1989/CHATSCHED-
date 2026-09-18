import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublisherCard from "./PublisherCard";
import { AuthProvider } from "../contexts/AuthContext";
import { ComparisonProvider } from "../contexts/ComparisonContext";
import { SavedListsProvider } from "../contexts/SavedListsContext";
import { makePublisher } from "../test/fixtures";

function renderCard(publisher: ReturnType<typeof makePublisher>) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ComparisonProvider>
          <SavedListsProvider>
            <PublisherCard publisher={publisher} />
          </SavedListsProvider>
        </ComparisonProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("PublisherCard", () => {
  it("renders the publisher's name and price", () => {
    renderCard(makePublisher({ name: "Bean & Bay Coffee Club", price_per_post: 120 }));
    expect(screen.getByText("Bean & Bay Coffee Club")).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it("shows the Featured badge for a currently-featured publisher", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    renderCard(makePublisher({ featured: true, featured_until: future }));
    expect(screen.getByText(/Featured/)).toBeInTheDocument();
  });

  it("does not show the Featured badge once featured_until has passed", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    renderCard(makePublisher({ featured: true, featured_until: past }));
    expect(screen.queryByText(/Featured/)).not.toBeInTheDocument();
  });

  it("does not show the Featured badge for a non-featured publisher", () => {
    renderCard(makePublisher({ featured: false }));
    expect(screen.queryByText(/Featured/)).not.toBeInTheDocument();
  });
});
