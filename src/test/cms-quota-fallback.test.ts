import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import snapshot from "@/data/public-cms-snapshot.json";
import { selectPublicRows } from "@/lib/cms/public-client";
import { selectOfflinePublicRows } from "@/lib/cms/snapshot-fallback";
import {
  loadAboutContent, loadClientsContent, loadContactContent,
  loadHomeContent, loadProcessContent, loadServicesContent, loadWorkContent,
  loadProjectDetailContent,
} from "@/lib/cms/loaders";

describe("Supabase quota outage — published portfolio continuity", () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const firstPublishedProject = [...snapshot.tables.projects].sort((a, b) => a.position - b.position)[0]!;

  beforeAll(() => {
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(JSON.stringify({
        message: "Service for this project is restricted: exceed_cached_egress_quota",
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    });
  });
  afterAll(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.useRealTimers();
  });

  it("contains only public data and preserves the real 155-work sequence", () => {
    expect(snapshot.tables.projects).toHaveLength(155);
    expect(snapshot.tables.projects.every(project => project.status === "published")).toBe(true);
    expect(new Set(snapshot.tables.projects.map(project => project.id)).size).toBe(155);
    expect(snapshot.tables.pages).toHaveLength(8);
    expect(snapshot.tables.pages.every(page => page.status === "published")).toBe(true);
    expect(snapshot.tables.clients.every(client => client.is_visible)).toBe(true);
    expect(snapshot.tables.page_sections.every(section => section.is_visible)).toBe(true);
    expect(snapshot.tables.site_settings.every(setting => setting.is_public)).toBe(true);
    expect(Object.keys(snapshot.tables)).not.toContain("contact_submissions");
    expect(Object.keys(snapshot.tables)).not.toContain("newsletter_subscribers");
    expect(Object.keys(snapshot.tables)).not.toContain("admin_audit_log");
    expect(Object.keys(snapshot.tables)).not.toContain("content_revisions");
  });

  it("serves the existing Home and complete Work routes during HTTP 402", async () => {
    const home = await loadHomeContent();
    const work = await loadWorkContent();
    expect(home.page.route_path).toBe("/");
    expect(home.sections.some(section => section.section_type === "hero")).toBe(true);
    expect(home.projects.map(({ slug }) => slug)).toEqual(work.projects.filter(({ featured }) => featured).map(({ slug }) => slug));
    expect(work.page.route_path).toBe("/work");
    expect(work.projects.length).toBe(155);
    expect(work.projects[0]?.slug).toBe(firstPublishedProject.slug);
  });

  it("preserves project pages and every additional public route during quota suspension", async () => {
    const project = await loadProjectDetailContent(firstPublishedProject.slug);
    expect(project.project?.slug).toBe(firstPublishedProject.slug);
    const { projects } = await loadWorkContent();
    const [, next] = projects;
    expect(project).not.toHaveProperty("projects");
    expect(project).toHaveProperty("nextProject", { slug: next?.slug, title: next?.title, discipline: next?.discipline });
    const [about, services, process, clients, contact] = await Promise.all([
      loadAboutContent(), loadServicesContent(), loadProcessContent(),
      loadClientsContent(), loadContactContent(),
    ]);
    expect(about.profile.name).toBeTruthy();
    expect(services.services.length).toBeGreaterThan(0);
    expect(process.process.length).toBeGreaterThan(0);
    expect(clients.clients.length).toBeGreaterThan(0);
    expect(contact.contactSteps.length).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
  });

  it("applies PostgREST filters, column projections, sorting and limits to the snapshot", async () => {
    const row = await selectOfflinePublicRows("projects", {
      select: "slug,title,position", status: "eq.published", order: "position.asc", limit: "1",
    });
    expect(row).toEqual([{
      slug: firstPublishedProject.slug,
      title: firstPublishedProject.title,
      position: firstPublishedProject.position,
    }]);
    const matching = await selectOfflinePublicRows("projects", {
      select: "slug", slug: `eq.${snapshot.tables.projects[10]?.slug}`,
      status: "eq.published", limit: "1",
    });
    expect(matching).toEqual([{ slug: snapshot.tables.projects[10]?.slug }]);
    await expect(selectOfflinePublicRows("projects", { status: "like.*" }))
      .rejects.toThrow("Unsupported public snapshot filter");
  });

  it("switches back to the live database automatically when its cooldown expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 46_000);
    vi.stubGlobal("fetch", async () =>
      new Response('[{"published_revision":999}]', { status: 200, headers: { "Content-Type": "application/json" } }));
    const rows = await selectPublicRows("site_publication_state", { select: "published_revision", limit: "1" });
    expect(rows).toEqual([{ published_revision: 999 }]);
    vi.useRealTimers();
  });
});
