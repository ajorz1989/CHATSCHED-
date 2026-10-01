import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostOpportunityHref } from "./usePostOpportunityHref";

const auth = vi.hoisted(() => ({ value: { user: null, profile: null } as { user: unknown; profile: { role: string } | null } }));
vi.mock("./useAuth", () => ({ useAuth: () => auth.value }));

describe("usePostOpportunityHref", () => {
  beforeEach(() => {
    auth.value = { user: null, profile: null };
  });

  it("sends logged-out visitors to business sign-up", () => {
    expect(renderHook(() => usePostOpportunityHref()).result.current).toBe("/register?role=business");
  });

  it("sends businesses and admins to the workspace", () => {
    for (const role of ["business", "admin"]) {
      auth.value = { user: { id: "u" }, profile: { role } };
      expect(renderHook(() => usePostOpportunityHref()).result.current).toBe("/opportunities/feed");
    }
  });

  it("does not send publishers or half-loaded accounts to sign-up", () => {
    auth.value = { user: { id: "u" }, profile: { role: "publisher" } };
    expect(renderHook(() => usePostOpportunityHref()).result.current).toBe("/opportunities");
    auth.value = { user: { id: "u" }, profile: null };
    expect(renderHook(() => usePostOpportunityHref()).result.current).toBe("/opportunities");
  });
});
