import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractAuthHeader,
  checkIsAdminRole,
  isUserAdmin,
  validateAdminAccess,
  validateCampaignScreenAccess,
  validateNotifyAccess,
  verifyCronSecret,
} from "./auth";

describe("Edge Functions Auth & Admin Audit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractAuthHeader", () => {
    it("extracts header from Request object", () => {
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer test-jwt-token" },
      });
      expect(extractAuthHeader(req)).toBe("Bearer test-jwt-token");
    });

    it("extracts header from Headers object", () => {
      const headers = new Headers({ authorization: "Bearer lowercase-token" });
      expect(extractAuthHeader(headers)).toBe("Bearer lowercase-token");
    });

    it("extracts header from plain record", () => {
      expect(extractAuthHeader({ Authorization: "Bearer record-token" })).toBe("Bearer record-token");
    });

    it("returns empty string when no header is present", () => {
      const req = new Request("https://example.com");
      expect(extractAuthHeader(req)).toBe("");
    });
  });

  describe("checkIsAdminRole", () => {
    it("returns true only for 'admin'", () => {
      expect(checkIsAdminRole("admin")).toBe(true);
      expect(checkIsAdminRole("business")).toBe(false);
      expect(checkIsAdminRole("publisher")).toBe(false);
      expect(checkIsAdminRole(null)).toBe(false);
      expect(checkIsAdminRole(undefined)).toBe(false);
      expect(checkIsAdminRole("ADMIN")).toBe(false);
    });
  });

  describe("isUserAdmin", () => {
    it("returns true when profile role is admin", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: "admin" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await isUserAdmin(mockClient, "user-admin");
      expect(result).toBe(true);
    });

    it("returns false when profile role is not admin", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: "business" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await isUserAdmin(mockClient, "user-biz");
      expect(result).toBe(false);
    });

    it("returns false on db error or missing user", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Error" },
              }),
            }),
          }),
        }),
      };

      expect(await isUserAdmin(null, "user-1")).toBe(false);
      expect(await isUserAdmin(mockClient, "")).toBe(false);
      expect(await isUserAdmin(mockClient, "user-1")).toBe(false);
    });
  });

  describe("validateAdminAccess", () => {
    it("allows admin users", () => {
      const result = validateAdminAccess({ id: "admin-1" }, "admin");
      expect(result.allowed).toBe(true);
    });

    it("blocks unauthenticated users with 401", () => {
      const result = validateAdminAccess(null, undefined);
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.reason).toBe("Not logged in");
    });

    it("blocks non-admin users with 403", () => {
      const result = validateAdminAccess({ id: "user-1" }, "business");
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.reason).toBe("Admin only");
    });
  });

  describe("validateCampaignScreenAccess", () => {
    it("allows the business owner of the campaign", () => {
      const result = validateCampaignScreenAccess({ id: "biz-1" }, "business", "biz-1");
      expect(result.allowed).toBe(true);
    });

    it("allows any admin user even if not the business owner", () => {
      const result = validateCampaignScreenAccess({ id: "admin-1" }, "admin", "biz-1");
      expect(result.allowed).toBe(true);
    });

    it("blocks other businesses with 403", () => {
      const result = validateCampaignScreenAccess({ id: "biz-2" }, "business", "biz-1");
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("blocks unauthenticated callers with 401", () => {
      const result = validateCampaignScreenAccess(null, undefined, "biz-1");
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  describe("validateNotifyAccess", () => {
    it("strictly restricts status_change notifications to admin users", () => {
      // Business user attempts status_change -> rejected 403
      const bizResult = validateNotifyAccess("status_change", { id: "biz-1" }, "business", "biz-1");
      expect(bizResult.allowed).toBe(false);
      expect(bizResult.statusCode).toBe(403);

      // Admin user -> allowed
      const adminResult = validateNotifyAccess("status_change", { id: "admin-1" }, "admin", "biz-1");
      expect(adminResult.allowed).toBe(true);
      expect(adminResult.senderIsAdmin).toBe(true);
    });

    it("allows new_message from business and correctly flags senderIsAdmin = false", () => {
      const result = validateNotifyAccess("new_message", { id: "biz-1" }, "business", "biz-1");
      expect(result.allowed).toBe(true);
      expect(result.senderIsAdmin).toBe(false);
    });

    it("allows new_message from admin and correctly flags senderIsAdmin = true", () => {
      const result = validateNotifyAccess("new_message", { id: "admin-1" }, "admin", "biz-1");
      expect(result.allowed).toBe(true);
      expect(result.senderIsAdmin).toBe(true);
    });

    it("blocks new_message from unrelated third parties", () => {
      const result = validateNotifyAccess("new_message", { id: "random-user" }, "business", "biz-1");
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it("allows new_request for logged in user", () => {
      const result = validateNotifyAccess("new_request", { id: "biz-1" }, "business", "biz-1");
      expect(result.allowed).toBe(true);
    });

    it("rejects unauthenticated calls with 401", () => {
      const result = validateNotifyAccess("new_request", null, undefined, "biz-1");
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  describe("verifyCronSecret", () => {
    it("returns true on exact secret match", () => {
      expect(verifyCronSecret("my-secret-key", "my-secret-key")).toBe(true);
    });

    it("returns false on mismatch or missing secret", () => {
      expect(verifyCronSecret("wrong", "my-secret-key")).toBe(false);
      expect(verifyCronSecret("", "my-secret-key")).toBe(false);
      expect(verifyCronSecret(null, "my-secret-key")).toBe(false);
      expect(verifyCronSecret("my-secret-key", undefined)).toBe(false);
    });
  });
});
