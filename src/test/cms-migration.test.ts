import { describe, expect, it } from "vitest";

import {
  clients as sourceClients,
  disciplines as sourceDisciplines,
  metrics as sourceMetrics,
  principles as sourcePrinciples,
  process as sourceProcess,
  projects as sourceProjects,
  services as sourceServices,
  skills as sourceSkills,
  experience as sourceExperience,
} from "@/lib/content";
import {
  ClientRowSchema,
  PageSectionSchema,
  ProjectRowSchema,
  toClient,
  toProject,
} from "@/lib/cms/types";

describe("CMS migration domain contracts", () => {
  it("preserves the four original project slugs, order, featured states, years and galleries", () => {
    expect(sourceProjects.map((project) => project.slug)).toEqual([
      "diga-yes",
      "jogue-venca-repita",
      "datas-que-ligam",
      "somos-uma",
    ]);
    expect(sourceProjects.map((project) => project.year)).toEqual([
      "2026",
      "2026",
      "2025 — 2026",
      "2026",
    ]);
    expect(sourceProjects.every((project) => project.featured)).toBe(true);
    expect(sourceProjects.map((project) => project.gallery.length)).toEqual([6, 2, 7, 3]);
  });

  it("preserves the 20 original clients and allows the text-only brand", () => {
    expect(sourceClients).toHaveLength(20);
    const textOnly = sourceClients.find((client) => client.name === "Brutal Fruit");
    expect(textOnly?.logo).toBeNull();

    const mapped = toClient(ClientRowSchema.parse({
      id: "c6fc44f6-3a37-4fd1-8704-fd3f0a627c6d",
      slug: "brutal-fruit",
      name: "Brutal Fruit",
      logo_path: null,
      logo_alt: null,
      position: 13,
      is_visible: true,
      show_on_home: true,
      show_on_clients_page: true,
    }));
    expect(mapped.logo).toBeNull();
    expect(mapped.name).toBe("Brutal Fruit");
    expect(mapped.position).toBe(13);
  });

  it("maps a persisted project without changing editorial values", () => {
    const source = sourceProjects[2]!;
    const mapped = toProject(ProjectRowSchema.parse({
      id: "65a661e7-e1f7-48da-a6a5-d084ed68e17f",
      slug: source.slug,
      title: source.title,
      client_label: source.client,
      year_label: source.year,
      discipline: source.discipline,
      project_type: source.discipline,
      summary: null,
      challenge: source.challenge,
      idea: source.idea,
      outcome: source.outcome,
      cover_path: source.cover,
      cover_alt: source.title,
      gallery: source.gallery,
      featured: source.featured,
      position: 2,
      status: "published",
      hue: source.hue,
      locale: "pt-MZ",
    }));

    expect(mapped.slug).toBe(source.slug);
    expect(mapped.title).toBe(source.title);
    expect(mapped.client).toBe(source.client);
    expect(mapped.year).toBe("2025 — 2026");
    expect(mapped.gallery).toEqual(source.gallery);
    expect(mapped.featured).toBe(true);
  });

  it("rejects unknown section types and retains unpublished status for explicit query filtering", () => {
    expect(() => PageSectionSchema.parse({
      id: "c6fc44f6-3a37-4fd1-8704-fd3f0a627c6d",
      page_id: "d7a0513e-0924-4cdc-b55a-2f0c426039f2",
      section_key: "arbitrary-code",
      section_type: "raw_html",
      position: 1,
      is_visible: true,
      config: { html: "<script>alert(1)</script>" },
    })).toThrow();

    expect(() => ProjectRowSchema.parse({
      id: "65a661e7-e1f7-48da-a6a5-d084ed68e17f",
      slug: "draft-project",
      title: "Unpublished",
      client_label: null,
      year_label: null,
      discipline: null,
      project_type: null,
      summary: null,
      challenge: null,
      idea: null,
      outcome: null,
      cover_path: null,
      cover_alt: null,
      gallery: [],
      featured: false,
      position: 99,
      status: "draft",
      hue: 215,
      locale: "en",
    })).not.toThrow();
  });

  it("records the full source collections used by public routes", () => {
    expect(sourceMetrics).toHaveLength(5);
    expect(sourceExperience).toHaveLength(5);
    expect(sourceSkills).toHaveLength(5);
    expect(sourceDisciplines).toHaveLength(3);
    expect(sourceDisciplines.reduce((count, group) => count + group.items.length, 0)).toBe(15);
    expect(sourceServices).toHaveLength(5);
    expect(sourcePrinciples).toHaveLength(4);
    expect(sourceProcess).toHaveLength(4);
  });
});
