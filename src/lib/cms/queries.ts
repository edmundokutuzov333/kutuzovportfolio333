import {
  CapabilitiesSchema,
  ClientRowSchema,
  ContactStepsSchema,
  DisciplineSchema,
  ExperienceRowSchema,
  MetricSchema,
  PageSchema,
  PageSectionSchema,
  PrincipleSchema,
  ProcessStepSchema,
  ProfileSchema,
  ProjectRowSchema,
  ProjectTypesSchema,
  PublicationStateSchema,
  ServiceRowSchema,
  SkillSchema,
  BudgetsSchema,
  NavigationSettingSchema,
  FooterSettingSchema,
  PresentationSettingSchema,
  DEFAULT_PUBLIC_PRESENTATION,
  toClient,
  toDisciplineGroup,
  toExperience,
  toPrinciple,
  toProcessStep,
  toProject,
  toService,
  type CmsPage,
  type PageSection,
  type Profile,
  type Project,
  type Service,
  type Client,
  type Metric,
  type ExperienceItem,
  type Skill,
  type DisciplineGroup,
  type Principle,
  type ProcessStep,
  type ContactStep,
} from "./types";
import { selectPublicRows } from "./public-client";

export class CmsContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsContentError";
  }
}

async function firstRow<T>(
  table: Parameters<typeof selectPublicRows>[0],
  query: Record<string, string>,
  schema: { parse(value: unknown): T },
  label: string,
): Promise<T> {
  const rows = await selectPublicRows(table, { ...query, limit: "1" });
  if (rows.length === 0) throw new CmsContentError(`Published content is missing: ${label}.`);
  return schema.parse(rows[0]);
}

async function settingsValue<T>(
  key: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const rows = await selectPublicRows("site_settings", {
    select: "setting_value",
    setting_key: `eq.${key}`,
    is_public: "eq.true",
    limit: "1",
  });
  if (rows.length === 0) throw new CmsContentError(`Published setting is missing: ${key}.`);
  const record = rows[0] as { setting_value?: unknown };
  return schema.parse(record.setting_value);
}

export async function getPublishedPage(routePath: string): Promise<CmsPage> {
  return firstRow(
    "pages",
    { select: "id,slug,route_path,title,locale,status,seo_title,seo_description,canonical_url,og_image_path", route_path: `eq.${routePath}`, status: "eq.published" },
    PageSchema,
    `page ${routePath}`,
  );
}

