import { describe, it, expect } from "vitest";
import {
  formatSupabaseError,
  isUniqueViolation,
  isPermissionDenied,
  extractErrorCode,
} from "./supabaseErrors";

describe("supabaseErrors utility", () => {
  it("formats string errors with optional context", () => {
    expect(formatSupabaseError("Network timeout")).toBe("Network timeout");
    expect(formatSupabaseError("Network timeout", "Couldn't save")).toBe("Couldn't save: Network timeout");
  });

  it("surfaces standard Postgres error codes with friendly descriptions, never the raw message", () => {
    const error23505 = { code: "23505", message: "duplicate key value violates unique constraint" };
    const formatted = formatSupabaseError(error23505, "Couldn't submit application");
    expect(formatted).toContain("Couldn't submit application");
    expect(formatted).toContain("A record with this identifier already exists");
    // The raw Postgres message must never reach the user-facing string —
    // it still reaches Sentry/console via reportError() inside
    // formatSupabaseError, just not here.
    expect(formatted).not.toContain("duplicate key value violates unique constraint");
  });

  it("correctly identifies unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("correctly identifies permission denied errors", () => {
    expect(isPermissionDenied({ code: "42501" })).toBe(true);
    expect(isPermissionDenied({ status: 403 })).toBe(true);
    expect(isPermissionDenied({ statusCode: 403 })).toBe(true);
    expect(isPermissionDenied({ code: "23505" })).toBe(false);
  });

  it("extracts error codes reliably", () => {
    expect(extractErrorCode({ code: "PGRST116" })).toBe("PGRST116");
    expect(extractErrorCode({ status: 404 })).toBe("404");
    expect(extractErrorCode({ statusCode: 500 })).toBe("500");
    expect(extractErrorCode({})).toBe(null);
    expect(extractErrorCode("string")).toBe(null);
  });

  it("does not leak error details (e.g. row values/column names) into the user-facing string", () => {
    const errorWithDetails = {
      code: "23503",
      message: "foreign key violation",
      details: "Key (user_id)=(123) is not present in table profiles.",
    };
    const formatted = formatSupabaseError(errorWithDetails, "Failed to link user");
    expect(formatted).not.toContain("Key (user_id)=(123)");
    expect(formatted).not.toContain("profiles");
    expect(formatted).toContain("Failed to link user");
    expect(formatted).toContain("The referenced item does not exist or was deleted");
  });

  it("falls back to a generic message for an unrecognized error code", () => {
    const errorUnknownCode = { code: "99999", message: "some obscure internal detail" };
    const formatted = formatSupabaseError(errorUnknownCode, "Couldn't save");
    expect(formatted).not.toContain("some obscure internal detail");
    expect(formatted).toContain("Couldn't save");
    expect(formatted).toContain("Something went wrong");
  });

  it("handles null or undefined errors gracefully", () => {
    expect(formatSupabaseError(null)).toBe("An unknown error occurred.");
    expect(formatSupabaseError(undefined, "Save failed")).toBe("Save failed");
  });
});
