import { describe, expect, it } from "vitest";
import { resolvePublicAssetUrl } from "@/lib/public-assets";
import { SUPABASE_URL } from "@/lib/cms/public-client";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

describe("resolvePublicAssetUrl", () => {
  it("returns an empty string for an absent asset", () => {
    expect(resolvePublicAssetUrl(null)).toBe("");
    expect(resolvePublicAssetUrl("  ")).toBe("");
  });

  it("preserves absolute HTTPS assets", () => {
    expect(resolvePublicAssetUrl("https://cdn.example.com/profile.webp")).toBe("https://cdn.example.com/profile.webp");
  });

  it("resolves legacy root-relative assets against the portfolio origin", () => {
    expect(resolvePublicAssetUrl("/__l5e/assets/profile.webp")).toBe(
      new URL("/__l5e/assets/profile.webp", PUBLIC_PRODUCTION_ORIGIN).toString(),
    );
  });

  it("resolves Storage object paths against the public portfolio bucket", () => {
    expect(resolvePublicAssetUrl("uploads/2026/11/portrait photo.webp")).toBe(
      SUPABASE_URL + "/storage/v1/object/public/portfolio-public-assets/uploads/2026/11/portrait%20photo.webp",
    );
  });

  it("rejects protocol-relative and traversal paths", () => {
    expect(resolvePublicAssetUrl("//untrusted.example/image.png")).toBe("");
    expect(resolvePublicAssetUrl("../private/image.png")).toBe("");
  });
});
