import {
  getBudgets,
  getCapabilities,
  getClients,
  getContactSteps,
  getDisciplines,
  getExperience,
  getMetrics,
  getPrinciples,
  getProcessSteps,
  getProjects,
  getProjectTypes,
  getPublishedPage,
  getPublishedProfile,
  getPageSections,
  getPublishedProject,
  getActiveSlugRedirect,
  getServices,
  getSkills,
  loadPage,
  CmsContentError,
} from "./queries";
import type { PageSection } from "./types";

const HOME_SECTION_TYPES = new Set([
  "hero",
  "manifesto",
  "featured_work",
  "services",
  "metrics",
  "clients",
  "principles",
]);

function assertHomeSections(sections: PageSection[]): void {
  const unsupported = sections.find((section) => !HOME_SECTION_TYPES.has(section.section_type));
  if (unsupported) {
    throw new CmsContentError(
      `Unsupported Home section type: ${unsupported.section_type} (${unsupported.section_key}).`,
    );
  }
}

export async function loadHomeContent() {
  const base = await loadPage("/");
  assertHomeSections(base.sections);
  const [projects, metrics, principles, services, clients, capabilities] = await Promise.all([
    getProjects(),
    getMetrics(),
    getPrinciples(),
    getServices(),
    getClients("home"),
    getCapabilities(),
  ]);
  return { ...base, projects, metrics, principles, services, clients, capabilities };
}

export async function loadWorkContent() {
  const base = await loadPage("/work");
  const projects = await getProjects();
  return { ...base, projects };
}

export async function loadProjectDetailContent(slug: string) {
  const project = await getPublishedProject(slug);
  if (!project) {
    return { project: null, redirectSlug: await getActiveSlugRedirect(slug) };
  }
  const [base, projects] = await Promise.all([
    loadPage("/work/:slug"),
    getProjects(),
  ]);
  return { ...base, project, projects };
}

export async function loadAboutContent() {
  const base = await loadPage("/about");
  const [metrics, experience, skills, disciplines, principles] = await Promise.all([
    getMetrics(),
    getExperience(),
    getSkills(),
    getDisciplines(),
    getPrinciples(),
  ]);
  return { ...base, metrics, experience, skills, disciplines, principles };
}

export async function loadServicesContent() {
  const base = await loadPage("/services");
  const services = await getServices();
  return { ...base, services };
}

export async function loadProcessContent() {
  const base = await loadPage("/process");
  const process = await getProcessSteps();
  return { ...base, process };
}

export async function loadClientsContent() {
  const base = await loadPage("/clients");
  const clients = await getClients("clients");
  return { ...base, clients };
}

export async function loadContactContent() {
  const base = await loadPage("/contact");
  const [budgets, projectTypes, contactSteps] = await Promise.all([
    getBudgets(),
    getProjectTypes(),
    getContactSteps(),
  ]);
  return { ...base, budgets, projectTypes, contactSteps };
}
