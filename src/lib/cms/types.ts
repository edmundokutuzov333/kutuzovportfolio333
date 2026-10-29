import { z } from "zod";

export const SocialLinkSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().url().max(2048),
});
export type SocialLink = z.infer<typeof SocialLinkSchema>;

export const ProfileSchema = z.object({
  name: z.string().min(1).max(180),
  title: z.string().min(1).max(180),
  roles: z.array(z.string().min(1).max(180)),
  location: z.string().min(1).max(240),
  address: z.string().min(1).max(320),
  email: z.string().email(),
  phone: z.string().min(1).max(80),
  whatsapp: z.string().url(),
  socials: z.array(SocialLinkSchema),
  headline: z.string().min(1).max(600),
  intro: z.string().min(1).max(2400),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PageSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(240),
  route_path: z.string().min(1).max(300),
  title: z.string().min(1).max(240),
  locale: z.string().min(2).max(16),
  status: z.enum(["draft", "published", "archived"]),
  seo_title: z.string().max(300).nullable(),
  seo_description: z.string().max(1000).nullable(),
  canonical_url: z.string().url().nullable(),
  og_image_path: z.string().nullable(),
});
export type CmsPage = z.infer<typeof PageSchema>;

export const PageSectionTypeSchema = z.enum([
  "hero",
  "manifesto",
  "featured_work",
  "services",
  "metrics",
  "clients",
  "principles",
  "experience",
  "skills",
  "process",
  "contact_cta",
  "rich_text",
]);
export type PageSectionType = z.infer<typeof PageSectionTypeSchema>;

const HeroConfigSchema = z.object({
  eyebrow: z.string().max(180).default(""),
  lines: z.array(z.string().max(180)).max(6).default([]),
  intro: z.string().max(2400).optional(),
});
const RichTextConfigSchema = z.object({
  paragraphs: z.array(z.string().min(1).max(4000)).min(1).max(12),
});
const ManifestoConfigSchema = z.object({ label: z.string().min(1).max(180) });
const FeaturedWorkConfigSchema = z.object({
  label: z.string().min(1).max(180),
  title_lines: z.array(z.string().min(1).max(180)).min(1).max(4),
  link_label: z.string().min(1).max(80),
});
const ServicesSectionConfigSchema = z.object({ label: z.string().min(1).max(180) });
const MetricsSectionConfigSchema = z.object({});
const ClientsSectionConfigSchema = z.object({
  label: z.string().min(1).max(180),
  title_lines: z.array(z.string().min(1).max(180)).min(1).max(4),
  link_label: z.string().min(1).max(80),
});
const PrinciplesSectionConfigSchema = z.object({});

const PageSectionBaseSchema = z.object({
  id: z.string().uuid(),
  page_id: z.string().uuid(),
  section_key: z.string().min(1).max(80),
  position: z.number().int().nonnegative(),
  is_visible: z.boolean(),
});

export const PageSectionSchema = z.discriminatedUnion("section_type", [
  PageSectionBaseSchema.extend({
    section_type: z.literal("hero"),
    config: HeroConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("rich_text"),
    config: RichTextConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("manifesto"),
    config: ManifestoConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("featured_work"),
    config: FeaturedWorkConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("services"),
    config: ServicesSectionConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("metrics"),
    config: MetricsSectionConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("clients"),
    config: ClientsSectionConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("principles"),
    config: PrinciplesSectionConfigSchema,
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("experience"),
    config: z.record(z.string(), z.unknown()),
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("skills"),
    config: z.record(z.string(), z.unknown()),
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("process"),
    config: z.record(z.string(), z.unknown()),
  }),
  PageSectionBaseSchema.extend({
    section_type: z.literal("contact_cta"),
    config: z.record(z.string(), z.unknown()),
  }),
]);
export type PageSection = z.infer<typeof PageSectionSchema>;
export type HeroSection = Extract<PageSection, { section_type: "hero" }>;

export const ProjectRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(240),
  title: z.string().min(1).max(240),
  client_label: z.string().nullable(),
  year_label: z.string().nullable(),
  discipline: z.string().nullable(),
  project_type: z.string().nullable(),
  summary: z.string().nullable(),
  challenge: z.string().nullable(),
  idea: z.string().nullable(),
  outcome: z.string().nullable(),
  cover_path: z.string().nullable(),
  cover_alt: z.string().nullable(),
  gallery: z.array(z.string()),
  featured: z.boolean(),
  position: z.number().int().nonnegative(),
  status: z.enum(["draft", "published", "archived"]),
  hue: z.number().int().min(0).max(360),
  locale: z.string().min(2).max(16),
});
export type ProjectRow = z.infer<typeof ProjectRowSchema>;
export type Project = {
  id: string;
  slug: string;
  title: string;
  client: string;
  year: string;
  discipline: string;
  projectType: string;
  summary: string;
  challenge: string;
  idea: string;
  outcome: string;
  cover: string | null;
  coverAlt: string;
  gallery: string[];
  featured: boolean;
  position: number;
  hue: number;
  locale: string;
};
export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    client: row.client_label ?? "",
    year: row.year_label ?? "",
    discipline: row.discipline ?? "",
    projectType: row.project_type ?? "",
    summary: row.summary ?? "",
    challenge: row.challenge ?? "",
    idea: row.idea ?? "",
    outcome: row.outcome ?? "",
    cover: row.cover_path,
    coverAlt: row.cover_alt ?? row.title,
    gallery: row.gallery,
    featured: row.featured,
    position: row.position,
    hue: row.hue,
    locale: row.locale,
  };
}

