import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { forfeitBusinessLaunchCredit } from "./launchCredit";

// PHASE20_LAUNCH_CREDIT_FORFEITURE_DELIVERY.md's own "Not done" list
// named this helper as having no test of its own — same standing gap as
// every supabase/functions/* file, since the surrounding edge functions
// depend on Deno.serve and can't be loaded outside Deno. This file
// itself has no Deno-specific dependency (just an untyped `admin`
// client passed in), so it's directly testable with a fake client.

type SelectResult = { data: { id: string; remaining: number } | null; error: unknown };
type UpdateResult = { error: unknown };

function makeAdmin(options: { selectResult: SelectResult; updateResult?: UpdateResult }) {
  let awaitingUpdate = false;
  const chain: Record<string, Mock> & { then?: unknown } = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => {
    awaitingUpdate = true;
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => options.selectResult);
  chain.then = (resolve: (value: SelectResult | UpdateResult) => void) => {
    resolve(awaitingUpdate ? options.updateResult ?? { error: null } : options.selectResult);
  };
  const from = vi.fn(() => chain);
  return { from, chain };
}

describe("forfeitBusinessLaunchCredit", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when the business has no launch-credit row yet", async () => {
    const admin = makeAdmin({ selectResult: { data: null, error: null } });

    await forfeitBusinessLaunchCredit(admin, "biz-1");

    expect(admin.chain.select).toHaveBeenCalledTimes(1);
    expect(admin.chain.update).not.toHaveBeenCalled();
  });

  it("does nothing when remaining credit is already zero", async () => {
    const admin = makeAdmin({ selectResult: { data: { id: "credit-1", remaining: 0 }, error: null } });

    await forfeitBusinessLaunchCredit(admin, "biz-1");

    expect(admin.chain.update).not.toHaveBeenCalled();
  });

  it("zeroes remaining when the business has unused launch credit", async () => {
    const admin = makeAdmin({
      selectResult: { data: { id: "credit-1", remaining: 199 }, error: null },
      updateResult: { error: null },
    });

    await forfeitBusinessLaunchCredit(admin, "biz-1");

    expect(admin.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ remaining: 0, updated_at: expect.any(String) })
    );
    // First .eq() scopes the lookup to the business; second scopes the
    // update to the specific credit row found — not to the business
    // again, since business_launch_credits' primary key here is its own
    // id, not business_id.
    expect(admin.chain.eq.mock.calls).toEqual([
      ["business_id", "biz-1"],
      ["id", "credit-1"],
    ]);
  });

  it("logs and returns early on a lookup error, without attempting an update", async () => {
    const admin = makeAdmin({ selectResult: { data: null, error: { message: "connection reset" } } });

    await forfeitBusinessLaunchCredit(admin, "biz-1");

    expect(admin.chain.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "forfeitBusinessLaunchCredit: lookup failed",
      expect.objectContaining({ businessId: "biz-1" })
    );
  });

  it("logs but does not throw when the update itself fails", async () => {
    const admin = makeAdmin({
      selectResult: { data: { id: "credit-1", remaining: 199 }, error: null },
      updateResult: { error: { message: "row locked" } },
    });

    await expect(forfeitBusinessLaunchCredit(admin, "biz-1")).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "forfeitBusinessLaunchCredit: update failed",
      expect.objectContaining({ businessId: "biz-1" })
    );
  });
});
