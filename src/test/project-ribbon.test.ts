import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/cms/types";
import {
  buildProjectRibbonImages,
  PROJECT_RIBBON_ASPECT_RATIO,
  resolveProjectArtworkUrl,
} from "@/lib/project-ribbon";
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

describe("homepage project artwork ribbon", () => {
  it("uses strict 4:5 portrait geometry", () => {
    expect(PROJECT_RIBBON_ASPECT_RATIO).toBe(0.8);
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

  it("orders projects by CMS position and places each cover before its gallery", () => {
    const images = buildProjectRibbonImages([
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
    ]);

    expect(images.map((image) => image.slug)).toEqual([
      "first",
      "first",
      "middle",
      "middle",
      "second",
      "second",
      "second",
    ]);
    expect(images.map((image) => new URL(image.src).pathname)).toEqual([
      "/first-cover.webp",
      "/first-a.webp",
      "/middle-cover.webp",
      "/middle-a.webp",
      "/second-cover.webp",
      "/second-a.webp",
      "/second-b.webp",
    ]);
    expect(images[1]?.alt).toBe("First campaign artwork");
    expect(images[0]?.artworkIndex).toBe(1);
    expect(images[1]?.artworkIndex).toBe(2);
  });

  it("includes every supplied published project's cover and gallery images (22 current artworks)", () => {
    const galleryCounts = [6, 2, 7, 3];
    const projects = Array.from({ length: 4 }, (_, projectIndex) =>
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

    expect(buildProjectRibbonImages(projects)).toHaveLength(22);
  });

  it("skips empty and null artwork entries without inventing replacement images", () => {
    const images = buildProjectRibbonImages([
      project({
        slug: "no-cover",
        title: "No cover",
        position: 0,
        cover: null,
        gallery: ["", "/real.webp"],
      }),
    ]);

    expect(images).toHaveLength(1);
    expect(images[0]?.src).toContain("/real.webp");
  });
});
