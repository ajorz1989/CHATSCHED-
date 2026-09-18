import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PublisherAvatar from "./PublisherAvatar";

describe("PublisherAvatar", () => {
  it("renders the photo when a publisher has uploaded one", () => {
    render(<PublisherAvatar imageUrl="https://example.com/photo.jpg" initials="AB" name="Ada Bee" size="md" />);
    const img = screen.getByRole("img", { name: "Ada Bee" });
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(screen.queryByText("AB")).not.toBeInTheDocument();
  });

  it("falls back to initials-on-swatch when there is no photo — the pre-existing behavior every caller had before this component existed", () => {
    render(<PublisherAvatar imageUrl={null} initials="AB" name="Ada Bee" size="md" />);
    expect(screen.getByText("AB")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
