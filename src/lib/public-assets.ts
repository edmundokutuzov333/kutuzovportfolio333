import { SUPABASE_URL } from "@/lib/cms/public-client";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

const PUBLIC_ASSET_BUCKET = "portfolio-public-assets";

/**
 * Resolves a published asset from the CMS without guessing its origin.
 * Legacy Lovable asset URLs remain on the production origin; uploaded object
 * paths resolve to the portfolio's public Supabase Storage bucket.
 */
export function resolvePublicAssetUrl(source: string | null | undefined): string {
  const value = source?.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    // Continue with known root-relative and Storage object-path formats.
  }

  if (value.startsWith("//")) return "";
  if (value.startsWith("/")) {
    return new URL(value, PUBLIC_PRODUCTION_ORIGIN).toString();
  }

  const normalized = value.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return "";
  const encodedPath = normalized.split("/").map(encodeURIComponent).join("/");
  return SUPABASE_URL.replace(/\/+$/, "") +
    "/storage/v1/object/public/" + PUBLIC_ASSET_BUCKET + "/" + encodedPath;
}
