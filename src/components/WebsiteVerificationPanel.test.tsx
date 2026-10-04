import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WebsiteVerificationPanel from "./WebsiteVerificationPanel";
import OwnershipVerification, { hasOwnershipCheck } from "./OwnershipVerification";
import { makePublisher } from "../test/fixtures";

const invoke = vi.fn();
const rpc = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    rpc: (...a: unknown[]) => rpc(...a),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  },
}));

const site = (patch = {}) =>
  makePublisher({ channel_slug: "website", channel_metadata: { domain: "mysite.co.za" }, ...patch });

beforeEach(() => {
  invoke.mockReset();
  rpc.mockReset();
});

describe("WebsiteVerificationPanel", () => {
  it("asks for a website address when the listing has none", () => {
    render(<WebsiteVerificationPanel publisher={site({ channel_metadata: {} })} onChange={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't have a website address/i);
    expect(screen.getByRole("button", { name: /get my code/i })).toBeDisabled();
  });

  it("offers a code first and shows no snippets until there is one", () => {
    render(<WebsiteVerificationPanel publisher={site({ social_verification_code: null })} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /get my code/i })).toBeEnabled();
    expect(screen.queryByText(/meta tag/i, { selector: "p" })).not.toBeInTheDocument();
  });

  it("shows the three ways to add the code, with the real code in each", () => {
    render(<WebsiteVerificationPanel publisher={site({ social_verification_code: "CS-7A3B9" })} onChange={() => {}} />);
    expect(screen.getByText('<meta name="chatsched-verification" content="CS-7A3B9">')).toBeInTheDocument();
    expect(screen.getByText("chatsched-verification=CS-7A3B9")).toBeInTheDocument();
    expect(screen.getByText("https://mysite.co.za/.well-known/chatsched-verification.txt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check my website now/i })).toBeInTheDocument();
  });

  it("says so when the site is already verified", () => {
    render(
      <WebsiteVerificationPanel
        publisher={site({ social_verification_code: "CS-7A3B9", social_verification_confirmed: true })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/website verified/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check my website now/i })).not.toBeInTheDocument();
  });

  it("explains what was and wasn't found when the check fails", async () => {
    invoke.mockResolvedValue({
      data: {
        verified: false,
        attempts: [
          { method: "meta_tag", where: "https://mysite.co.za/", ok: false, note: "Page loaded, but the meta tag isn't there." },
          { method: "dns_txt", where: "mysite.co.za", ok: false, note: "No TXT records found." },
          { method: "well_known_file", where: "https://mysite.co.za/.well-known/x", ok: false, note: "The site answered 404." },
        ],
      },
      error: null,
    });
    const onChange = vi.fn();
    render(<WebsiteVerificationPanel publisher={site({ social_verification_code: "CS-7A3B9" })} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /check my website now/i }));
    expect(await screen.findByText(/couldn't find your code yet/i)).toBeInTheDocument();
    expect(screen.getByText(/meta tag isn't there/i)).toBeInTheDocument();
    expect(screen.getByText(/no txt records found/i)).toBeInTheDocument();
    expect(screen.getByText(/answered 404/i)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("verify-website-ownership", { body: { publisher_id: expect.any(String) } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refreshes the listing when the check succeeds", async () => {
    invoke.mockResolvedValue({ data: { verified: true, method: "meta_tag", attempts: [] }, error: null });
    const onChange = vi.fn();
    render(<WebsiteVerificationPanel publisher={site({ social_verification_code: "CS-7A3B9" })} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /check my website now/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("shows the function's own message when the check can't run", async () => {
    invoke.mockResolvedValue({ data: { error: "Get your verification code first, then add it to your site." }, error: null });
    render(<WebsiteVerificationPanel publisher={site({ social_verification_code: "CS-7A3B9" })} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /check my website now/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/get your verification code first/i);
  });
});

describe("OwnershipVerification", () => {
  it("knows which channels have an ownership check", () => {
    expect(hasOwnershipCheck("social-media")).toBe(true);
    expect(hasOwnershipCheck("influencer")).toBe(true);
    expect(hasOwnershipCheck("website")).toBe(true);
    expect(hasOwnershipCheck("podcast")).toBe(false);
    expect(hasOwnershipCheck("radio")).toBe(false);
    expect(hasOwnershipCheck(null)).toBe(false);
  });

  it("picks the website panel for websites and the bio-code panel for influencers", () => {
    const { rerender } = render(<OwnershipVerification publisher={site()} onChange={() => {}} />);
    expect(screen.getByRole("heading", { name: /verify your website/i })).toBeInTheDocument();
    rerender(<OwnershipVerification publisher={makePublisher({ channel_slug: "influencer" })} onChange={() => {}} />);
    expect(screen.getByRole("heading", { name: /verify your social account/i })).toBeInTheDocument();
  });

  it("renders nothing for a podcast", () => {
    const { container } = render(<OwnershipVerification publisher={makePublisher({ channel_slug: "podcast" })} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
