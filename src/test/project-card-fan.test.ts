import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/cms/types";
import {
  buildProjectArtwork,
  resolveProjectArtworkUrl,
} from "@/lib/project-artwork";
import {
  FAN_CENTER_SLOT,
  getFanHeightMultiplier,
  getFanSlotConfig,
  getFanVisibleCount,
  getVisibleFanCards,
  INITIAL_FAN_INDEX,
  MAX_VISIBLE_FAN_CARDS,
  MOBILE_FAN_CENTER_SLOT,
  MOBILE_VISIBLE_FAN_CARDS,
  PROJECT_FAN_ASPECT_RATIO,
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
    expect(MAX_VISIBLE_FAN_CARDS).toBe(5);
    expect(MOBILE_VISIBLE_FAN_CARDS).toBe(3);
    expect(FAN_CENTER_SLOT).toBe(2);
    expect(MOBILE_FAN_CENTER_SLOT).toBe(1);
    expect(INITIAL_FAN_INDEX).toBe(3);
  });

  it("selects five desktop positions and three mobile positions", () => {
    expect(getFanVisibleCount(1920)).toBe(5);
    expect(getFanVisibleCount(1024)).toBe(5);
    expect(getFanVisibleCount(768)).toBe(5);
    expect(getFanVisibleCount(767)).toBe(3);
    expect(getFanVisibleCount(390)).toBe(3);
    expect(getFanVisibleCount(360)).toBe(3);
    expect(getFanVisibleCount(0)).toBe(5);
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

  it("uses five mirrored desktop positions with a dominant centre and exposed outer corners", () => {
    const outerLeft = getFanSlotConfig(5, 0);
    const innerLeft = getFanSlotConfig(5, 1);
    const centre = getFanSlotConfig(5, 2);
    const innerRight = getFanSlotConfig(5, 3);
    const outerRight = getFanSlotConfig(5, 4);

    expect(centre.x).toBe(0);
    expect(centre.scale).toBe(1);
    expect(centre.zIndex).toBeGreaterThan(innerLeft.zIndex);
    expect(centre.zIndex).toBeGreaterThan(outerLeft.zIndex);
    expect(outerLeft.zIndex).toBeGreaterThan(innerLeft.zIndex);
    expect(outerRight.zIndex).toBeGreaterThan(innerRight.zIndex);
    expect(outerLeft.x).toBe(-outerRight.x);
    expect(innerLeft.x).toBe(-innerRight.x);
    expect(outerLeft.rot).toBe(-outerRight.rot);
    expect(outerLeft.rotateY).toBe(-outerRight.rotateY);
    expect(outerLeft.scale).toBe(outerRight.scale);
    expect(outerLeft.opacity).toBe(outerRight.opacity);
  });

  it("uses a separate three-position mobile fan", () => {
    const left = getFanSlotConfig(3, 0);
    const centre = getFanSlotConfig(3, 1);
    const right = getFanSlotConfig(3, 2);

    expect(centre.scale).toBe(1);
    expect(centre.zIndex).toBeGreaterThan(left.zIndex);
    expect(left.x).toBe(-right.x);
    expect(left.rot).toBe(-right.rot);
    expect(left.rotateY).toBe(-right.rotateY);
    expect(left.scale).toBe(right.scale);
  });

  it("reduces vertical movement when the viewport height is below the design budget", () => {
    expect(getFanHeightMultiplier(1536, 1080)).toBe(1);
    expect(getFanHeightMultiplier(1536, 400)).toBeCloseTo((400 * 0.7) / (44 * 16), 5);
    expect(getFanHeightMultiplier(390, 844)).toBe(1);
    expect(getFanHeightMultiplier(390, 200)).toBeCloseTo((200 * 0.7) / (31 * 16), 5);
    expect(getFanHeightMultiplier(0, 0)).toBe(1);
  });

  it("keeps all artworks visible when the collection fits the selected layout", () => {
    const cards = ["a", "b", "c", "d", "e"];
    const visible = getVisibleFanCards(cards, 3, 5);
    expect(visible.map((entry) => entry.item)).toEqual(cards);
    expect(visible.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it("shows five consecutive artworks on desktop and three on mobile", () => {
    const cards = Array.from({ length: 22 }, (_, index) => index);
    expect(getVisibleFanCards(cards, 3, 5).map((entry) => entry.index)).toEqual([1, 2, 3, 4, 5]);
    expect(getVisibleFanCards(cards, 4, 5).map((entry) => entry.index)).toEqual([2, 3, 4, 5, 6]);
    expect(getVisibleFanCards(cards, 3, 3).map((entry) => entry.index)).toEqual([2, 3, 4]);
    expect(getVisibleFanCards(cards, 4, 3).map((entry) => entry.index)).toEqual([3, 4, 5]);
  });

  it("wraps desktop and mobile windows at both ends without blank or duplicate slots", () => {
    const cards = Array.from({ length: 22 }, (_, index) => index);
    expect(getVisibleFanCards(cards, 0, 5).map((entry) => entry.index)).toEqual([20, 21, 0, 1, 2]);
    expect(getVisibleFanCards(cards, 21, 5).map((entry) => entry.index)).toEqual([19, 20, 21, 0, 1]);
    expect(getVisibleFanCards(cards, 0, 3).map((entry) => entry.index)).toEqual([21, 0, 1]);
    expect(getVisibleFanCards(cards, 21, 3).map((entry) => entry.index)).toEqual([20, 21, 0]);
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
