import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  budgets,
  capabilities,
  clients,
  disciplines,
  experience,
  metrics,
  principles,
  process,
  profile,
  projectTypes,
  projects,
  services,
  skills,
} from "../src/lib/content.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "reports", "cms-import-reconciliation.json");
const supabaseUrl = process.env["SUPABASE_URL"]?.trim().replace(/\/+$/, "");
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
const publicSiteUrl =
  process.env["PUBLIC_SITE_URL"]?.trim().replace(/\/+$/, "") ||
  "https://kutuzovportfolio333.lovable.app";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("CMS import requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the execution environment.");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function rest(
  table: string,
  query: Record<string, string>,
  method = "GET",
  body?: unknown,
  prefer?: string,
): Promise<unknown> {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const headers: Record<string, string> = {
    apikey: serviceRoleKey!,
    Authorization: `Bearer ${serviceRoleKey!}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers["Prefer"] = prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const safeText = (await response.text()).slice(0, 500);
    throw new Error(`CMS import failed for ${table} (HTTP ${response.status}): ${safeText}`);
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return [];
  const result = await rest(
    table,
    { on_conflict: onConflict, select: "*" },
    "POST",
    rows,
    "resolution=merge-duplicates,return=representation",
  );
  if (!Array.isArray(result)) throw new Error(`CMS import returned an invalid response for ${table}.`);
  return result as Record<string, unknown>[];
}

async function walkManifests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...(await walkManifests(fullPath)));
    else if (entry.isFile() && entry.name.endsWith(".asset.json")) matches.push(fullPath);
  }
  return matches.sort();
}

const now = new Date().toISOString();
const heroCopy = {
  work: {
    eyebrow: "Index of work",
    lines: ["Selected", "work."],
    intro: "Campaigns, key visuals and content systems directed for brands in Mozambique and beyond.",
  },
  about: {
    eyebrow: "About · Credentials",
    lines: ["Strategy, craft", "and a sharp", "point of view."],
    intro: profile.intro,
  },
  services: {
    eyebrow: "Services",
    lines: ["Visual capabilities", "& disciplines."],
    intro: "Five practices, one system. Each engagement is built around what the brand needs to be remembered for.",
  },
  process: {
    eyebrow: "Process",
    lines: ["From brief", "to rollout."],
    intro: "The working method proposed for each engagement — four phases, scaled to the project.",
  },
  clients: {
    eyebrow: "Selected collaborations",
    lines: ["Brands and", "teams."],
    intro: "A selection of local and international brands I have collaborated with as art director, graphic designer and creative lead.",
  },
  contact: {
    eyebrow: "Contact",
    lines: ["Let's talk."],
    intro: "Tell me about your project. I respond to every message within 48 hours with an initial process proposal.",
  },
  detail: {
    eyebrow: "Case study",
    lines: ["Case study"],
  },
};

const pageRows = [
  {
    slug: "home",
    route_path: "/",
    title: "Home",
    locale: "en",
    status: "published",
    seo_title: "Art Director, Maputo — Edmundo Kutuzov",
    seo_description: "Edmundo Kutuzov — art director from Maputo building brand systems that stop, stay in memory and make people act.",
    canonical_url: new URL("/", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "work",
    route_path: "/work",
    title: "Work",
    locale: "en",
    status: "published",
    seo_title: "Work — Edmundo Kutuzov",
    seo_description: "Selected campaigns, identities and digital systems directed by Edmundo Kutuzov.",
    canonical_url: new URL("/work", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "work-detail",
    route_path: "/work/:slug",
    title: "Project case study",
    locale: "pt-MZ",
    status: "published",
    seo_title: "Project case study — Edmundo Kutuzov",
    seo_description: "Project case study by Edmundo Kutuzov.",
    canonical_url: null,
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "about",
    route_path: "/about",
    title: "About & Credentials",
    locale: "en",
    status: "published",
    seo_title: "About & Credentials — Edmundo Kutuzov",
    seo_description: "Career, metrics, skills and principles of art director Edmundo Kutuzov.",
    canonical_url: new URL("/about", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "services",
    route_path: "/services",
    title: "Services",
    locale: "en",
    status: "published",
    seo_title: "Services — Edmundo Kutuzov",
    seo_description: "Visual identity, art direction, editorial & print, digital design and AI creative direction.",
    canonical_url: new URL("/services", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "process",
    route_path: "/process",
    title: "Process",
    locale: "en",
    status: "published",
    seo_title: "Process — Edmundo Kutuzov",
    seo_description: "The four-phase editorial method behind every project: discovery, direction, craft and rollout.",
    canonical_url: new URL("/process", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "clients",
    route_path: "/clients",
    title: "Clients",
    locale: "en",
    status: "published",
    seo_title: "Clients — Edmundo Kutuzov",
    seo_description: "A selection of local and international brands Edmundo Kutuzov has collaborated with.",
    canonical_url: new URL("/clients", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
  {
    slug: "contact",
    route_path: "/contact",
    title: "Contact",
    locale: "en",
    status: "published",
    seo_title: "Contact — Edmundo Kutuzov",
    seo_description: "Tell Edmundo Kutuzov about your project — every message answered within 48 hours.",
    canonical_url: new URL("/contact", publicSiteUrl).toString(),
    og_image_path: projects[0]?.cover ?? null,
    updated_at: now,
  },
];

const pageRecords = await upsert("pages", pageRows, "slug");
const pageIdByRoute = new Map(
  pageRecords.map((row) => [String(row["route_path"]), String(row["id"])]),
);
for (const page of pageRows) {
  if (!pageIdByRoute.has(page.route_path)) {
    throw new Error(`Page upsert did not return an ID for route ${page.route_path}.`);
  }
}

await upsert("profile_content", [{
  singleton_key: "primary",
  name: profile.name,
  role: profile.title,
  roles: profile.roles,
  location: profile.location,
  address: profile.address,
  public_email: profile.email,
  phone: profile.phone,
  whatsapp: profile.whatsapp,
  socials: profile.socials,
  headline: profile.headline,
  intro: profile.intro,
  is_published: true,
  updated_at: now,
}], "singleton_key");

await upsert("metrics", metrics.map((item, position) => ({
  value: item.value,
  label: item.label,
  note: item.note,
  position,
  is_published: true,
  updated_at: now,
})), "position");

await upsert("experience_items", experience.map((item, position) => ({
  organisation: item.company,
  role: item.role,
  period: item.period,
  description: item.text,
  position,
  is_published: true,
  updated_at: now,
})), "position");

await upsert("skills", skills.map((item, position) => ({
  name: item.name,
  value: item.value,
  tier: item.tier,
  position,
  is_published: true,
  updated_at: now,
})), "name");

await upsert("disciplines", disciplines.map((item, position) => ({
  name: item.group,
  description: null,
  items: item.items,
  position,
  is_published: true,
  updated_at: now,
})), "name");

await upsert("services", services.map((item, position) => ({
  slug: item.slug,
  title: item.title,
  description: item.text,
  details: item.deliverables,
  number_label: item.n,
  line: item.line,
  position,
  is_published: true,
  updated_at: now,
})), "slug");

await upsert("principles", principles.map((item, position) => ({
  title: item.title,
  description: item.text,
  position,
  is_published: true,
  updated_at: now,
})), "position");

await upsert("process_steps", process.map((item, position) => ({
  step_key: slugify(item.title),
  title: item.title,
  description: item.text,
  number_label: item.n,
  position,
  is_published: true,
  updated_at: now,
})), "step_key");

await upsert("clients", clients.map((item, position) => ({
  slug: slugify(item.name),
  name: item.name,
  logo_path: item.logo,
  logo_alt: item.logo ? item.name : null,
  display_as_text: item.logo === null,
  position,
  show_on_home: true,
  show_on_clients_page: true,
  is_visible: true,
  updated_at: now,
})), "slug");

await upsert("projects", projects.map((item, position) => ({
  slug: item.slug,
  title: item.title,
  client_label: item.client,
  year_label: item.year,
  discipline: item.discipline,
  project_type: item.discipline,
  summary: null,
  challenge: item.challenge,
  idea: item.idea,
  outcome: item.outcome,
  cover_path: item.cover,
  cover_alt: item.title,
  gallery: item.gallery,
  featured: item.featured,
  position,
  status: "published",
  hue: item.hue,
  locale: "pt-MZ",
  updated_at: now,
})), "slug");

const settingsRows = [
  { setting_key: "capabilities", setting_value: capabilities },
  { setting_key: "project_types", setting_value: projectTypes },
  { setting_key: "budgets", setting_value: budgets },
  {
    setting_key: "contact_steps",
    setting_value: [
      { k: "Identity", t: "Start with the people behind the project.", d: "Enough about you or your team to start the conversation." },
      { k: "Project", t: "What are we making?", d: "Pick the main discipline and how pressing the work is." },
      { k: "Budget", t: "What scale should I design for?", d: "Share a range if useful — not disclosing is fine." },
      { k: "Timing", t: "When does the work need to move?", d: "A target date and preferred channel help shape the reply." },
      { k: "References", t: "Give the idea enough context.", d: "Describe the brief, add links and useful visual references." },
    ],
  },
];
await upsert("site_settings", settingsRows.map((row) => ({
  ...row,
  is_public: true,
  updated_at: now,
})), "setting_key");

const homeSections = [
  { section_key: "hero", section_type: "hero", position: 0, config: { eyebrow: "", lines: [] } },
  { section_key: "manifesto", section_type: "manifesto", position: 1, config: { label: "Manifesto" } },
  { section_key: "featured-work", section_type: "featured_work", position: 2, config: { label: "Selected work", title_lines: ["Work that refuses", "to be ignored."], link_label: "All projects" } },
  { section_key: "services", section_type: "services", position: 3, config: { label: "Visual capabilities & disciplines" } },
  { section_key: "metrics", section_type: "metrics", position: 4, config: {} },
  { section_key: "clients", section_type: "clients", position: 5, config: { label: "Clients", title_lines: ["Brands and teams", "I have worked with."], link_label: "See all clients" } },
  { section_key: "principles", section_type: "principles", position: 6, config: {} },
];

const sections = [
  ...homeSections.map((section) => ({ ...section, page_route: "/" })),
  { page_route: "/work", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.work },
  { page_route: "/work/:slug", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.detail },
  { page_route: "/about", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.about },
  { page_route: "/about", section_key: "about-copy", section_type: "rich_text", position: 1, config: { paragraphs: [
    "Based in the Mozambican creative ecosystem, I combine strategy, visual identity, campaign direction, communication systems, typography, digital content, motion and AI tools into one practice.",
    "On-site in Maputo and remote worldwide, available for international projects. Agency and corporate experience across identity, advertising, digital content, institutional communication and print.",
  ] } },
  { page_route: "/services", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.services },
  { page_route: "/process", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.process },
  { page_route: "/clients", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.clients },
  { page_route: "/contact", section_key: "hero", section_type: "hero", position: 0, config: heroCopy.contact },
].map(({ page_route, ...section }) => ({
  page_id: pageIdByRoute.get(page_route),
  ...section,
  is_visible: true,
  updated_at: now,
}));
if (sections.some((section) => !section.page_id)) throw new Error("Could not resolve page IDs for sections.");
await upsert("page_sections", sections as Record<string, unknown>[], "page_id,section_key");

const assetRoot = path.join(root, "src", "assets");
const manifestPaths = await walkManifests(assetRoot);
const assetRecords: Record<string, unknown>[] = [];
for (const fullPath of manifestPaths) {
  const parsed = JSON.parse(await readFile(fullPath, "utf8")) as Record<string, unknown>;
  const sourceUrl = parsed["url"];
  const assetId = parsed["asset_id"];
  const projectId = parsed["project_id"];
  const contentType = parsed["content_type"];
  if (
    typeof sourceUrl !== "string" ||
    !sourceUrl.startsWith("/__l5e/assets-v1/") ||
    typeof assetId !== "string" ||
    typeof projectId !== "string" ||
    typeof contentType !== "string"
  ) {
    throw new Error(`Invalid source asset manifest: ${path.relative(root, fullPath)}`);
  }
  assetRecords.push({
    manifest_path: path.relative(root, fullPath).split(path.sep).join("/"),
    asset_id: assetId,
    source_url: sourceUrl,
    source_origin: publicSiteUrl,
    storage_key: typeof parsed["r2_key"] === "string" ? parsed["r2_key"] : null,
    original_filename: typeof parsed["original_filename"] === "string" ? parsed["original_filename"] : null,
    expected_mime: contentType,
    declared_size: typeof parsed["size"] === "number" ? parsed["size"] : null,
    migration_status: "pending_source_access",
    failure_reason: "Original binary is not present in the repository; source access and binary verification are pending.",
    updated_at: now,
  });
}
await upsert("asset_migration_inventory", assetRecords, "manifest_path");

const existing = await rest("site_publication_state", {
  select: "published_revision",
  singleton_key: "eq.primary",
  limit: "1",
});
const currentRevision = Array.isArray(existing) && existing.length > 0
  ? Number((existing[0] as Record<string, unknown>)["published_revision"] ?? 0)
  : 0;
await rest("site_publication_state", { singleton_key: "eq.primary" }, "PATCH", {
  published_revision: currentRevision + 1,
  published_at: new Date().toISOString(),
}, "return=minimal");

const reconciled = {
  generated_at: new Date().toISOString(),
  source: "src/lib/content.ts",
  public_site_origin: publicSiteUrl,
  imported_counts: {
    pages: pageRows.length,
    home_sections: homeSections.length,
    page_sections: sections.length,
    projects: projects.length,
    clients: clients.length,
    metrics: metrics.length,
    experience: experience.length,
    skills: skills.length,
    discipline_groups: disciplines.length,
    discipline_items: disciplines.reduce((sum, group) => sum + group.items.length, 0),
    services: services.length,
    principles: principles.length,
    process_steps: process.length,
    capabilities: capabilities.length,
    project_types: projectTypes.length,
    budget_currencies: Object.keys(budgets).length,
    legacy_asset_manifests: assetRecords.length,
    logos_missing_by_design: clients.filter((item) => !item.logo).map((item) => item.name),
  },
  asset_migration: {
    migrated: 0,
    pending_source_access: assetRecords.length,
    note: "No legacy binary was deleted or replaced. Confirm source access, MIME, dimensions and SHA-256 before changing any public reference.",
  },
  published_revision: currentRevision + 1,
};
if (projects.length !== 4 || clients.length !== 20 || assetRecords.length !== 41) {
  throw new Error("Reconciliation guard failed: expected 4 projects, 20 clients and 41 asset manifests.");
}
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(reconciled, null, 2) + "\n", "utf8");
console.log("CMS import completed and reconciled.");
console.log(JSON.stringify(reconciled.imported_counts));
