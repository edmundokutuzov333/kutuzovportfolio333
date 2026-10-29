import { describe, expect, it } from "vitest";
import { inspectImageBytes, normalizeObjectPath, referencesAsset } from "@/lib/media-validation";
import { inspectImageBytes as inspectEdgeImageBytes } from "../../supabase/functions/public-forms/image-validation";

const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
const ONE_PIXEL_PNG = fromHex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c6360000200000500017a5eab3f0000000049454e44ae426082");

describe("server-side media validation", () => {
  it("inspects actual PNG signatures, dimensions, chunk bounds and checksums", () => {
    expect(inspectImageBytes(ONE_PIXEL_PNG)).toEqual({
      mime: "image/png", extension: "png", width: 1, height: 1,
    });
    expect(inspectImageBytes(ONE_PIXEL_PNG.slice(0, 30))).toBeNull();
    const corrupted = ONE_PIXEL_PNG.slice();
    corrupted[16] = 0xff;
    expect(inspectImageBytes(corrupted)).toBeNull();
  });

  it("uses the same strict parser in the public Edge Function", () => {
    expect(inspectEdgeImageBytes(ONE_PIXEL_PNG)).toEqual(inspectImageBytes(ONE_PIXEL_PNG));
    expect(inspectEdgeImageBytes(ONE_PIXEL_PNG.slice(0, 30))).toBeNull();
  });

  it("rejects unknown and truncated file contents", () => {
    expect(inspectImageBytes(new TextEncoder().encode("<svg><script>alert(1)</script></svg>"))).toBeNull();
    expect(inspectImageBytes(new Uint8Array([0xff,0xd8,0xff,0xe0]))).toBeNull();
    expect(inspectImageBytes(new Uint8Array([0x52,0x49,0x46,0x46,0x00,0x00,0x00,0x00,0x57,0x45,0x42,0x50]))).toBeNull();
  });

  it("rejects traversal paths and accepts a confined object path", () => {
    expect(normalizeObjectPath("../private/file.webp")).toBeNull();
    expect(normalizeObjectPath("uploads/user/../file.webp")).toBeNull();
    expect(normalizeObjectPath("/absolute/file.png")).toBeNull();
    expect(normalizeObjectPath("uploads/admin/2026/file.webp")).toBe("uploads/admin/2026/file.webp");
  });

  it("detects public URL and nested JSON references before deletion", () => {
    const path = "uploads/admin/2026/image.webp";
    const url = "https://project.supabase.co/storage/v1/object/public/portfolio-public-assets/" + path;
    expect(referencesAsset({ cover_path: path }, path, url)).toBe(true);
    expect(referencesAsset({ gallery: [url + "?width=800"] }, path, url)).toBe(true);
    expect(referencesAsset({ gallery: ["unrelated.webp"] }, path, url)).toBe(false);
  });
});
