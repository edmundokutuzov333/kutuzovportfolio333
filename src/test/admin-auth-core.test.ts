import { describe, expect, it } from "vitest";
import { ADMIN_ACCESS_CODE, isAdminAttemptLocked, isAdminPinValid } from "@/lib/server/admin-auth-core";
describe("admin authentication controls", () => {
  it("accepts only the fixed access code 333", () => {
    expect(ADMIN_ACCESS_CODE).toBe("333");
    expect(isAdminPinValid("333", ADMIN_ACCESS_CODE)).toBe(true);
    expect(isAdminPinValid("111", ADMIN_ACCESS_CODE)).toBe(false);
    expect(isAdminPinValid("33", ADMIN_ACCESS_CODE)).toBe(false);
    expect(isAdminPinValid("3333", ADMIN_ACCESS_CODE)).toBe(false);
    expect(isAdminPinValid(null, ADMIN_ACCESS_CODE)).toBe(false);
  });
  it("locks a caller after the configured attempt limit and until the lock expires", () => {
    const now = Date.parse("2026-10-29T12:00:00.000Z");
    expect(isAdminAttemptLocked(5, "2026-10-29T12:15:00.000Z", now)).toBe(true);
    expect(isAdminAttemptLocked(4, "2026-10-29T11:59:00.000Z", now)).toBe(false);
    expect(isAdminAttemptLocked(5, null, now)).toBe(true);
  });
});
