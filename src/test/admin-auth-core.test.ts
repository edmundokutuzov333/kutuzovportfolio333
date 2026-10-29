import { describe, expect, it } from "vitest";

import {
  isAdminAttemptLocked,
  isAdminPinValid,
  isAuthorizedAdminIdentity,
} from "@/lib/server/admin-auth-core";

describe("admin authentication controls", () => {
  it("accepts only a configured three-digit PIN match", () => {
    expect(isAdminPinValid("472", "472")).toBe(true);
    expect(isAdminPinValid("471", "472")).toBe(false);
    expect(isAdminPinValid("472", "0472")).toBe(false);
    expect(isAdminPinValid("abc", "abc")).toBe(false);
    expect(isAdminPinValid(null, "472")).toBe(false);
  });

  it("requires both the allowlisted email and a server-controlled app metadata role", () => {
    expect(
      isAuthorizedAdminIdentity(
        { id: "user-1", email: "OWNER@example.com", app_metadata: { site_role: "admin" } },
        "owner@example.com",
      ),
    ).toBe(true);
    expect(
      isAuthorizedAdminIdentity(
        { id: "user-1", email: "owner@example.com", app_metadata: { site_role: "user" } },
        "owner@example.com",
      ),
    ).toBe(false);
    expect(
      isAuthorizedAdminIdentity(
        { id: "user-1", email: "other@example.com", app_metadata: { site_role: "admin" } },
        "owner@example.com",
      ),
    ).toBe(false);
    expect(isAuthorizedAdminIdentity(null, "owner@example.com")).toBe(false);
  });

  it("locks a caller after the configured attempt limit and until the lock expires", () => {
    const now = Date.parse("2026-10-29T12:00:00.000Z");
    expect(isAdminAttemptLocked(5, "2026-10-29T12:15:00.000Z", now)).toBe(true);
    expect(isAdminAttemptLocked(4, "2026-10-29T11:59:00.000Z", now)).toBe(false);
    expect(isAdminAttemptLocked(5, null, now)).toBe(true);
  });
});