export async function getPageSections(pageId: string): Promise<PageSection[]> {
  const rows = await selectPublicRows("page_sections", {
    select: "id,page_id,section_key,section_type,position,is_visible,config",
    page_id: `eq.${pageId}`,
    is_visible: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => PageSectionSchema.parse(row));
}

export async function getPublishedProfile(): Promise<Profile> {
  const row = await firstRow(
    "profile_content",
    { select: "name,role,roles,location,address,public_email,phone,whatsapp,socials,headline,intro", is_published: "eq.true" },
    {
      parse(value: unknown) {
        const raw = value as Record<string, unknown>;
        return ProfileSchema.parse({ ...raw, title: raw["role"], email: raw["public_email"] });
      },
    },
    "profile",
  );
  return row;
}

export async function getMetrics(): Promise<Metric[]> {
  const rows = await selectPublicRows("metrics", {
    select: "id,value,label,note,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => MetricSchema.parse(row));
}

export async function getExperience(): Promise<ExperienceItem[]> {
  const rows = await selectPublicRows("experience_items", {
    select: "id,organisation,role,period,description,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => toExperience(ExperienceRowSchema.parse(row)));
}

export async function getSkills(): Promise<Skill[]> {
  const rows = await selectPublicRows("skills", {
    select: "id,name,value,tier,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => SkillSchema.parse(row));
}

export async function getDisciplines(): Promise<DisciplineGroup[]> {
  const rows = await selectPublicRows("disciplines", {
    select: "id,name,description,items,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => toDisciplineGroup(DisciplineSchema.parse(row)));
}

export async function getPrinciples(): Promise<Principle[]> {
  const rows = await selectPublicRows("principles", {
    select: "id,title,description,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => toPrinciple(PrincipleSchema.parse(row)));
}

export async function getServices(): Promise<Service[]> {
  const rows = await selectPublicRows("services", {
    select: "id,slug,title,description,details,number_label,line,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => toService(ServiceRowSchema.parse(row)));
}

export async function getProcessSteps(): Promise<ProcessStep[]> {
  const rows = await selectPublicRows("process_steps", {
    select: "id,step_key,title,description,number_label,position",
    is_published: "eq.true",
    order: "position.asc",
  });
  return rows.map((row) => toProcessStep(ProcessStepSchema.parse(row)));
}

export async function getClients(context: "home" | "clients" | "all" = "all"): Promise<Client[]> {
  const filters: Record<string, string> = {
    select: "id,slug,name,logo_path,logo_alt,display_as_text,position,is_visible,show_on_home,show_on_clients_page",
    is_visible: "eq.true",
    order: "position.asc",
  };
  if (context === "home") filters["show_on_home"] = "eq.true";
  if (context === "clients") filters["show_on_clients_page"] = "eq.true";
  const rows = await selectPublicRows("clients", filters);
  return rows.map((row) => toClient(ClientRowSchema.parse(row)));
}

export async function getProjects(featuredOnly = false): Promise<Project[]> {
  const filters: Record<string, string> = {
    select: "id,slug,title,client_label,year_label,discipline,project_type,summary,challenge,idea,outcome,cover_path,cover_alt,gallery,gallery_alt,featured,position,status,hue,locale",
    status: "eq.published",
    order: "position.asc",
  };
  if (featuredOnly) filters["featured"] = "eq.true";
  let rows: unknown[];
  try {
    rows = await selectPublicRows("projects", filters);
  } catch {
    // Rolling deploy compatibility: an un-applied additive gallery_alt migration must not break public pages.
    const legacyFilters = { ...filters, select: "id,slug,title,client_label,year_label,discipline,project_type,summary,challenge,idea,outcome,cover_path,cover_alt,gallery,featured,position,status,hue,locale" };
    rows = await selectPublicRows("projects", legacyFilters);
  }
  return rows.map((row) => toProject(ProjectRowSchema.parse(row)));
}

export async function getPublishedProject(slug: string): Promise<Project | null> {
  const filters: Record<string, string> = {
    select: "id,slug,title,client_label,year_label,discipline,project_type,summary,challenge,idea,outcome,cover_path,cover_alt,gallery,gallery_alt,featured,position,status,hue,locale",
    slug: `eq.${slug}`,
    status: "eq.published",
    limit: "1",
  };
  let rows: unknown[];
  try {
    rows = await selectPublicRows("projects", filters);
  } catch {
    // Keep the route online until the additive gallery_alt column is applied.
    rows = await selectPublicRows("projects", { ...filters, select: "id,slug,title,client_label,year_label,discipline,project_type,summary,challenge,idea,outcome,cover_path,cover_alt,gallery,featured,position,status,hue,locale" });
  }
  if (rows.length === 0) return null;
  return toProject(ProjectRowSchema.parse(rows[0]));
}

export async function getActiveSlugRedirect(oldSlug: string): Promise<string | null> {
  const rows = await selectPublicRows("slug_redirects", {
    select: "new_slug",
    old_slug: `eq.${oldSlug}`,
    is_active: "eq.true",
    limit: "1",
  });
  if (rows.length === 0) return null;
  const target = rows[0] as { new_slug?: unknown };
  return typeof target.new_slug === "string" ? target.new_slug : null;
}

export async function getBudgets() {
  return settingsValue("budgets", BudgetsSchema);
}

export async function getProjectTypes() {
  return settingsValue("project_types", ProjectTypesSchema);
}

export async function getCapabilities() {
  return settingsValue("capabilities", CapabilitiesSchema);
}

export async function getContactSteps(): Promise<ContactStep[]> {
  return settingsValue("contact_steps", ContactStepsSchema);
}

export async function getPublicPresentation() {
  const read = async (key: "navigation" | "footer" | "presentation") => {
    try {
      const rows = await selectPublicRows("site_settings", {
        select: "setting_value",
        setting_key: `eq.${key}`,
        is_public: "eq.true",
        limit: "1",
      });
      return rows.length > 0 ? (rows[0] as { setting_value?: unknown }).setting_value : undefined;
    } catch {
      // The versioned presentation-settings migration may not have reached this runtime yet.
      return undefined;
    }
  };
  const [navigation, footer, presentation] = await Promise.all([
    read("navigation"), read("footer"), read("presentation"),
  ]);
  return {
    navigation: NavigationSettingSchema.safeParse(navigation).success
      ? NavigationSettingSchema.parse(navigation)
      : DEFAULT_PUBLIC_PRESENTATION.navigation,
    footer: FooterSettingSchema.safeParse(footer).success
      ? FooterSettingSchema.parse(footer)
      : DEFAULT_PUBLIC_PRESENTATION.footer,
    presentation: PresentationSettingSchema.safeParse(presentation).success
      ? PresentationSettingSchema.parse(presentation)
      : DEFAULT_PUBLIC_PRESENTATION.presentation,
  };
}

export async function getPublishedRevision(): Promise<number> {
  const rows = await selectPublicRows("site_publication_state", {
    select: "published_revision",
    singleton_key: "eq.primary",
    limit: "1",
  });
  if (rows.length === 0) throw new CmsContentError("Published revision state is missing.");
  return PublicationStateSchema.parse(rows[0]).published_revision;
}

export async function loadPage(routePath: string) {
  const page = await getPublishedPage(routePath);
  const [profile, sections] = await Promise.all([
    getPublishedProfile(),
    getPageSections(page.id),
  ]);
  return { page, profile, sections };
}
