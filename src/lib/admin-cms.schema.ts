import { z } from "zod";

export const ADMIN_ENTITY_KEYS = [
  "pages", "page_sections", "projects", "clients", "profile_content",
  "experience_items", "metrics", "skills", "disciplines", "principles",
  "services", "process_steps", "site_settings",
] as const;

export const AdminEntitySchema = z.enum(ADMIN_ENTITY_KEYS);
export type AdminEntity = z.infer<typeof AdminEntitySchema>;
export type AdminAction = "create" | "update" | "publish" | "archive" | "restore";

export const AdminMutationInputSchema = z.object({
  entity: AdminEntitySchema,
  action: z.enum(["create", "update", "publish", "archive", "restore"]),
  id: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  note: z.string().trim().max(500).nullable().optional(),
}).strict();

const slug = z.string().trim().min(1).max(240)
  .regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/, "Use apenas letras minúsculas, números, hífen ou barra no slug.");
const nullableText = (max: number) => z.union([z.string().max(max), z.null()]);
const assetPath = z.union([z.string().max(2048), z.null()]).refine((value) => {
  if (value === null || value === "") return true;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !value.split("/").some((part) => part === "..") && Array.from(value).every((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; });
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Use um caminho de asset local ou um URL HTTPS seguro.");

const pageSchema = z.object({
  slug, route_path: z.enum(["/", "/work", "/work/:slug", "/about", "/services", "/process", "/clients", "/contact"]),
  title: z.string().trim().min(1).max(240), locale: z.string().trim().min(2).max(16),
  status: z.enum(["draft", "published", "archived"]),
  seo_title: nullableText(300), seo_description: nullableText(1000),
  canonical_url: z.union([z.string().url().max(2048), z.null()]),
  og_image_path: assetPath,
}).partial().strict();

const sectionTypes = ["hero", "manifesto", "featured_work", "services", "metrics", "clients", "principles", "experience", "skills", "process", "contact_cta", "rich_text"] as const;
const sectionSchema = z.object({
  page_id: z.string().uuid(), section_key: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  section_type: z.enum(sectionTypes), position: z.number().int().min(0),
  is_visible: z.boolean(), config: z.record(z.string(), z.unknown()),
}).partial().strict();

const projectSchema = z.object({
  slug, title: z.string().trim().min(1).max(240),
  client_id: z.union([z.string().uuid(), z.null()]),
  client_label: nullableText(180), year_label: nullableText(80), discipline: nullableText(180),
  project_type: nullableText(180), summary: nullableText(4000), challenge: nullableText(4000),
  idea: nullableText(4000), outcome: nullableText(4000), cover_path: assetPath,
  cover_alt: nullableText(300), gallery: z.array(z.string().max(2048)).max(40), gallery_alt: z.array(z.string().trim().max(300)).max(40),
  featured: z.boolean(), position: z.number().int().min(0),
  status: z.enum(["draft", "published", "archived"]),
  hue: z.number().int().min(0).max(360), locale: z.string().trim().min(2).max(16),
}).partial().strict();

const clientSchema = z.object({
  slug, name: z.string().trim().min(1).max(180),
  logo_path: assetPath, logo_alt: nullableText(300), display_as_text: z.boolean(),
  position: z.number().int().min(0), show_on_home: z.boolean(),
  show_on_clients_page: z.boolean(), is_visible: z.boolean(),
}).partial().strict();

const profileSchema = z.object({
  name: z.string().trim().min(1).max(180), role: nullableText(180),
  roles: z.array(z.string().trim().min(1).max(180)).max(30),
  biography: nullableText(8000), location: nullableText(240), address: nullableText(320),
  public_email: z.union([z.string().email().max(320), z.null()]),
  phone: nullableText(80), whatsapp: z.union([z.string().url().max(2048), z.null()]),
  portrait_path: assetPath, socials: z.array(z.object({
    label: z.string().trim().min(1).max(80), href: z.string().url().max(2048),
  }).strict()).max(30),
  headline: nullableText(600), intro: nullableText(2400), is_published: z.boolean(),
}).partial().strict();

const experienceSchema = z.object({
  organisation: z.string().trim().min(1).max(180), role: z.string().trim().min(1).max(180),
  period: nullableText(120), description: nullableText(4000),
  position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const metricSchema = z.object({
  label: z.string().trim().min(1).max(140), value: z.string().trim().min(1).max(80),
  note: nullableText(500), position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const skillSchema = z.object({
  name: z.string().trim().min(1).max(140), value: z.union([z.number().int().min(0).max(100), z.null()]),
  tier: nullableText(80), level: nullableText(80), category: nullableText(120),
  position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const disciplineSchema = z.object({
  name: z.string().trim().min(1).max(140), description: nullableText(2000),
  items: z.array(z.string().trim().min(1).max(180)).max(100),
  position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const principleSchema = z.object({
  title: z.string().trim().min(1).max(180), description: nullableText(2000),
  position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const serviceSchema = z.object({
  slug, title: z.string().trim().min(1).max(180), description: z.string().max(4000),
  details: z.array(z.string().trim().min(1).max(240)).max(20),
  number_label: nullableText(32), line: nullableText(300),
  position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const processSchema = z.object({
  step_key: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().trim().min(1).max(180), description: z.string().max(3000),
  number_label: nullableText(32), position: z.number().int().min(0), is_published: z.boolean(),
}).partial().strict();
const settingsSchema = z.object({
  setting_value: z.unknown(), is_public: z.boolean(),
}).partial().strict();

const schemas: Record<AdminEntity, z.ZodObject<z.ZodRawShape>> = {
  pages: pageSchema as unknown as z.ZodObject<z.ZodRawShape>,
  page_sections: sectionSchema as unknown as z.ZodObject<z.ZodRawShape>,
  projects: projectSchema as unknown as z.ZodObject<z.ZodRawShape>,
  clients: clientSchema as unknown as z.ZodObject<z.ZodRawShape>,
  profile_content: profileSchema as unknown as z.ZodObject<z.ZodRawShape>,
  experience_items: experienceSchema as unknown as z.ZodObject<z.ZodRawShape>,
  metrics: metricSchema as unknown as z.ZodObject<z.ZodRawShape>,
  skills: skillSchema as unknown as z.ZodObject<z.ZodRawShape>,
  disciplines: disciplineSchema as unknown as z.ZodObject<z.ZodRawShape>,
  principles: principleSchema as unknown as z.ZodObject<z.ZodRawShape>,
  services: serviceSchema as unknown as z.ZodObject<z.ZodRawShape>,
  process_steps: processSchema as unknown as z.ZodObject<z.ZodRawShape>,
  site_settings: settingsSchema as unknown as z.ZodObject<z.ZodRawShape>,
};

const requiredOnCreate: Partial<Record<AdminEntity, string[]>> = {
  pages: ["slug", "route_path", "title", "locale", "status"],
  page_sections: ["page_id", "section_key", "section_type", "position", "is_visible", "config"],
  projects: ["slug", "title", "position", "status"],
  clients: ["slug", "name", "position", "is_visible"],
  profile_content: ["name"],
  experience_items: ["organisation", "role", "position"],
  metrics: ["label", "value", "position"],
  skills: ["name", "position"],
  disciplines: ["name", "position", "items"],
  principles: ["title", "position"],
  services: ["slug", "title", "description", "details", "position"],
  process_steps: ["step_key", "title", "description", "position"],
};

export function validateAdminPayload(
  entity: AdminEntity,
  incoming: Record<string, unknown>,
  action: AdminAction,
  options: { creating?: boolean; publicSiteUrl?: string } = {},
): Record<string, unknown> {
  if (action === "archive") return {};
  const reserved = ["id", "created_at", "updated_at", "created_by", "updated_by", "singleton_key"];
  const snapshotKeys = new Set<string>(schemas[entity].keyof().options as string[]);
  const clean = action === "restore"
    ? Object.fromEntries(Object.entries(incoming).filter(([key]) => !reserved.includes(key) && snapshotKeys.has(key)))
    : incoming;
  const parsed = schemas[entity].parse(clean);
  if (options.creating) {
    if (entity === "site_settings") throw new Error("As definições existentes não podem ser recriadas.");
    const required = requiredOnCreate[entity] ?? [];
    const missing = required.filter((key) => parsed[key] === undefined || parsed[key] === null || parsed[key] === "");
    if (missing.length) throw new Error("Campos obrigatórios em falta: " + missing.join(", ") + ".");
  }

  if (entity === "pages" && parsed["route_path"] !== undefined) {
    const supportedRoutes = new Set(["/", "/work", "/work/:slug", "/about", "/services", "/process", "/clients", "/contact"]);
    if (!supportedRoutes.has(String(parsed["route_path"]))) throw new Error("A rota não tem um renderer público suportado.");
  }

  if (entity === "page_sections") {
    const type = parsed["section_type"];
    if (type !== undefined && !sectionTypes.includes(type as typeof sectionTypes[number])) {
      throw new Error("Tipo de secção não suportado.");
    }
    const config = parsed["config"];
    if (type !== undefined && config !== undefined) {
      const value = config as Record<string, unknown>;
      const configSchemas: Partial<Record<typeof sectionTypes[number], z.ZodTypeAny>> = {
        hero: z.object({ eyebrow: z.string().max(180).optional(), lines: z.array(z.string().max(180)).max(6).optional(), intro: z.string().max(2400).optional() }).strict(),
        manifesto: z.object({ label: z.string().min(1).max(180) }).strict(),
        featured_work: z.object({ label: z.string().min(1).max(180), title_lines: z.array(z.string().min(1).max(180)).min(1).max(4), link_label: z.string().min(1).max(80) }).strict(),
        services: z.object({ label: z.string().min(1).max(180) }).strict(),
        metrics: z.object({}).strict(),
        clients: z.object({ label: z.string().min(1).max(180), title_lines: z.array(z.string().min(1).max(180)).min(1).max(4), link_label: z.string().min(1).max(80) }).strict(),
        principles: z.object({}).strict(),
        rich_text: z.object({ paragraphs: z.array(z.string().min(1).max(4000)).min(1).max(12) }).strict(),
        experience: z.record(z.string(), z.unknown()),
        skills: z.record(z.string(), z.unknown()),
        process: z.record(z.string(), z.unknown()),
        contact_cta: z.record(z.string(), z.unknown()),
      };
      const configSchema = configSchemas[type as typeof sectionTypes[number]];
      if (!configSchema) throw new Error("Não existe um editor tipado para este tipo de secção.");
      configSchema.parse(value);
    }
  }

  if (entity === "pages" && parsed["canonical_url"]) {
    const configuredOrigin = options.publicSiteUrl?.trim();
    if (!configuredOrigin) throw new Error("PUBLIC_SITE_URL não está configurada no servidor; não é seguro definir o canonical.");
    let expectedOrigin: string;
    let actualOrigin: string;
    try {
      const expected = new URL(configuredOrigin);
      const actual = new URL(String(parsed["canonical_url"]));
      if (expected.pathname !== "/" || expected.search || expected.hash) throw new Error("canonical_origin_must_be_origin_only");
      if (expected.protocol !== "https:" || actual.protocol !== "https:") throw new Error("https_required");
      expectedOrigin = expected.origin;
      actualOrigin = actual.origin;
    } catch {
      throw new Error("PUBLIC_SITE_URL e o canonical devem ser URLs HTTPS válidos.");
    }
    if (actualOrigin !== expectedOrigin) throw new Error("O canonical deve usar a origem definida em PUBLIC_SITE_URL.");
  }

  for (const key of ["og_image_path", "logo_path", "cover_path", "portrait_path"]) {
    const value = parsed[key];
    if (value !== undefined) assetPath.parse(value);
  }
  if (Array.isArray(parsed["gallery"])) {
    parsed["gallery"].forEach((value) => assetPath.parse(value));
  }
  for (const key of ["socials"]) {
    const value = parsed[key];
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "object" && entry !== null && "href" in entry) {
          const href = String((entry as Record<string, unknown>)["href"]);
          if (!href.startsWith("https://")) throw new Error("Os links públicos devem usar HTTPS.");
        }
      });
    }
  }
  return parsed;
}
