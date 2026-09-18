import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminVisualIdentity from "./AdminVisualIdentity";

// This page has four conditional rendering branches per component
// (VisualAvatar/VisualCover × current/plate/crest/storefront, each at
// three sizes) — exactly the kind of thing that typechecks and lints
// clean while still crashing at runtime on one specific combination.
// Clicking through every tab is a cheap way to actually exercise all of
// them, which is what the merge-and-check-for-bugs request asked for.
describe("AdminVisualIdentity (merged Visual Identity Studio)", () => {
  it("renders the audit section and all four direction tabs without crashing", () => {
    render(
      <MemoryRouter>
        <AdminVisualIdentity />
      </MemoryRouter>
    );
    expect(screen.getByText("How a publisher should look on ChatSched.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yellow Plate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Channel Crest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publisher Storefront" })).toBeInTheDocument();
  });

  it("switches to every direction, including current, without throwing", () => {
    render(
      <MemoryRouter>
        <AdminVisualIdentity />
      </MemoryRouter>
    );
    for (const name of ["Yellow Plate", "Channel Crest", "Publisher Storefront", "Current"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      // Sample publisher names appear more than once on the page at any
      // given time (audit section + browse grid both use them) — if a
      // rendering branch threw, every occurrence would be gone, so
      // getAllByText still catches a crash without assuming uniqueness.
      expect(screen.getAllByText("Orlando Spaza Grid").length).toBeGreaterThan(0);
    }
  });

  it("applies and resets the local preview toggle for a non-current direction", () => {
    render(
      <MemoryRouter>
        <AdminVisualIdentity />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Yellow Plate" }));
    fireEvent.click(screen.getByRole("button", { name: /Preview Yellow Plate across this page/ }));
    expect(screen.getByText(/Previewing this tab's system/)).toBeInTheDocument();
    // This exact hint only renders while system !== "current" (section 03's
    // dynamic toggle note) — distinct from section 05's similarly-worded
    // static paragraph, which is present regardless of toggle state.
    expect(screen.getByText(/stored in localStorage, not the database/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Previewing this tab's system/ }));
    expect(screen.queryByText(/stored in localStorage, not the database/)).not.toBeInTheDocument();
  });

  it("does not show the apply button on the Current tab, since there's nothing to apply", () => {
    render(
      <MemoryRouter>
        <AdminVisualIdentity />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Current" }));
    expect(screen.queryByText(/Preview Current across this page/)).not.toBeInTheDocument();
  });
});