export const ClientRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string().min(1).max(180),
  logo_path: z.string().nullable(),
  logo_alt: z.string().nullable(),
  position: z.number().int().nonnegative(),
  is_visible: z.boolean(),
  show_on_home: z.boolean(),
  show_on_clients_page: z.boolean(),
});
export type Client = {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  logoAlt: string;
  position: number;
  showOnHome: boolean;
  showOnClientsPage: boolean;
};
export function toClient(row: z.infer<typeof ClientRowSchema>): Client {
  return {
    id: row.position + 1,
    slug: row.slug,
    name: row.name,
    logo: row.logo_path,
    logoAlt: row.logo_alt ?? row.name,
    position: row.position,
    showOnHome: row.show_on_home,
    showOnClientsPage: row.show_on_clients_page,
  };
}

export const MetricSchema = z.object({
  id: z.string().uuid(),
  value: z.string().min(1).max(80),
  label: z.string().min(1).max(140),
  note: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type Metric = z.infer<typeof MetricSchema>;

export const ExperienceRowSchema = z.object({
  id: z.string().uuid(),
  organisation: z.string().min(1).max(180),
  role: z.string().min(1).max(180),
  period: z.string().nullable(),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type ExperienceItem = {
  company: string;
  period: string;
  role: string;
  text: string;
  position: number;
};
export function toExperience(row: z.infer<typeof ExperienceRowSchema>): ExperienceItem {
  return {
    company: row.organisation,
    period: row.period ?? "",
    role: row.role,
    text: row.description ?? "",
    position: row.position,
  };
}

export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(140),
  value: z.number().int().min(0).max(100),
  tier: z.string().min(1).max(80),
  position: z.number().int().nonnegative(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const DisciplineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(140),
  description: z.string().nullable(),
  items: z.array(z.string()),
  position: z.number().int().nonnegative(),
});
export type DisciplineGroup = {
  group: string;
  items: string[];
  position: number;
};
export function toDisciplineGroup(row: z.infer<typeof DisciplineSchema>): DisciplineGroup {
  return { group: row.name, items: row.items, position: row.position };
}

export const ServiceRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string().min(1).max(180),
  description: z.string(),
  details: z.array(z.string()),
  number_label: z.string().nullable(),
  line: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type Service = {
  n: string;
  slug: string;
  title: string;
  line: string;
  text: string;
  deliverables: string[];
  position: number;
};
export function toService(row: z.infer<typeof ServiceRowSchema>): Service {
  return {
    n: row.number_label ?? String(row.position + 1).padStart(2, "0"),
    slug: row.slug,
    title: row.title,
    line: row.line ?? "",
    text: row.description,
    deliverables: row.details,
    position: row.position,
  };
}

export const ProcessStepSchema = z.object({
  id: z.string().uuid(),
  step_key: z.string(),
  title: z.string().min(1).max(180),
  description: z.string(),
  number_label: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type ProcessStep = {
  n: string;
  title: string;
  text: string;
  position: number;
};
export function toProcessStep(row: z.infer<typeof ProcessStepSchema>): ProcessStep {
  return {
    n: row.number_label ?? String(row.position + 1).padStart(2, "0"),
    title: row.title,
    text: row.description,
    position: row.position,
  };
}

export const PrincipleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(180),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type Principle = { title: string; text: string; position: number };
export function toPrinciple(row: z.infer<typeof PrincipleSchema>): Principle {
  return { title: row.title, text: row.description ?? "", position: row.position };
}

export const PublicationStateSchema = z.object({
  published_revision: z.coerce.number().int().nonnegative(),
});
export type PublicationState = z.infer<typeof PublicationStateSchema>;

export const BudgetsSchema = z.record(z.string(), z.array(z.string()));
export const ProjectTypesSchema = z.array(z.string().min(1).max(180));
export const CapabilitiesSchema = z.array(z.string().min(1).max(180));
export const ContactStepsSchema = z.array(z.object({
  k: z.string().min(1).max(80),
  t: z.string().min(1).max(240),
  d: z.string().min(1).max(600),
}));
export type ContactStep = z.infer<typeof ContactStepsSchema>[number];
