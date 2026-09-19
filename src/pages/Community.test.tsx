import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Community from "./Community";
import CommunityQa from "./CommunityQa";
import CommunityEvents from "./CommunityEvents";
import CommunityAnnouncements from "./CommunityAnnouncements";

describe("Community pages", () => {
  it("renders green hero and bottom CTA linking to Q&A", () => {
    const { container } = render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>
    );
    expect(container.querySelector("section.bg-billboard-green")).toBeTruthy();
    expect(container.querySelector("section.bg-billboard-red")).toBeNull();
    expect(screen.getByRole("heading", { name: /still have a question/i })).toBeTruthy();
    const cta = screen.getByRole("link", { name: /ask a question in the q&a/i });
    expect(cta.getAttribute("href")).toBe("/community/qa?ask=1");
  });

  it("opens the ask form when arriving with ?ask=1", () => {
    render(
      <MemoryRouter initialEntries={["/community/qa?ask=1"]}>
        <CommunityQa />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/your question/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^close$/i })).toBeTruthy();
  });

  it("keeps the ask form collapsed on a plain visit", () => {
    render(
      <MemoryRouter initialEntries={["/community/qa"]}>
        <CommunityQa />
      </MemoryRouter>
    );
    expect(screen.queryByLabelText(/your question/i)).toBeNull();
    expect(screen.getByRole("button", { name: /ask a question/i })).toBeTruthy();
  });

  it("renders Q&A, events and announcements without crashing", () => {
    const cases = [
      { ui: <CommunityQa />, path: "/community/qa?category=publisher", heading: /Q&A/i },
      { ui: <CommunityEvents />, path: "/community/events", heading: /Events/i },
      { ui: <CommunityAnnouncements />, path: "/community/announcements", heading: /Announcements/i },
    ];
    for (const c of cases) {
      const { unmount } = render(<MemoryRouter initialEntries={[c.path]}>{c.ui}</MemoryRouter>);
      expect(screen.getByRole("heading", { name: c.heading })).toBeTruthy();
      unmount();
    }
  });
});