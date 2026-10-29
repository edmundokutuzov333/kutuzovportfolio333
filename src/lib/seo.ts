import { PUBLIC_SITE_URL, validatePublicOrigin } from "@/lib/cms/public-client";
import type { CmsPage } from "@/lib/cms/types";

function absoluteUrl(value: string): string | null {
  try {
    const url = new URL(value, PUBLIC_SITE_URL || undefined);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveCanonicalUrl(
  routePath: string,
  storedCanonical: string | null | undefined,
  configuredOrigin: string | undefined,
  override?: string,
): string | null {
  const origin = validatePublicOrigin(configuredOrigin);
  if (!origin) return null;
  for (const candidate of [override, storedCanonical]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate, origin);
      if (url.protocol === "https:" && url.origin === origin && !url.username && !url.password) {
        return url.toString();
      }
    } catch {
      // Ignore malformed or off-origin canonical values and derive from the configured origin.
    }
  }
  try {
    return new URL(routePath, origin).toString();
  } catch {
    return null;
  }
}

export function seoFromPage(
  page: CmsPage,
  overrides: { title?: string; description?: string; canonicalUrl?: string; image?: string | null } = {},
) {
  const title = overrides.title ?? page.seo_title ?? page.title;
  const description = overrides.description ?? page.seo_description ?? "";
  const canonicalUrl = resolveCanonicalUrl(page.route_path, page.canonical_url, PUBLIC_SITE_URL, overrides.canonicalUrl);
  const imagePath = overrides.image === undefined ? page.og_image_path : overrides.image;
  const imageUrl = imagePath ? absoluteUrl(imagePath) : null;

  const meta = [
    { title },
    { name: "description", content: description },
    { name: "author", content: "Edmundo Kutuzov" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: page.route_path.startsWith("/work/") ? "article" : "website" },
    { property: "og:locale", content: page.locale },
    { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
    { name: "robots", content: "index,follow" },
  ];

  if (imageUrl) {
    meta.push({ property: "og:image", content: imageUrl } as (typeof meta)[number]);
    meta.push({ name: "twitter:image", content: imageUrl } as (typeof meta)[number]);
  }

  return {
    meta,
    links: canonicalUrl ? [{ rel: "canonical", href: canonicalUrl }] : [],
  };
}

export function noIndexSeo(title: string) {
  return {
    meta: [{ title }, { name: "robots", content: "noindex,nofollow" }],
  };
}
