import { describe, expect, it } from "vitest";
import { validatePublicOrigin } from "@/lib/cms/public-client";

describe("canonical public origin", () => {
  it("does not invent a canonical URL when no deployment origin is configured", () => {
    expect(validatePublicOrigin(undefined)).toBe("");
    expect(validatePublicOrigin("")).toBe("");
  });

  it("rejects insecure, credentialed and non-origin URLs", () => {
    for (const value of [
      "http://kutuzov.example",
      "https://user:password@kutuzov.example",
      "https://kutuzov.example/preview/path",
      "https://kutuzov.example/?preview=1",
      "not-a-url",
    ]) {
      expect(validatePublicOrigin(value)).toBe("");
    }
  });

  it("normalizes a configured HTTPS origin", () => {
    expect(validatePublicOrigin("https://kutuzov.example/")).toBe("https://kutuzov.example");
  });
});
