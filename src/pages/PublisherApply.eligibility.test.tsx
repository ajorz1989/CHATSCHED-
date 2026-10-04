import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublisherApply from "./PublisherApply";
import { AUTHORITY_CHANNELS, isAuthorityChannel } from "../lib/channelOnboardingSchemas";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "u1@example.com" },
    profile: { full_name: "Test User", phone: null },
  }),
}));

function renderApply(channel: string, props: { adminMode?: boolean; startStep?: "eligibility" | "details" | "social" } = {}) {
  return render(
    <MemoryRouter initialEntries={[`/apply?channel=${channel}`]}>
      <PublisherApply forcedChannel={channel as never} {...props} />
    </MemoryRouter>,
  );
}

describe("authority channels", () => {
  it("lists exactly the eight authority channels", () => {
    expect([...AUTHORITY_CHANNELS].sort()).toEqual(
      ["associations", "community", "events", "in-venue-screens", "informal-retail", "restaurants", "sports", "transport"],
    );
    expect(isAuthorityChannel("website")).toBe(false);
    expect(isAuthorityChannel("radio")).toBe(false);
    expect(isAuthorityChannel("social-media")).toBe(false);
    expect(isAuthorityChannel(null)).toBe(false);
  });
});

describe("PublisherApply eligibility step", () => {
  it.each(["sports", "events", "community", "associations", "restaurants", "in-venue-screens"])(
    "%s asks for an ownership confirmation, not a number",
    (channel) => {
      renderApply(channel, { adminMode: true, startStep: "eligibility" });
      expect(screen.getByRole("checkbox", { name: /own or run this/i })).toBeInTheDocument();
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["website", /monthly unique visitors/i],
    ["podcast", /downloads per episode/i],
    ["radio", /weekly listener reach/i],
    ["influencer", /follower count/i],
    ["social-media", /follower count/i],
  ])("%s keeps its real number box", (channel, label) => {
    renderApply(channel, { adminMode: true, startStep: "eligibility" });
    expect(screen.getByRole("spinbutton", { name: label })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /own or run this/i })).not.toBeInTheDocument();
  });
});

describe("PublisherApply admin details step", () => {
  it("does not ask authority channels for a follower-style metric", () => {
    renderApply("community", { adminMode: true, startStep: "details" });
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});

describe("PublisherApply engagement and reach fields", () => {
  it.each(["website", "podcast", "radio", "events", "community", "restaurants", "sports"])(
    "%s is not asked for engagement or monthly reach",
    (channel) => {
      renderApply(channel, { adminMode: true, startStep: "social" });
      expect(screen.queryByText(/avg\. engagement %/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/avg\. monthly reach/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/engagement rate/i)).not.toBeInTheDocument();
    },
  );

  it("social media is asked for both", () => {
    renderApply("social-media", { adminMode: true, startStep: "social" });
    expect(screen.getByText(/avg\. engagement %/i)).toBeInTheDocument();
    expect(screen.getByText(/avg\. monthly reach/i)).toBeInTheDocument();
  });

  it("influencer is asked for engagement exactly once", () => {
    renderApply("influencer", { adminMode: true, startStep: "social" });
    expect(screen.getAllByText(/engagement/i, { selector: "label" })).toHaveLength(1);
    expect(screen.getByText(/avg\. monthly reach/i)).toBeInTheDocument();
  });
});
