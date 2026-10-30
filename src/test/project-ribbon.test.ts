import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/cms/types";
import {
  buildProjectRibbonRows,
  PROJECT_RIBBON_ASPECT_RATIO,
  resolveProjectArtworkUrl,
} from "@/lib/project-ribbon";
import { measureProjectRibbon } from "@/components/TiltedProjectRibbon";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

function project(
  values: Partial<Project> & Pick<Project, "slug" | "title" | "position">,
): Project {
  return {
    id: values.id ?? values.slug,
    slug: values.slug,
    title: values.title,
    client: "",
    year: "",
    discipline: "",
    projectType: "",
    summary: "",
    challenge: "",
    idea: "",
    outcome: "",
    cover: values.cover ?? null,
    coverAlt: values.coverAlt ?? "",
    gallery: values.gallery ?? [],
    galleryAlt: values.galleryAlt ?? [],
    featured: values.featured ?? true,
    position: values.position,
    hue: values.hue ?? 0,
    locale: values.locale ?? "en",
  };
}

function currentPublishedProjects(): Project[] {
  const galleryCounts = [6, 2, 7, 3];
  return Array.from({ length: 4 }, (_, projectIndex) =>
    project({
      slug: `project-${projectIndex}`,
      title: `Project ${projectIndex}`,
      position: projectIndex,
      cover: `/cover-${projectIndex}.webp`,
      gallery: Array.from(
        { length: galleryCounts[projectIndex] ?? 0 },
        (_, imageIndex) => `/gallery-${projectIndex}-${imageIndex}.webp`,
      ),
    }),
  );
}

describe("homepage dual-perspective project ribbons", () => {
  it("uses narrow 1:2 portrait geometry matching the cinematic reference", () => {
    expect(PROJECT_RIBBON_ASPECT_RATIO).toBe(0.5);
  });

  it("resolves legacy root-relative artwork paths against the configured asset origin", () => {
    const source = "/__l5e/assets-v1/example-id/artwork.webp";
    expect(resolveProjectArtworkUrl(source)).toBe(
      new URL(source, PUBLIC_PRODUCTION_ORIGIN).toString(),
    );
  });

  it("preserves already absolute HTTP artwork URLs", () => {
    const source = "https://images.example.test/project.webp";
    expect(resolveProjectArtworkUrl(source)).toBe(source);
  });

  it("orders published projects by CMS position, with each cover before its gallery", () => {
    const projects = [
      project({
        slug: "second",
        title: "Second",
        position: 2,
        cover: "/second-cover.webp",
        gallery: ["/second-a.webp", "/second-b.webp"],
      }),
      project({
        slug: "first",
        title: "First",
        position: 0,
        cover: "/first-cover.webp",
        gallery: ["/first-a.webp"],
        galleryAlt: ["First campaign artwork"],
      }),
      project({
        slug: "middle",
        title: "Middle",
        position: 1,
        cover: "/middle-cover.webp",
        gallery: ["/middle-a.webp"],
      }),
    ];
    const rows = buildProjectRibbonRows(projects);
    const all = [...rows.upper, ...rows.lower].sort((a, b) => {
      const order = ["first", "middle", "second"];
      const projectOrder = order.indexOf(a.slug) - order.indexOf(b.slug);
      return projectOrder || a.artworkIndex - b.artworkIndex;
    });

    expect(all.map((image) => image.slug)).toEqual([
      "first", "first", "middle", "middle", "second", "second", "second",
    ]);
    expect(all.map((image) => new URL(image.src).pathname)).toEqual([
      "/first-cover.webp",
      "/first-a.webp",
      "/middle-cover.webp",
      "/middle-a.webp",
      "/second-cover.webp",
      "/second-a.webp",
      "/second-b.webp",
    ]);
    expect(all[1]?.alt).toBe("First campaign artwork");
    expect(all[0]?.artworkIndex).toBe(1);
    expect(all[1]?.artworkIndex).toBe(2);
  });

  it("splits all 22 current artworks into 11 unique items per row without duplicates", () => {
    const rows = buildProjectRibbonRows(currentPublishedProjects());
    const upperSources = rows.upper.map((image) => image.src);
    const lowerSources = rows.lower.map((image) => image.src);
    const combined = [...upperSources, ...lowerSources];

    expect(rows.total).toBe(22);
    expect(rows.upper).toHaveLength(11);
    expect(rows.lower).toHaveLength(11);
    expect(new Set(combined).size).toBe(22);
    expect(upperSources.some((source) => lowerSources.includes(source))).toBe(false);
  });

  it("alternates artworks from each project so neither row is dominated by one case study", () => {
    const rows = buildProjectRibbonRows(currentPublishedProjects());
    const allSlugs = [...rows.upper, ...rows.lower].map((image) => image.slug);
    expect(allSlugs.slice(0, 8)).toEqual([
      "project-0", "project-0", "project-0", "project-0",
      "project-0", "project-0", "project-0", "project-1",
    ]);
    expect(rows.upper.map((image) => image.slug)).toContain("project-3");
    expect(rows.lower.map((image) => image.slug)).toContain("project-3");
  });

  it("keeps 10–11 narrow tiles across the desktop ribbon and caps at the available unique artwork", () => {
    const layout = measureProjectRibbon(1536, 320, 90, PROJECT_RIBBON_ASPECT_RATIO, 5, 55 * Math.PI / 180, 11);
    expect(layout.columns).toBeGreaterThanOrEqual(9);
    expect(layout.columns).toBeLessThanOrEqual(11);
    expect(layout.sweep).toBeGreaterThan(0);
    expect(layout.limit).toBeGreaterThan(0);

    const wideLayout = measureProjectRibbon(2048, 320, 90, PROJECT_RIBBON_ASPECT_RATIO, 5, 55 * Math.PI / 180, 11);
    expect(wideLayout.columns).toBe(11);
  });

  it("returns an empty layout safely for an unmeasurable row", () => {
    expect(measureProjectRibbon(0, 0, 90, 0.5, 5, Math.PI / 3, 11)).toEqual({
      columns: 0,
      sweep: 0,
      unit: 0,
      limit: 0,
    });
  });

  it("skips empty and null artwork entries without inventing replacement images", () => {
    const rows = buildProjectRibbonRows([
      project({
        slug: "no-cover",
        title: "No cover",
        position: 0,
        cover: null,
        gallery: ["", "/real.webp"],
      }),
    ]);

    expect(rows.total).toBe(1);
    expect([...rows.upper, ...rows.lower][0]?.src).toContain("/real.webp");
  });
});
