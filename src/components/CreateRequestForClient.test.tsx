import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateRequestForClient from "./CreateRequestForClient";
import { supabase } from "../lib/supabase";

// PHASE21_BULK_REQUEST_CREATION_DELIVERY.md's own "Not done" list named
// this queue/batch logic as untested. Covers: dedup on re-adding a
// publisher, per-row validation before either insert fires, the two
// batched inserts actually being batched (one call per table, not one
// per publisher), the exact payload shape sent to each table, and the
// partial-failure path (social batch already sent, channel batch fails)
// reporting itself honestly rather than implying atomicity that isn't
// real for a submission spanning two tables.

vi.mock("../lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

// The module above is fully mocked, so `supabase.from` really is a
// `Mock` at runtime — this just gives every test that type back instead
// of casting inline at every call site.
const mockFrom = supabase.from as unknown as Mock;

// Supabase's real query builder is thenable at every step (`await
// supabase.from(...).select().eq()` resolves without an explicit
// `.then()` call in the component code), so the fake needs to be
// awaitable from whichever method the code happens to await after.
function makeChainable(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, Mock> & { then?: unknown } = {};
  for (const method of ["select", "ilike", "eq", "limit", "insert", "order"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => void) => resolve(result);
  return chain;
}

type TableResponses = {
  publishers?: { data?: unknown[]; error?: unknown };
  requests?: { error?: unknown };
  channel_requests?: { error?: unknown };
};

function setSupabaseResponses(responses: TableResponses) {
  mockFrom.mockImplementation((table: string) => {
    const result = (responses as Record<string, { data?: unknown; error?: unknown }>)[table] ?? {
      data: [],
      error: null,
    };
    return makeChainable(result);
  });
}

const socialPublisher = {
  id: "pub-social-1",
  name: "Cape Town Foodies",
  city: "Cape Town",
  province: "Western Cape",
  channel_slug: "social-media" as const,
  accepted_ad_formats: null,
};

const influencerPublisher = {
  id: "pub-influencer-1",
  name: "Thandi Creates",
  city: "Durban",
  province: "KwaZulu-Natal",
  channel_slug: "influencer" as const,
  accepted_ad_formats: ["Unboxing / Product Review"],
};

async function searchAndAdd(user: ReturnType<typeof userEvent.setup>, name: string) {
  const searchInput = screen.getByPlaceholderText(/search publishers by name/i);
  await user.type(searchInput, name.slice(0, 3));
  // The search is debounced 300ms — give findBy more room than its
  // default 1000ms timeout so this isn't flaky on a slower runner.
  const option = await screen.findByRole("button", { name: new RegExp(name, "i") }, { timeout: 2000 });
  await user.click(option);
}

describe("CreateRequestForClient", () => {
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseResponses({
      publishers: { data: [socialPublisher, influencerPublisher], error: null },
      requests: { error: null },
      channel_requests: { error: null },
    });
  });

  function renderForm() {
    return render(
      <CreateRequestForClient businessId="biz-1" agencyCampaignId="camp-1" onCreated={onCreated} />
    );
  }

  it("does not show a submit button until at least one publisher is queued", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /create \d+ requests?/i })).not.toBeInTheDocument();
  });

  it("adds a searched publisher to the queue and shows it as a row", async () => {
    const user = userEvent.setup();
    renderForm();
    await searchAndAdd(user, socialPublisher.name);
    expect(screen.getByText(new RegExp(socialPublisher.name))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create 1 request$/i })).toBeInTheDocument();
  });

  it("marks an already-queued publisher as added and refuses to queue it twice", async () => {
    const user = userEvent.setup();
    renderForm();
    await searchAndAdd(user, socialPublisher.name);

    // Search for the same publisher again — the result should now read
    // "(added)" and the button should be disabled rather than creating a
    // second queue entry.
    const searchInput = screen.getByPlaceholderText(/search publishers by name/i);
    await user.type(searchInput, socialPublisher.name.slice(0, 3));
    const addedOption = await screen.findByRole("button", { name: /added/i }, { timeout: 2000 });
    expect(addedOption).toBeDisabled();

    await user.click(addedOption);
    expect(screen.getByRole("button", { name: /create 1 request$/i })).toBeInTheDocument();
  });

  it("blocks submit with a per-publisher error when a non-social row is missing its method or amount", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/what's the campaign/i), "Spring push");
    await searchAndAdd(user, influencerPublisher.name);

    await user.click(screen.getByRole("button", { name: /create 1 request$/i }));

    expect(
      await screen.findByText(
        new RegExp(`${influencerPublisher.name} is missing its advertising method or proposed amount`, "i")
      )
    ).toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalledWith("requests");
    expect(mockFrom).not.toHaveBeenCalledWith("channel_requests");
  });

  it("batches every queued row into one insert per table, not one per publisher", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/what's the campaign/i), "Spring push");
    await searchAndAdd(user, socialPublisher.name);
    await searchAndAdd(user, influencerPublisher.name);

    await user.selectOptions(screen.getByRole("combobox"), "Unboxing / Product Review");
    await user.type(screen.getByPlaceholderText(/amount \(r\)/i), "3000");

    await user.click(screen.getByRole("button", { name: /create 2 requests$/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    const requestsCalls = mockFrom.mock.calls.filter((c) => c[0] === "requests");
    const channelRequestsCalls = mockFrom.mock.calls.filter((c) => c[0] === "channel_requests");
    // One call to .from() per table for the whole batch — not one per
    // publisher — is the entire point of the queue-then-submit flow.
    expect(requestsCalls).toHaveLength(1);
    expect(channelRequestsCalls).toHaveLength(1);

    // Queue clears and the message resets once the whole batch lands.
    expect(screen.queryByText(new RegExp(socialPublisher.name))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(influencerPublisher.name))).not.toBeInTheDocument();
  });

  it("sends the correct payload shape to each table", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/what's the campaign/i), "Spring push");
    await searchAndAdd(user, socialPublisher.name);
    await searchAndAdd(user, influencerPublisher.name);

    await user.selectOptions(screen.getByRole("combobox"), "Unboxing / Product Review");
    await user.type(screen.getByPlaceholderText(/amount \(r\)/i), "3000");

    let capturedRequestsInsert: unknown;
    let capturedChannelRequestsInsert: unknown;
    mockFrom.mockImplementation((table: string) => {
      if (table === "requests") {
        const chain = makeChainable({ error: null });
        (chain.insert as Mock).mockImplementation((rows: unknown) => {
          capturedRequestsInsert = rows;
          return chain;
        });
        return chain;
      }
      if (table === "channel_requests") {
        const chain = makeChainable({ error: null });
        (chain.insert as Mock).mockImplementation((rows: unknown) => {
          capturedChannelRequestsInsert = rows;
          return chain;
        });
        return chain;
      }
      return makeChainable({ data: [socialPublisher, influencerPublisher], error: null });
    });

    await user.click(screen.getByRole("button", { name: /create 2 requests$/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    expect(capturedRequestsInsert).toEqual([
      expect.objectContaining({
        publisher_id: socialPublisher.id,
        business_id: "biz-1",
        campaign_message: "Spring push",
        agency_campaign_id: "camp-1",
      }),
    ]);
    expect(capturedChannelRequestsInsert).toEqual([
      expect.objectContaining({
        channel_slug: "influencer",
        creator_id: influencerPublisher.id,
        business_id: "biz-1",
        campaign_message: "Spring push",
        advertising_method: "Unboxing / Product Review",
        proposed_amount: 3000,
        agency_campaign_id: "camp-1",
      }),
    ]);
  });

  it("on partial failure, reports the social batch as already sent and keeps only the failed row queued", async () => {
    const user = userEvent.setup();
    setSupabaseResponses({
      publishers: { data: [socialPublisher, influencerPublisher], error: null },
      requests: { error: null },
      channel_requests: { error: { message: "network error" } },
    });
    renderForm();

    await user.type(screen.getByPlaceholderText(/what's the campaign/i), "Spring push");
    await searchAndAdd(user, socialPublisher.name);
    await searchAndAdd(user, influencerPublisher.name);
    await user.selectOptions(screen.getByRole("combobox"), "Unboxing / Product Review");
    await user.type(screen.getByPlaceholderText(/amount \(r\)/i), "3000");

    await user.click(screen.getByRole("button", { name: /create 2 requests$/i }));

    expect(
      await screen.findByText(/1 social-media request\(s\) above were already sent/i)
    ).toBeInTheDocument();

    // onCreated is only for a fully-landed submission — a partial
    // failure isn't that, so it must not fire.
    expect(onCreated).not.toHaveBeenCalled();

    // The social row already landed, so it's gone from the queue; the
    // failed channel-request row stays staged so it isn't lost. Two
    // elements legitimately contain the publisher's name once an amount
    // is entered (the row header and the commission-preview line below
    // it), so assert presence via getAllByText rather than getByText.
    expect(screen.queryByText(new RegExp(socialPublisher.name))).not.toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(influencerPublisher.name)).length).toBeGreaterThan(0);
  });

  it("does not fire the channel_requests insert at all when only social-media rows are queued", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/what's the campaign/i), "Spring push");
    await searchAndAdd(user, socialPublisher.name);

    await user.click(screen.getByRole("button", { name: /create 1 request$/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    expect(mockFrom).not.toHaveBeenCalledWith("channel_requests");
  });
});
