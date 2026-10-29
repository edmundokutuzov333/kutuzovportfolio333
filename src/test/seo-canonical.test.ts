import { describe, expect, it } from "vitest";
import { resolveCanonicalUrl } from "@/lib/seo";

describe("page canonical resolution", () => {
  it("omits canonical metadata when no validated deployment origin is configured", () => {
    expect(resolveCanonicalUrl("/about", "https://preview.example/about", undefined)).toBeNull();
    expect(resolveCanonicalUrl("/about", "https://preview.example/about", "http://site.example")).toBeNull();
  });

  it("ignores stale preview canonicals and derives the path from the configured origin", () => {
    expect(resolveCanonicalUrl(
      "/about",
      "https://kutuzovportfolio333.lovable.app/about",
      "https://portfolio.example",
    )).toBe("https://portfolio.example/about");
  });

  it("preserves a stored canonical only when it matches the configured origin", () => {
    expect(resolveCanonicalUrl(
      "/about",
      "https://portfolio.example/about?view=work",
      "https://portfolio.example/",
    )).toBe("https://portfolio.example/about?view=work");
  });

  it("rejects a cross-origin override and uses the canonical origin instead", () => {
    expect(resolveCanonicalUrl(
      "/work",
      null,
      "https://portfolio.example",
      "https://attacker.example/elsewhere",
    )).toBe("https://portfolio.example/work");
  });
});
