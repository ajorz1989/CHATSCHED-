import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PodcastVerificationPanel from "./PodcastVerificationPanel";
import { makePublisher } from "../test/fixtures";

const invoke = vi.fn();
const rpc = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

const show = (patch = {}) =>
  makePublisher({ channel_slug: "podcast", channel_metadata: { showUrl: "https://feeds.example.co.za/show.xml" }, ...patch });

beforeEach(() => {
  invoke.mockReset();
  rpc.mockReset();
});

describe("PodcastVerificationPanel", () => {
  it("asks for an RSS feed address when the listing has none", () => {
    render(<PodcastVerificationPanel publisher={show({ channel_metadata: {} })} onChange={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't have an rss feed address/i);
    expect(screen.getByRole("button", { name: /get my code/i })).toBeDisabled();
  });

  it("offers a code first and shows the line to paste once there is one", () => {
    const { rerender } = render(<PodcastVerificationPanel publisher={show({ social_verification_code: null })} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /get my code/i })).toBeEnabled();
    expect(screen.queryByText("ChatSched verification: CS-7A3B9")).not.toBeInTheDocument();
    rerender(<PodcastVerificationPanel publisher={show({ social_verification_code: "CS-7A3B9" })} onChange={() => {}} />);
    expect(screen.getByText("ChatSched verification: CS-7A3B9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check my podcast now/i })).toBeInTheDocument();
  });

  it("says so when the podcast is already verified", () => {
    render(<PodcastVerificationPanel publisher={show({ social_verification_code: "CS-7A3B9", social_verification_confirmed: true })} onChange={() => {}} />);
    expect(screen.getByText(/podcast verified/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check my podcast now/i })).not.toBeInTheDocument();
  });

  it("explains why the check failed, in plain words", async () => {
    invoke.mockResolvedValue({ data: { verified: false, reason: "code_not_found" }, error: null });
    const onChange = vi.fn();
    render(<PodcastVerificationPanel publisher={show({ social_verification_code: "CS-7A3B9" })} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /check my podcast now/i }));
    expect(await screen.findByText(/couldn't confirm your podcast yet/i)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("verify-podcast-ownership", { body: { publisher_id: expect.any(String) } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refreshes the listing when the check succeeds", async () => {
    invoke.mockResolvedValue({ data: { verified: true }, error: null });
    const onChange = vi.fn();
    render(<PodcastVerificationPanel publisher={show({ social_verification_code: "CS-7A3B9" })} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /check my podcast now/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("shows the function's own message when the check can't run", async () => {
    invoke.mockResolvedValue({ data: { error: "Get your verification code first." }, error: null });
    render(<PodcastVerificationPanel publisher={show({ social_verification_code: "CS-7A3B9" })} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /check my podcast now/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/get your verification code first/i);
  });
});
