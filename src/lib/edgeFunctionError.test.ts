import { describe, it, expect } from "vitest";
import { describeEdgeFunctionError } from "./edgeFunctionError";

const FALLBACK = "Couldn't run the check.";
const httpError = (status: number, body: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify(body), { status }),
});

describe("describeEdgeFunctionError", () => {
  it("surfaces the message our function sent back instead of the generic one", async () => {
    const msg = await describeEdgeFunctionError(httpError(400, { error: "Set the campaign's platform and category before screening it." }), FALLBACK);
    expect(msg).toBe("Set the campaign's platform and category before screening it.");
  });

  it("keeps our function's own 404 message (record not found) distinct from a not-deployed 404", async () => {
    expect(await describeEdgeFunctionError(httpError(404, { error: "Campaign compliance record not found" }), FALLBACK)).toBe("Campaign compliance record not found");
    expect(await describeEdgeFunctionError(httpError(404, { code: "NOT_FOUND", message: "Requested function was not found" }), FALLBACK)).toMatch(/hasn't been deployed/);
  });

  it("explains an expired session on a platform 401", async () => {
    expect(await describeEdgeFunctionError(httpError(401, { code: 401, message: "Invalid JWT" }), FALLBACK)).toMatch(/log in again/);
  });

  it("appends the status when the body has nothing readable", async () => {
    const err = { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: new Response("boom", { status: 500 }) };
    expect(await describeEdgeFunctionError(err, FALLBACK)).toBe("Couldn't run the check. (error 500)");
  });

  it("handles network failures and never returns the generic non-2xx text", async () => {
    expect(await describeEdgeFunctionError({ name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" }, FALLBACK)).toMatch(/check your connection/);
    expect(await describeEdgeFunctionError(new Error("Edge Function returned a non-2xx status code"), FALLBACK)).toBe(FALLBACK);
    expect(await describeEdgeFunctionError(null, FALLBACK)).toBe(FALLBACK);
  });
});
