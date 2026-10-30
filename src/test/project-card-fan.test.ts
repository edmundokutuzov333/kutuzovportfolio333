import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/cms/types";
import {
  buildProjectArtwork,
  PROJECT_FAN_ASPECT_RATIO,
  resolveProjectArtworkUrl,
} from "@/lib/project-artwork";
import {
  FAN_CENTER_SLOT,
  getFanHeightMultiplier,
  getFanResponsiveMultiplier,
  getFanSlotConfig,
  getVisibleFanCards,
  MAX_VISIBLE_FAN_CARDS,
} from "@/lib/project-card-fan";
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

describe("homepage project card fan carousel", () => {
  it("locks every artwork frame to the non-negotiable 4:5 ratio", () => {
    expect(PROJECT_FAN_ASPECT_RATIO).toBe(0.8);
    expect(MAX_VISIBLE_FAN_CARDS).toBe(7);
    expect(FAN_CENTER_SLOT).toBe(3);
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

  it("keeps editorial order: project position, cover first, then gallery order", () => {
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

    const artwork = buildProjectArtwork(projects);
    expect(artwork.map((image) => image.slug)).toEqual([
      "first", "first", "middle", "middle", "second", "second", "second",
    ]);
    expect(artwork.map((image) => new URL(image.src).pathname)).toEqual([
      "/first-cover.webp",
      "/first-a.webp",
      "/middle-cover.webp",
      "/middle-a.webp",
      "/second-cover.webp",
      "/second-a.webp",
      "/second-b.webp",
    ]);
    expect(artwork[1]?.alt).toBe("First campaign artwork");
    expect(artwork[0]?.artworkIndex).toBe(1);
    expect(artwork[1]?.artworkIndex).toBe(2);
  });

  it("preserves all 22 published artworks exactly once in one continuous carousel", () => {
    const artwork = buildProjectArtwork(currentPublishedProjects());
    expect(artwork).toHaveLength(22);
    expect(new Set(artwork.map((image) => image.src)).size).toBe(22);
    expect(artwork.filter((image) => image.slug === "project-0")).toHaveLength(7);
    expect(artwork.filter((image) => image.slug === "project-1")).toHaveLength(3);
    expect(artwork.filter((image) => image.slug === "project-2")).toHaveLength(8);
    expect(artwork.filter((image) => image.slug === "project-3")).toHaveLength(4);
  });

  it("uses the reference responsive position multipliers at each breakpoint", () => {
    const cases: Array<[number, number]> = [
      [1920, 1],
      [1536, 1],
      [1280, 1],
      [1024, 1],
      [768, 0.75],
      [767, 0.5],
      [640, 0.5],
      [639, 0.38],
      [480, 0.38],
      [479, 0.28],
      [390, 0.28],
      [360, 0.28],
    ];
    for (const [width, expected] of cases) {
      expect(getFanResponsiveMultiplier(width)).toBe(expected);
    }
    expect(getFanResponsiveMultiplier(0)).toBe(0.28);
  });

  it("reduces vertical movement when the viewport height is below the design budget", () => {
    expect(getFanHeightMultiplier(1536, 1080)).toBe(1);
    expect(getFanHeightMultiplier(1536, 400)).toBeCloseTo((400 * 0.7) / (38 * 16), 5);
    expect(getFanHeightMultiplier(390, 844)).toBe(1);
    expect(getFanHeightMultiplier(390, 200)).toBeCloseTo((200 * 0.7) / (22 * 16), 5);
    expect(getFanHeightMultiplier(0, 0)).toBe(1);
  });

  it("uses mirrored positions around the dominant centre card", () => {
    const left = getFanSlotConfig(7, 0);
    const centre = getFanSlotConfig(7, 3);
    const right = getFanSlotConfig(7, 6);

    expect(centre).toEqual({ rot: 0, scale: 1, x: 0, y: 0, zIndex: 10 });
    expect(left.rot).toBe(-right.rot);
    expect(left.x).toBe(-right.x);
    expect(left.y).toBe(right.y);
    expect(left.scale).toBe(right.scale);
    expect(left.zIndex).toBe(right.zIndex);
  });

  it("keeps every card visible when there are seven or fewer artworks", () => {
    const cards = ["a", "b", "c", "d", "e", "f"];
    const visible = getVisibleFanCards(cards, 3);
    expect(visible.map((entry) => entry.item)).toEqual(cards);
    expect(visible.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("shows seven consecutive artworks in the correct order while paging", () => {
    const cards = Array.from({ length: 22 }, (_, index) => index);
    expect(getVisibleFanCards(cards, 3).map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(getVisibleFanCards(cards, 4).map((entry) => entry.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getVisibleFanCards(cards, 3).map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("wraps the first and last pages without blank slots or duplicated cards", () => {
    const cards = Array.from({ length: 22 }, (_, index) => index);
    const first = getVisibleFanCards(cards, 0);
    const last = getVisibleFanCards(cards, 21);

    expect(first.map((entry) => entry.index)).toEqual([19, 20, 21, 0, 1, 2, 3]);
    expect(last.map((entry) => entry.index)).toEqual([18, 19, 20, 21, 0, 1, 2]);
    expect(new Set(first.map((entry) => entry.index)).size).toBe(7);
    expect(new Set(last.map((entry) => entry.index)).size).toBe(7);
    expect(first.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("skips empty and null artwork entries without inventing replacement images", () => {
    const artwork = buildProjectArtwork([
      project({
        slug: "no-cover",
        title: "No cover",
        position: 0,
        cover: null,
        gallery: ["", "/real.webp"],
      }),
    ]);
    expect(artwork).toHaveLength(1);
    expect(artwork[0]?.src).toContain("/real.webp");
  });
});
