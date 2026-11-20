import snapshot from "@/data/public-cms-snapshot.json";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

const pagePaths = ["/", "/work", "/about", "/services", "/process", "/clients", "/contact", "/cv"];

export function renderSitemap(projects: readonly { status: string; slug: string }[]): string {
  const paths = new Set(pagePaths);
  for (const { slug, status } of projects) {
    if (status === "published" && slug && slug !== "." && slug !== ".." && !slug.includes("/")) {
      paths.add("/work/" + encodeURIComponent(slug));
    }
  }
  const urls = [...paths].map((path) => {
    const url = new URL(path, PUBLIC_PRODUCTION_ORIGIN).href.replaceAll("&", "&amp;");
    return "  <url><loc>" + url + "</loc></url>";
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function handleSitemapRequest(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  return new Response(request.method === "HEAD" ? null : renderSitemap(snapshot.tables.projects), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
