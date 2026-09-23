import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublisherApply from "./PublisherApply";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-user", email: "admin@example.com" },
    profile: { full_name: "ChatSched Admin", phone: null },
  }),
}));

describe("PublisherApply admin mode", () => {
  it("opens on editable profile fields and accepts typed input", () => {
    render(
      <MemoryRouter>
        <PublisherApply
          adminMode
          forcedChannel="social-media"
          startStep="details"
        />
      </MemoryRouter>,
    );

    const name = screen.getByRole("textbox", { name: /Page\/account name/i });
    const metric = screen.getByRole("spinbutton", { name: /follower/i });

    expect(name).not.toBeDisabled();
    expect(metric).not.toBeDisabled();

    fireEvent.change(name, { target: { value: "AJ Media Hub" } });
    fireEvent.change(metric, { target: { value: "12500" } });

    expect(name).toHaveValue("AJ Media Hub");
    expect(metric).toHaveValue(12500);
  });
});
