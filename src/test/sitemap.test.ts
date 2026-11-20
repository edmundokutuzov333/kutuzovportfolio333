import { describe, expect, it } from "vitest";
import { handleSitemapRequest, renderSitemap } from "@/lib/server/sitemap.server";

describe("public sitemap", () => {
  it("lists canonical public pages and unique published works only", () => {
    const sitemap = renderSitemap([
      { status: "published", slug: "arte & design" },
      { status: "published", slug: "arte & design" },
      { status: "draft", slug: "private-draft" },
      { status: "archived", slug: "hidden-work" },
      { status: "published", slug: ".." },
    ]);
    expect(sitemap).toContain("<loc>https://edmundokutuzov.art/work</loc>");
    expect(sitemap.match(/arte%20%26%20design/g)).toHaveLength(1);
    expect(sitemap).not.toMatch(/private-draft|hidden-work|\/admin|\/work\/\.\./);
  });

  it("advertises XML for HEAD and rejects unsupported methods", async () => {
    const url = "https://preview.example/sitemap.xml";
    const head = handleSitemapRequest(new Request(url, { method: "HEAD" }));
    expect(head.headers.get("content-type")).toContain("application/xml");
    expect(await head.text()).toBe("");
    expect(handleSitemapRequest(new Request(url, { method: "POST" })).status).toBe(405);
  });
});
