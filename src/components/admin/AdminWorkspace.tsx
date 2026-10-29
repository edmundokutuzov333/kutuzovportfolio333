import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, Archive, ArrowDown, ArrowUp, BookOpen, Check, ChevronRight,
  Clock3, Contact, Database, FileImage, FileText, Globe2, History,
  LayoutDashboard, LogOut, Mail, RefreshCw, Save, Search, Settings2,
  ShieldCheck, Users, BriefcaseBusiness, Layers3, Wrench,
} from "lucide-react";

import {
  loadAdminWorkspaceFn,
  mutateAdminContentFn,
  reorderAdminContentFn,
  updateContactSubmissionFn,
} from "@/lib/admin-cms.functions";
import type { AdminEntity } from "@/lib/admin-cms.schema";
import { getRestorableSnapshot } from "@/lib/admin-revisions";
import { ContactInboxView as InboxView, EmailOutboxView, MediaLibraryView as MediaView, NewsletterManagementView as NewsletterView } from "@/components/admin/Phase4Modules";

type Row = Record<string, unknown>;
type TableState = { rows: Row[]; error: string | null };
type Workspace = {
  actor: { id: string; email: string };
  tables: Record<string, TableState>;
  storage?: { status: string; buckets?: Array<{ id: string; name: string; public: boolean }>; error?: string };
  loadedAt: string;
};
type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "checkbox" | "json" | "select" | "email" | "url";
  required?: boolean;
  nullable?: boolean;
  help?: string;
  options?: Array<{ value: string; label: string }>;
};
type ModuleId =
  | "overview" | "pages" | "sections" | "projects" | "clients" | "profile"
  | "experience" | "metrics" | "skills" | "disciplines" | "principles"
  | "services" | "process" | "settings" | "history" | "inbox" | "media" | "newsletter" | "mail";
type ModuleDef = {
  id: ModuleId;
  label: string;
  description: string;
  table?: string;
  entity?: AdminEntity;
  fields?: Field[];
  create?: boolean;
  reorder?: boolean;
  icon: typeof LayoutDashboard;
};

const routeOptions = [
  { value: "/", label: "Home /" },
  { value: "/work", label: "Work /work" },
  { value: "/work/:slug", label: "Detalhe de projecto /work/:slug" },
  { value: "/about", label: "Perfil /about" },
  { value: "/services", label: "Serviços /services" },
  { value: "/process", label: "Processo /process" },
  { value: "/clients", label: "Clientes /clients" },
  { value: "/contact", label: "Contacto /contact" },
];
const homeSectionTypes = ["hero", "manifesto", "featured_work", "services", "metrics", "clients", "principles"];
const homeSectionTypeOptions = homeSectionTypes.map((value) => ({ value, label: value }));
const allRendererSectionTypes = ["hero", "rich_text"];
const aboutRichTextTypeOptions = ["rich_text"].map((value) => ({ value, label: value }));
const statusOptions = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
];

const MODULES: ModuleDef[] = [
  { id: "overview", label: "Visão geral", description: "Estado real do site e actividade editorial.", icon: LayoutDashboard },
  { id: "pages", label: "Páginas", description: "Metadados, idioma, estado e SEO das rotas implementadas.", table: "pages", entity: "pages", icon: FileText, fields: [
    { key: "slug", label: "Identificador", required: true },
    { key: "route_path", label: "Rota suportada", type: "select", required: true, options: routeOptions },
    { key: "title", label: "Título", required: true },
    { key: "locale", label: "Idioma", required: true, help: "Exemplo: pt-MZ ou en." },
    { key: "status", label: "Estado", type: "select", required: true, options: statusOptions },
    { key: "seo_title", label: "SEO title", nullable: true },
    { key: "seo_description", label: "Meta description", type: "textarea", nullable: true },
    { key: "canonical_url", label: "Canonical URL", nullable: true, type: "url", help: "Tem de usar HTTPS e a origem definida em PUBLIC_SITE_URL." },
    { key: "og_image_path", label: "Imagem Open Graph", nullable: true, help: "Caminho aprovado do asset ou URL HTTPS." },
  ] },
  { id: "sections", label: "Secções", description: "Visibilidade, configuração tipada e ordem da Home e das páginas existentes.", table: "page_sections", entity: "page_sections", create: true, reorder: true, icon: Layers3, fields: [
    { key: "page_id", label: "Página", type: "select", required: true },
    { key: "section_key", label: "Chave da secção", required: true },
    { key: "section_type", label: "Tipo suportado", type: "select", required: true, options: homeSectionTypeOptions },
    { key: "position", label: "Posição", type: "number", required: true, help: "A ordem é gerida com os controlos Mover para cima e Mover para baixo." },
    { key: "is_visible", label: "Visível", type: "checkbox" },
    { key: "config", label: "Configuração tipada (JSON)", type: "json", required: true, help: "JSON estruturado de acordo com o tipo. Não é permitido HTML, CSS ou JavaScript arbitrário." },
  ] },
  { id: "projects", label: "Projectos", description: "Casos de estudo, publicação, destaque, capa e galeria ordenada com texto alternativo.", table: "projects", entity: "projects", create: true, reorder: true, icon: BriefcaseBusiness, fields: [
    { key: "title", label: "Título", required: true },
    { key: "slug", label: "Slug", required: true, help: "Minúsculas, números e hífen. Alterar um slug publicado cria redireccionamento permanente." },
    { key: "client_id", label: "Cliente associado", type: "select", nullable: true },
    { key: "client_label", label: "Cliente apresentado", nullable: true },
    { key: "year_label", label: "Ano", nullable: true },
    { key: "discipline", label: "Disciplina", nullable: true },
    { key: "project_type", label: "Tipo de projecto", nullable: true },
    { key: "summary", label: "Resumo", type: "textarea", nullable: true },
    { key: "challenge", label: "Desafio", type: "textarea", nullable: true },
    { key: "idea", label: "Ideia", type: "textarea", nullable: true },
    { key: "outcome", label: "Resultado", type: "textarea", nullable: true },
    { key: "cover_path", label: "Caminho da capa", nullable: true },
    { key: "cover_alt", label: "Texto alternativo da capa", nullable: true },
    { key: "gallery", label: "Galeria ordenada (JSON de caminhos)", type: "json", required: true, help: "Lista JSON de caminhos de imagem. A ordem do array é a ordem pública." },
    { key: "gallery_alt", label: "Texto alternativo da galeria (JSON)", type: "json", required: true, help: "Lista JSON de textos alternativos na mesma ordem da galeria. Se ainda não houver descrição, usar string vazia." },
    { key: "featured", label: "Destacar na Home", type: "checkbox" },
    { key: "position", label: "Posição", type: "number", required: true },
    { key: "status", label: "Estado antes da publicação", type: "select", options: statusOptions },
    { key: "hue", label: "Matiz visual (0 a 360)", type: "number" },
    { key: "locale", label: "Idioma do caso", required: true },
  ] },
  { id: "clients", label: "Clientes", description: "Logótipos, texto alternativo e visibilidade por contexto.", table: "clients", entity: "clients", create: true, reorder: true, icon: Users, fields: [
    { key: "name", label: "Nome", required: true },
    { key: "slug", label: "Slug", required: true },
    { key: "logo_path", label: "Caminho do logótipo", nullable: true },
    { key: "logo_alt", label: "Texto alternativo", nullable: true },
    { key: "display_as_text", label: "Apresentar apenas texto", type: "checkbox" },
    { key: "position", label: "Posição", type: "number", required: true },
    { key: "show_on_home", label: "Mostrar na Home", type: "checkbox" },
    { key: "show_on_clients_page", label: "Mostrar na página de clientes", type: "checkbox" },
    { key: "is_visible", label: "Visível no site", type: "checkbox" },
  ] },
  { id: "profile", label: "Perfil", description: "Biografia, cargo, contactos públicos e redes sociais.", table: "profile_content", entity: "profile_content", icon: Contact, fields: [
    { key: "name", label: "Nome", required: true }, { key: "role", label: "Cargo", nullable: true },
    { key: "roles", label: "Cargos e etiquetas (JSON)", type: "json", required: true },
    { key: "location", label: "Localização", nullable: true }, { key: "address", label: "Morada pública", nullable: true },
    { key: "public_email", label: "Email público", type: "email", nullable: true },
    { key: "phone", label: "Telefone público", nullable: true }, { key: "whatsapp", label: "WhatsApp URL", type: "url", nullable: true },
    { key: "portrait_path", label: "Caminho do retrato", nullable: true },
    { key: "headline", label: "Headline", type: "textarea", nullable: true },
    { key: "intro", label: "Introdução", type: "textarea", nullable: true },
    { key: "biography", label: "Biografia", type: "textarea", nullable: true },
    { key: "socials", label: "Redes sociais (JSON)", type: "json", required: true },
  ] },
  { id: "experience", label: "Experiência", description: "Experiência profissional ordenada.", table: "experience_items", entity: "experience_items", create: true, reorder: true, icon: BriefcaseBusiness, fields: [
    { key: "organisation", label: "Organização", required: true }, { key: "role", label: "Cargo", required: true },
    { key: "period", label: "Período", nullable: true }, { key: "description", label: "Descrição", type: "textarea", nullable: true },
    { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "metrics", label: "Métricas", description: "Indicadores apresentados no site.", table: "metrics", entity: "metrics", create: true, reorder: true, icon: Activity, fields: [
    { key: "value", label: "Valor", required: true }, { key: "label", label: "Etiqueta", required: true },
    { key: "note", label: "Nota", type: "textarea", nullable: true }, { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "skills", label: "Competências", description: "Competências, nível e ordem.", table: "skills", entity: "skills", create: true, reorder: true, icon: Activity, fields: [
    { key: "name", label: "Competência", required: true }, { key: "value", label: "Valor (0 a 100)", type: "number", nullable: true },
    { key: "tier", label: "Nível", nullable: true }, { key: "level", label: "Etiqueta de nível", nullable: true },
    { key: "category", label: "Categoria", nullable: true }, { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "disciplines", label: "Disciplinas", description: "Grupos e listas de disciplinas.", table: "disciplines", entity: "disciplines", create: true, reorder: true, icon: BookOpen, fields: [
    { key: "name", label: "Nome do grupo", required: true }, { key: "description", label: "Descrição", type: "textarea", nullable: true },
    { key: "items", label: "Itens (JSON)", type: "json", required: true }, { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "principles", label: "Princípios", description: "Princípios editoriais apresentados no perfil e na Home.", table: "principles", entity: "principles", create: true, reorder: true, icon: BookOpen, fields: [
    { key: "title", label: "Título", required: true }, { key: "description", label: "Texto", type: "textarea", nullable: true },
    { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "services", label: "Serviços", description: "Serviços, descrições, entregáveis e ordem.", table: "services", entity: "services", create: true, reorder: true, icon: Wrench, fields: [
    { key: "slug", label: "Slug", required: true }, { key: "title", label: "Título", required: true },
    { key: "description", label: "Descrição", type: "textarea", required: true }, { key: "line", label: "Linha curta", nullable: true },
    { key: "details", label: "Entregáveis (JSON)", type: "json", required: true },
    { key: "number_label", label: "Número apresentado", nullable: true }, { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "process", label: "Processo", description: "Etapas do processo de trabalho.", table: "process_steps", entity: "process_steps", create: true, reorder: true, icon: Activity, fields: [
    { key: "step_key", label: "Chave da etapa", required: true }, { key: "title", label: "Título", required: true },
    { key: "description", label: "Descrição", type: "textarea", required: true },
    { key: "number_label", label: "Número apresentado", nullable: true }, { key: "position", label: "Posição", type: "number", required: true },
  ] },
  { id: "settings", label: "Definições e SEO", description: "Definições de apresentação existentes e opções globais.", table: "site_settings", entity: "site_settings", icon: Settings2, fields: [
    { key: "setting_key", label: "Chave (fixa)", type: "text" },
    { key: "setting_value", label: "Valor publicado (JSON)", type: "json", required: true, help: "O formato é validado no servidor conforme a chave: navigation, footer, presentation, capabilities, project_types, budgets ou contact_steps." },
    { key: "is_public", label: "Disponível nas páginas públicas", type: "checkbox" },
  ] },
  { id: "history", label: "Histórico", description: "Revisões reais, snapshots e restauro auditado.", table: "content_revisions", icon: History },
  { id: "inbox", label: "Caixa de entrada", description: "Pedidos reais, estados e anexos privados temporários.", table: "contact_submissions", icon: Mail },
  { id: "newsletter", label: "Newsletter", description: "Subscritores reais, consentimento, confirmação e cancelamento.", table: "newsletter_subscribers", icon: Mail },
  { id: "mail", label: "Fila de email", description: "Notificações persistentes, falhas e tentativas de reenvio.", table: "email_outbox", icon: Mail },
  { id: "media", label: "Biblioteca multimédia", description: "Upload validado, pesquisa, metadados, referências e remoção segura de assets.", table: "media_assets", icon: FileImage },
];

const TABLE_TO_ENTITY: Record<string, AdminEntity> = {
  pages: "pages", page_sections: "page_sections", projects: "projects", clients: "clients",
  profile_content: "profile_content", experience_items: "experience_items", metrics: "metrics",
  skills: "skills", disciplines: "disciplines", principles: "principles", services: "services",
  process_steps: "process_steps", site_settings: "site_settings",
};


function asText(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}
function asBool(value: unknown): boolean { return value === true || value === "true"; }
function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function prettyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function toDraft(row: Row, fields: Field[]): Row {
  const result: Row = {};
  for (const field of fields) result[field.key] = prettyValue(row[field.key]);
  return result;
}
function createDefaults(module: ModuleDef, rows: Row[], pages: Row[]): Row {
  const maxPosition = rows.reduce((max, row) => Math.max(max, asNumber(row["position"], -1)), -1);
  const draft: Row = {};
  for (const field of module.fields ?? []) {
    if (field.type === "checkbox") draft[field.key] = false;
    else if (field.type === "json") draft[field.key] = field.key === "config" ? JSON.stringify({}, null, 2) : "[]";
    else if (field.type === "number") draft[field.key] = field.key === "hue" ? "215" : String(maxPosition + 1);
    else draft[field.key] = "";
  }
  if (module.id === "sections") {
    const homePage = pages.find((page) => page["route_path"] === "/") ?? pages[0];
    draft["page_id"] = asText(homePage?.["id"]);
    const nextPosition = maxPosition + 1;
    let sectionKey = `new-section-${nextPosition + 1}`;
    let suffix = nextPosition + 1;
    while (rows.some((row) => row["section_key"] === sectionKey)) {
      suffix += 1;
      sectionKey = `new-section-${suffix}`;
    }
    draft["section_key"] = sectionKey;
    draft["section_type"] = "manifesto";
    draft["is_visible"] = true;
    draft["config"] = JSON.stringify({ label: "Nova secção" }, null, 2);
  }
  if (module.id === "projects") {
    Object.assign(draft, { featured: false, status: "draft", hue: "215", locale: "pt-MZ", gallery: "[]", gallery_alt: "[]" });
  }
  if (module.id === "clients") {
    Object.assign(draft, { logo_path: "", logo_alt: "", show_on_home: true, show_on_clients_page: true, is_visible: true, display_as_text: false });
  }
  if (module.id === "profile") Object.assign(draft, { roles: "[]", socials: "[]", is_published: true });
  if (module.id === "settings") {
    delete draft["setting_key"];
    draft["setting_value"] = "{}";
    draft["is_public"] = true;
  }
  if (module.id === "pages") {
    Object.assign(draft, { route_path: "", status: "draft", locale: "en" });
  }
  if (module.id === "experience") draft["is_published"] = true;
  if (module.id === "metrics" || module.id === "skills" || module.id === "disciplines" ||
      module.id === "principles" || module.id === "services" || module.id === "process") {
    draft["is_published"] = true;
  }
  return draft;
}
function parseDraft(draft: Row, fields: Field[]): { payload: Row; error: string | null } {
  const payload: Row = {};
  for (const field of fields) {
    const input = draft[field.key];
    if (field.type === "checkbox") {
      payload[field.key] = asBool(input);
    } else if (field.type === "json") {
      try { payload[field.key] = JSON.parse(asText(input) || "null") as unknown; }
      catch { return { payload: {}, error: `O campo "${field.label}" tem JSON inválido.` }; }
    } else if (field.type === "number") {
      if (input === "" && field.nullable) payload[field.key] = null;
      else {
        const value = Number(input);
        if (!Number.isFinite(value) || input === "") return { payload: {}, error: `O campo "${field.label}" tem de ser numérico.` };
        payload[field.key] = value;
      }
    } else {
      const value = asText(input).trim();
      payload[field.key] = field.nullable && value === "" ? null : value;
      if (field.required && value.length === 0) return { payload: {}, error: `O campo "${field.label}" é obrigatório.` };
      if ((field.type === "url" || field.type === "email") && value !== "") {
        if (field.type === "url") {
          try { const url = new URL(value); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
          catch { return { payload: {}, error: `O URL do campo "${field.label}" não é válido.` }; }
        }
        if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return { payload: {}, error: `O email do campo "${field.label}" não é válido.` };
        }
      }
    }
  }
  return { payload, error: null };
}
function stable(value: unknown): string {
  try { return JSON.stringify(value ?? null); } catch { return String(value); }
}
function rowTitle(row: Row): string {
  for (const key of ["title", "name", "organisation", "label", "setting_key", "section_key", "slug", "step_key", "email"]) {
    if (typeof row[key] === "string" && String(row[key]).trim()) return String(row[key]);
  }
  return "Registo";
}
function statusLabel(value: unknown): string {
  const labels: Record<string, string> = { published: "Publicado", draft: "Rascunho", archived: "Arquivado", new: "Novo", in_review: "Em análise", replied: "Respondido", confirmed: "Confirmado", pending: "Pendente", unsubscribed: "Cancelado" };
  return labels[String(value)] ?? (value ? String(value) : "Sem estado");
}

export function AdminWorkspace({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeId, setActiveId] = useState<ModuleId>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [baseline, setBaseline] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sectionPageId, setSectionPageId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const loaded = await loadAdminWorkspaceFn() as Workspace;
      setWorkspace(loaded);
      setSectionPageId((current) => current || asText(loaded.tables["pages"]?.rows[0]?.["id"]));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o Admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const active = MODULES.find((module) => module.id === activeId) ?? MODULES[0]!;
  const fields = active.fields ?? [];
  const tableState = active.table ? workspace?.tables[active.table] : undefined;
  const tableRows = useMemo(() => tableState?.rows ?? [], [tableState]);
  const sectionsPage = workspace?.tables["pages"]?.rows ?? [];

  const records = useMemo(() => {
    let rows = tableRows;
    if (activeId === "sections" && sectionPageId) rows = rows.filter((row) => row["page_id"] === sectionPageId);
    if (activeId === "profile") rows = rows.slice(0, 1);
    if (!search.trim()) return rows;
    const query = search.trim().toLowerCase();
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [tableRows, activeId, sectionPageId, search]);

  const navigateTo = (id: ModuleId) => {
    setActiveId(id);
    setSelectedId(null);
    setDraft({});
    setBaseline(null);
    setEditing(false);
    setCreating(false);
    setSearch("");
    setNotice(null);
  };

  function startEdit(row: Row) {
    setSelectedId(asText(row["id"]));
    setDraft(toDraft(row, fields));
    setBaseline(row);
    setEditing(true);
    setCreating(false);
    setNotice(null);
  }
  function startCreate() {
    if (!active.entity || !active.create) return;
    if (active.entity === "profile_content" && tableRows.length > 0) return;
    setSelectedId(null);
    setBaseline(null);
    const positionRows = activeId === "sections" ? tableRows.filter((row) => row["page_id"] === sectionPageId) : tableRows;
    setDraft(createDefaults(active, positionRows, sectionsPage));
    setEditing(true);
    setCreating(true);
    setNotice(null);
  }
  function cancelEdit() {
    setEditing(false);
    setCreating(false);
    setSelectedId(null);
    setBaseline(null);
    setDraft({});
    setNotice(null);
  }
  function updateDraft(key: string, value: unknown) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (activeId === "sections" && (key === "section_type" || key === "page_id")) {
        const pageId = asText(key === "page_id" ? value : next["page_id"]);
        const page = sectionsPage.find((item) => item["id"] === pageId);
        const type = asText(key === "section_type" ? value : next["section_type"]);
        const configs: Record<string, unknown> = {
          hero: { eyebrow: "", lines: [], intro: "" },
          manifesto: { label: "Nova secção" },
          featured_work: { label: "Trabalhos seleccionados", title_lines: ["Trabalhos"], link_label: "Ver trabalhos" },
          services: { label: "Serviços" },
          metrics: {},
          clients: { label: "Clientes", title_lines: ["Clientes"], link_label: "Ver clientes" },
          principles: {},
          rich_text: { paragraphs: ["Novo conteúdo."] },
        };
        const allowed = page?.["route_path"] === "/" ? homeSectionTypes : allRendererSectionTypes;
        if (allowed.includes(type)) next["config"] = JSON.stringify(configs[type] ?? {}, null, 2);
        else {
          next["section_type"] = page?.["route_path"] === "/" ? "manifesto" : "hero";
          const fallbackType = asText(next["section_type"]);
          next["config"] = JSON.stringify(configs[fallbackType] ?? {}, null, 2);
        }
      }
      return next;
    });
    setNotice(null);
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.entity || !editing || saving) return;
    const parsed = parseDraft(draft, fields);
    if (parsed.error) {
      setNotice({ tone: "error", text: parsed.error });
      return;
    }
    let payload = parsed.payload;
    if (!creating && baseline) {
      const changed: Row = {};
      for (const [key, value] of Object.entries(payload)) {
        const original = baseline[key];
        let comparable = value;
        if (fields.find((field) => field.key === key)?.type === "json") comparable = JSON.parse(asText(draft[key]));
        if (stable(original) !== stable(comparable)) changed[key] = value;
      }
      if (Object.keys(changed).length === 0) {
        setNotice({ tone: "info", text: "Não existem alterações por guardar." });
        return;
      }
      payload = changed;
    }

    setSaving(true);
    setNotice(null);
    try {
      const result = await mutateAdminContentFn({ data: {
        entity: active.entity,
        action: "publish",
        id: creating ? null : selectedId,
        payload,
        expectedUpdatedAt: creating ? null : asText(baseline?.["updated_at"]) || null,
        note: creating ? "Criado no Kutuzov Admin" : "Guardado e publicado no Kutuzov Admin",
      } }) as { record: Row; published_revision: number };
      setNotice({ tone: "success", text: `Base de dados confirmou a revisão ${result.published_revision}. O conteúdo foi guardado e publicado.` });
      await refresh();
      setSelectedId(asText(result.record["id"]));
      setBaseline(result.record);
      setDraft(toDraft(result.record, fields));
      setCreating(false);
      setEditing(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const conflict = /conflict|outra operação|duplicado|já não existe/i.test(message);
      setNotice({ tone: "error", text: conflict ? `Conflito: ${message}. Os valores locais foram preservados; copie-os ou recarregue o registo antes de tentar novamente.` : message || "A gravação não foi confirmada. Os valores locais foram preservados para tentar novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function archiveRecord(row: Row) {
    if (!active.entity || saving) return;
    if (!window.confirm(`Arquivar "${rowTitle(row)}"? A acção não elimina o registo nem as referências a ele.`)) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await mutateAdminContentFn({ data: {
        entity: active.entity, action: "archive", id: asText(row["id"]),
        payload: {}, expectedUpdatedAt: asText(row["updated_at"]) || null,
        note: "Arquivo solicitado no Kutuzov Admin",
      } }) as { record: Row; published_revision: number };
      setNotice({ tone: "success", text: `Registo arquivado. Revisão pública ${result.published_revision} confirmada.` });
      cancelEdit();
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível arquivar. Actualize a lista e tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function moveRecord(index: number, direction: -1 | 1) {
    if (!active.entity || !active.reorder || search.trim() || saving) return;
    const target = index + direction;
    if (target < 0 || target >= records.length) return;
    const ids = records.map((row) => asText(row["id"]));
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setSaving(true);
    setNotice(null);
    try {
      const result = await reorderAdminContentFn({ data: {
        entity: active.entity as "page_sections" | "projects" | "clients" | "experience_items" | "metrics" | "skills" | "disciplines" | "principles" | "services" | "process_steps",
        ids,
        pageId: activeId === "sections" ? sectionPageId : null,
      } }) as { count: number; published_revision: number };
      setNotice({ tone: "success", text: `Ordem actualizada para ${result.count} registos. Revisão ${result.published_revision} confirmada.` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "A ordem não foi confirmada. Recarregue a lista." });
    } finally {
      setSaving(false);
    }
  }

  async function setContactStatus(row: Row, status: "new" | "in_review" | "replied" | "archived") {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await updateContactSubmissionFn({ data: {
        id: asText(row["id"]), status,
        internalNotes: asText(row["internal_notes"]),
        expectedUpdatedAt: asText(row["updated_at"]),
      } });
      setNotice({ tone: "success", text: "Estado do pedido confirmado pela base de dados." });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível actualizar o pedido." });
    } finally {
      setSaving(false);
    }
  }

  async function restoreRevision(row: Row) {
    const entityType = asText(row["entity_type"]);
    const entity = TABLE_TO_ENTITY[entityType];
    const before = getRestorableSnapshot(row);
    const entityId = asText(row["entity_id"]);
    if (!entity || !before || typeof before !== "object" || Array.isArray(before)) {
      setNotice({ tone: "info", text: "Esta revisão não contém um snapshot restaurável para uma entidade editorial suportada." });
      return;
    }
    const current = workspace?.tables[entityType]?.rows.find((item) => item["id"] === entityId);
    if (!current || typeof current["updated_at"] !== "string") {
      setNotice({ tone: "error", text: "O registo actual não está carregado. Abra o módulo correspondente e actualize antes de restaurar." });
      return;
    }
    if (!window.confirm(`Restaurar a versão anterior de "${rowTitle(before as Row)}"? Será criada uma nova revisão; o histórico existente será preservado.`)) return;
    setSaving(true);
    try {
      const result = await mutateAdminContentFn({ data: {
        entity,
        action: "restore",
        id: entityId,
        payload: before as Row,
        expectedUpdatedAt: asText(current["updated_at"]),
        note: `Restauro da revisão ${asText(row["id"])}`,
      } }) as { record: Row; published_revision: number };
      setNotice({ tone: "success", text: `Snapshot restaurado e revisão ${result.published_revision} criada.` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "O restauro não foi confirmado. O histórico não foi alterado." });
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: Field) {
    const value = draft[field.key];
    const shared = "mt-1.5 w-full rounded-lg border border-[#d9dce2] bg-white px-3 py-2.5 text-sm text-[#15161a] outline-none transition focus-visible:border-[#3b5ccc] focus-visible:ring-2 focus-visible:ring-[#3b5ccc]/20 disabled:cursor-not-allowed disabled:bg-[#f0f1f4]";
    const fieldDisabled = saving || (!creating && !!active.reorder && field.key === "position") || (!creating && activeId === "sections" && field.key === "page_id");
    const describedBy = field.help ? `field-help-${field.key}` : undefined;
    const selectedSectionPage = activeId === "sections"
      ? sectionsPage.find((page) => page["id"] === asText(draft["page_id"]))
      : undefined;
    const sectionOptions = selectedSectionPage?.["route_path"] === "/"
      ? homeSectionTypeOptions
      : selectedSectionPage?.["route_path"] === "/about" && asText(draft["section_key"]) === "about-copy"
        ? aboutRichTextTypeOptions
        : [{ value: "hero", label: "hero" }];
    const requiredSectionVisibility = activeId === "sections" && !creating &&
      selectedSectionPage?.["route_path"] !== "/" &&
      (asText(draft["section_key"]) === "hero" ||
        (selectedSectionPage?.["route_path"] === "/about" && asText(draft["section_key"]) === "about-copy"));
    if (field.type === "checkbox") {
      return (
        <label key={field.key} className="flex min-h-12 items-center gap-3 rounded-lg border border-[#e5e7eb] px-3 py-3 text-sm text-[#25272c]">
          <input type="checkbox" checked={asBool(value)} onChange={(event) => updateDraft(field.key, event.target.checked)} disabled={saving || (field.key === "setting_key") || (activeId === "settings" && field.key === "is_public") || (field.key === "is_visible" && requiredSectionVisibility)} className="size-4 accent-[#243d98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98]" />
          <span>{field.label}{field.key === "is_visible" && requiredSectionVisibility ? <small className="mt-1 block text-[11px] font-normal text-[#707582]">Obrigatória para o renderer desta página.</small> : field.key === "is_public" && activeId === "settings" ? <small className="mt-1 block text-[11px] font-normal text-[#707582]">Esta definição é consumida pela apresentação pública e não pode ser ocultada.</small> : null}</span>
        </label>
      );
    }
    const options = field.key === "section_type"
      ? sectionOptions
      : field.key === "page_id"
      ? sectionsPage.filter((page) => !creating || page["route_path"] === "/").map((page) => ({ value: asText(page["id"]), label: `${asText(page["title"])} · ${asText(page["route_path"])}` }))
      : field.key === "client_id"
        ? [{ value: "", label: "Sem associação" }, ...(workspace?.tables["clients"]?.rows ?? []).map((client) => ({ value: asText(client["id"]), label: asText(client["name"]) }))]
        : field.options;
    return (
      <div key={field.key} className={field.type === "json" || field.type === "textarea" ? "sm:col-span-2" : ""}>
        <label htmlFor={`admin-field-${field.key}`} className="block text-sm font-medium text-[#2e3037]">
          {field.label}{field.required ? <span className="ml-1 text-[#b42318]" aria-hidden="true">*</span> : null}
        </label>
        {field.type === "select" || options ? (
          <select id={`admin-field-${field.key}`} value={asText(value)} onChange={(event) => updateDraft(field.key, event.target.value === "" && field.nullable ? null : event.target.value)} disabled={fieldDisabled || field.key === "setting_key"} required={field.required} aria-describedby={describedBy} className={shared}>
            {!(options ?? []).some((option) => option.value === asText(value)) && asText(value) !== "" ? <option value={asText(value)}>{asText(value)}</option> : null}
            {(options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : field.type === "textarea" || field.type === "json" ? (
          <textarea id={`admin-field-${field.key}`} value={asText(value)} onChange={(event) => updateDraft(field.key, event.target.value)} disabled={fieldDisabled} required={field.required} aria-describedby={describedBy} rows={field.type === "json" ? 7 : 4} spellCheck={field.type !== "json"} className={`${shared} resize-y font-mono text-xs leading-5`} />
        ) : (
          <input id={`admin-field-${field.key}`} type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"} min={field.type === "number" ? 0 : undefined} value={asText(value)} onChange={(event) => updateDraft(field.key, event.target.value)} disabled={fieldDisabled} required={field.required} aria-describedby={describedBy} className={shared} />
        )}
        {field.help ? <p id={describedBy} className="mt-1.5 text-xs leading-5 text-[#666b76]">{field.help}</p> : null}
      </div>
    );
  }

  const sidebarGroups: Array<{ label: string; ids: ModuleId[] }> = [
    { label: "Painel", ids: ["overview"] },
    { label: "Conteúdo", ids: ["pages", "sections", "projects", "clients"] },
    { label: "Identidade", ids: ["profile", "experience", "metrics", "skills", "disciplines", "principles"] },
    { label: "Sistema", ids: ["services", "process", "settings", "history", "inbox", "mail", "media", "newsletter"] },
  ];

  const stateBadge = (value: unknown) => <span className="inline-flex rounded-full border border-[#d8dbe2] bg-[#f6f7f9] px-2.5 py-1 text-[11px] font-medium text-[#555a65]">{statusLabel(value)}</span>;

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#17191f]">
      <a href="#admin-main" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-[#243d98]">Saltar para o conteúdo principal</a>
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#e0e2e8] bg-white/95 px-4 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#17295f] text-sm font-bold text-white">K</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Kutuzov Admin</p>
            <p className="truncate text-[11px] text-[#707582]">Gestão editorial do portfólio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden max-w-[200px] truncate text-xs text-[#666b76] md:inline">{email}</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-[#eaf6ee] px-2.5 py-1 text-[11px] font-medium text-[#17653b] sm:inline-flex"><ShieldCheck size={13} /> Sessão autenticada</span>
          <button type="button" onClick={() => void refresh()} disabled={loading || saving} className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e0e2e8] text-[#464b56] hover:bg-[#f2f3f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-50" aria-label="Actualizar dados do Admin" title="Actualizar dados"><RefreshCw size={16} /></button>
          <button type="button" onClick={onLogout} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e0e2e8] px-3 text-xs font-medium text-[#454954] hover:bg-[#f2f3f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-50"><LogOut size={14} /><span className="hidden sm:inline">Sair</span></button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-68px)] max-w-[1600px] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-[#e0e2e8] bg-white p-3 md:border-b-0 md:border-r md:p-4">
          <nav aria-label="Módulos administrativos" className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:flex md:flex-col">
            {sidebarGroups.map((group) => (
              <div key={group.label} className="contents md:block">
                <p className="col-span-full mb-1 mt-3 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#858a95] md:block">{group.label}</p>
                {group.ids.map((id) => {
                  const item = MODULES.find((module) => module.id === id)!;
                  const Icon = item.icon;
                  const selected = activeId === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => navigateTo(item.id)} aria-current={selected ? "page" : undefined} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#243d98] ${selected ? "bg-[#e9edfc] text-[#1f367f]" : "text-[#5a5e69] hover:bg-[#f3f4f7] hover:text-[#22242b]"}`}>
                      <Icon size={15} className="shrink-0" /><span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-6 hidden rounded-xl border border-[#e4e6eb] bg-[#f9fafb] p-3 md:block">
            <div className="flex items-center gap-2 text-xs font-semibold"><Database size={14} /> Supabase CMS</div>
            <p className="mt-2 text-[11px] leading-5 text-[#6c717d]">As alterações editoriais passam pelo servidor autenticado e são registadas no histórico.</p>
            <p className="mt-2 font-mono text-[10px] text-[#7d8390]">PORTFOLIO-KUTUZOV</p>
          </div>
        </aside>

        <section id="admin-main" className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] text-[#6f7480]">
                  <span>Admin</span><ChevronRight size={12} /><span>{active.label}</span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{active.label}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#626774]">{active.description}</p>
              </div>
              {activeId !== "overview" && active.fields && active.create && !editing &&
        (activeId !== "sections" || sectionsPage.find((page) => page["id"] === sectionPageId)?.["route_path"] === "/") ? (
                <button type="button" onClick={startCreate} disabled={saving || loading || !!tableState?.error} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17295f] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243d82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">+</span> Novo registo</button>
              ) : null}
            </div>

            {loadError ? (
              <div role="alert" className="rounded-xl border border-[#e8b4ae] bg-[#fff3f1] p-5 text-sm text-[#8a2a20]">
                <p className="font-semibold">Não foi possível abrir o espaço editorial.</p><p className="mt-1">{loadError}</p>
                <button onClick={() => void refresh()} type="button" className="mt-3 rounded-lg border border-[#d99a93] px-3 py-2 font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-[#8a2a20]">Tentar novamente</button>
              </div>
            ) : loading && !workspace ? (
              <div role="status" className="rounded-xl border border-[#e2e5eb] bg-white p-8 text-sm text-[#626774]"><RefreshCw size={16} className="mr-2 inline animate-spin" /> A carregar dados reais do CMS...</div>
            ) : activeId === "overview" ? (
              <Overview workspace={workspace} stateBadge={stateBadge} />
            ) : activeId === "history" ? (
              <HistoryView rows={tableRows} tables={workspace?.tables} error={tableState?.error ?? null} onRestore={(row) => void restoreRevision(row)} busy={saving} stateBadge={stateBadge} />
            ) : activeId === "inbox" ? (
              <InboxView rows={tableRows} error={tableState?.error ?? null} busy={saving} onStatus={(row, status) => void setContactStatus(row, status)} stateBadge={stateBadge} />
            ) : activeId === "media" ? (
              <MediaView rows={tableRows} inventory={workspace?.tables["asset_migration_inventory"]} storage={workspace?.storage} onRefresh={refresh} onNotice={(tone, text) => setNotice({ tone, text })} />
            ) : activeId === "newsletter" ? (
              <NewsletterView rows={tableRows} error={tableState?.error ?? null} stateBadge={stateBadge} />
            ) : activeId === "mail" ? (
              <EmailOutboxView rows={tableRows} error={tableState?.error ?? null} busy={saving} onRefresh={refresh} stateBadge={stateBadge} />
            ) : editing ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <form onSubmit={(event) => void saveContent(event)} className="min-w-0 rounded-xl border border-[#e1e4ea] bg-white p-4 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#eceef2] pb-4">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c818c]">{creating ? "Novo registo" : "A editar"}</p><h2 className="mt-1 text-lg font-semibold">{creating ? `Novo item: ${active.label}` : rowTitle(baseline ?? {})}</h2></div>
                    {baseline?.["status"] ? stateBadge(baseline["status"]) : null}
                  </div>
                  {activeId === "pages" ? <div className="mb-4 rounded-lg border border-[#eadcb4] bg-[#fff9e9] p-3 text-xs leading-5 text-[#6f5317]">Só estão disponíveis as oito rotas suportadas pelo router. Criar uma rota nova exige implementar e testar um renderer no código; o CMS não inventa páginas nem componentes.</div> : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => {
                      if (field.key === "setting_key") {
                        return <div key={field.key}><p className="block text-sm font-medium text-[#2e3037]">{field.label}</p><p className="mt-1.5 rounded-lg border border-[#eceef2] bg-[#f7f8fa] px-3 py-2.5 font-mono text-xs">{asText(baseline?.["setting_key"]) || "Chave definida pelo sistema"}</p><p className="mt-1 text-xs text-[#727784]">A chave identifica uma definição existente e não pode ser alterada.</p></div>;
                      }
                      return renderField(field);
                    })}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eceef2] pt-5">
                    <button type="button" onClick={cancelEdit} disabled={saving} className="h-10 rounded-lg border border-[#dfe2e8] px-4 text-sm font-medium text-[#424650] hover:bg-[#f8f9fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={saving || loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17295f] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#243d82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:cursor-not-allowed disabled:opacity-50"><Save size={15} />{saving ? "A guardar..." : "Guardar e publicar"}</button>
                  </div>
                </form>
                <aside className="space-y-4">
                  <div className="rounded-xl border border-[#e1e4ea] bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold">Pré-visualização local</h3>
                    <p className="mt-1 text-xs leading-5 text-[#737886]">Este painel mostra os valores introduzidos no formulário. Não altera o site público antes da confirmação do servidor.</p>
                    <dl className="mt-4 space-y-3">
                      {fields.filter((field) => ["title", "name", "slug", "route_path", "status", "position", "featured", "is_visible"].includes(field.key)).map((field) => (
                        <div key={field.key} className="border-b border-[#f0f1f4] pb-2 last:border-0">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#858a95]">{field.label}</dt>
                          <dd className="mt-1 break-words text-sm">{field.type === "checkbox" ? (asBool(draft[field.key]) ? "Sim" : "Não") : (asText(draft[field.key]) || "Não definido")}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {baseline && active.entity && activeId !== "profile" && activeId !== "settings" ? (
                    <div className="rounded-xl border border-[#e1e4ea] bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold">Ciclo de vida</h3>
                      <p className="mt-1 text-xs leading-5 text-[#737886]">Arquivar oculta o registo sem eliminar as referências. O histórico permanece disponível.</p>
                      <button type="button" onClick={() => void archiveRecord(baseline)} disabled={saving} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8aaa4] px-3 text-xs font-semibold text-[#922f25] hover:bg-[#fff4f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#922f25] disabled:opacity-50"><Archive size={14} /> Arquivar registo</button>
                    </div>
                  ) : null}
                </aside>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e1e4ea] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaf0] p-4">
                  <div className="text-sm font-semibold">{active.table ? `${records.length} registo(s)` : active.label}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeId === "sections" ? <label className="flex items-center gap-2 text-xs text-[#5d626e]"><span>Página</span><select value={sectionPageId} onChange={(event) => { setSectionPageId(event.target.value); setNotice(null); }} className="h-9 max-w-[220px] rounded-lg border border-[#dfe2e8] bg-white px-2 text-xs focus-visible:outline-2 focus-visible:outline-[#243d98]">{sectionsPage.map((page) => <option key={asText(page["id"])} value={asText(page["id"])}>{asText(page["title"])} · {asText(page["route_path"])}</option>)}</select></label> : null}
                    <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar..." aria-label={`Pesquisar em ${active.label}`} className="h-9 w-44 rounded-lg border border-[#dfe2e8] pl-8 pr-3 text-xs outline-none focus-visible:border-[#3b5ccc] focus-visible:ring-2 focus-visible:ring-[#3b5ccc]/20 sm:w-56" /></label>
                  </div>
                </div>
                {tableState?.error ? <div role="alert" className="p-6 text-sm text-[#922f25]"><p className="font-semibold">O módulo não pôde ser carregado.</p><p className="mt-1">{tableState.error}</p><button type="button" onClick={() => void refresh()} className="mt-3 rounded-lg border border-[#d8aaa4] px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#922f25]">Tentar novamente</button></div>
                : records.length === 0 ? <div className="p-10 text-center"><p className="text-sm font-medium">{search ? "Nenhum resultado para esta pesquisa." : "Ainda não existem registos neste módulo."}</p><p className="mt-1 text-xs text-[#737886]">{search ? "Altere os termos de pesquisa." : active.create ? "Crie um registo para começar a gerir este conteúdo." : "Este módulo é de consulta ou aguarda a activação de serviços adicionais."}</p></div>
                : (
                  <div className="divide-y divide-[#eff0f4]">
                    {records.map((row, index) => (
                      <div key={asText(row["id"]) || `${activeId}-${index}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-[#fafbfc] sm:px-5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f7] text-[#596174]">
                          {activeId === "projects" ? <BriefcaseBusiness size={16} /> : activeId === "clients" ? <Users size={16} /> : activeId === "sections" ? <Layers3 size={16} /> : <FileText size={16} />}
                        </div>
                        <button type="button" onClick={() => active.fields && active.entity ? startEdit(row) : undefined} disabled={!active.fields || !active.entity || saving} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:cursor-default">
                          <span className="block truncate text-sm font-semibold text-[#252730]">{rowTitle(row)}</span>
                          <span className="mt-1 block truncate text-xs text-[#767b86]">{activeId === "pages" ? asText(row["route_path"]) : activeId === "sections" ? `${asText(row["section_type"])} · ${asText(row["section_key"])}` : activeId === "projects" ? `/${asText(row["slug"])} · ${asText(row["client_label"])}` : activeId === "clients" ? `/${asText(row["slug"])} · ${row["logo_path"] ? "Com logótipo" : "Apresentação textual"}` : `Actualizado: ${asText(row["updated_at"]) || asText(row["created_at"]) || "data indisponível"}`}</span>
                        </button>
                        <div className="flex items-center gap-2">{stateBadge(row["status"] ?? (row["is_visible"] === false ? "archived" : row["migration_status"]))}
                          {active.reorder && !search.trim() ? (
                            <div className="flex items-center gap-1">
                              <button type="button" aria-label={`Mover ${rowTitle(row)} para cima`} onClick={() => void moveRecord(index, -1)} disabled={saving || index === 0} className="inline-flex size-8 items-center justify-center rounded-md border border-[#e0e2e8] hover:bg-[#f1f3f7] focus-visible:outline-2 focus-visible:outline-[#243d98] disabled:opacity-30"><ArrowUp size={14} /></button>
                              <button type="button" aria-label={`Mover ${rowTitle(row)} para baixo`} onClick={() => void moveRecord(index, 1)} disabled={saving || index === records.length - 1} className="inline-flex size-8 items-center justify-center rounded-md border border-[#e0e2e8] hover:bg-[#f1f3f7] focus-visible:outline-2 focus-visible:outline-[#243d98] disabled:opacity-30"><ArrowDown size={14} /></button>
                            </div>
                          ) : null}
                          {active.fields && active.entity ? <button type="button" onClick={() => startEdit(row)} disabled={saving} className="h-8 rounded-md border border-[#dfe2e8] px-3 text-xs font-semibold text-[#343844] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#243d98] disabled:opacity-50">Editar</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {notice ? (
              <div role={notice.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 flex items-start gap-2 rounded-xl border p-4 text-sm ${notice.tone === "success" ? "border-[#b8dfc6] bg-[#eff9f2] text-[#17653b]" : notice.tone === "error" ? "border-[#e8b4ae] bg-[#fff3f1] text-[#8a2a20]" : "border-[#d8deef] bg-[#f3f6ff] text-[#314b8b]"}`}>
                {notice.tone === "success" ? <Check size={16} className="mt-0.5 shrink-0" /> : notice.tone === "error" ? <Activity size={16} className="mt-0.5 shrink-0" /> : <Clock3 size={16} className="mt-0.5 shrink-0" />}
                <p>{notice.text}</p>
              </div>
            ) : null}
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e4ea] pt-4 text-[11px] text-[#7a7f8b]">
              <span>{workspace ? `Dados lidos em ${new Date(workspace.loadedAt).toLocaleTimeString()}` : "A aguardar dados do CMS"}</span>
              <span className="inline-flex items-center gap-1.5"><Globe2 size={12} /> Publicação via servidor · sem deploy de conteúdo</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function Overview({ workspace, stateBadge }: { workspace: Workspace | null; stateBadge: (value: unknown) => ReactNode }) {
  const count = (table: string) => {
    const state = workspace?.tables[table];
    return !state ? "A carregar" : state.error ? "Indisponível" : String(state.rows.length);
  };
  const state = workspace?.tables["site_publication_state"]?.rows[0];
  const pendingContacts = workspace?.tables["contact_submissions"];
  const revisions = workspace?.tables["content_revisions"];
  const storage = workspace?.storage;
  const cards = [
    { title: "Projectos", value: count("projects"), note: "Todos os estados editoriais", icon: BriefcaseBusiness },
    { title: "Clientes", value: count("clients"), note: "Inclui clientes sem logótipo", icon: Users },
    { title: "Pedidos por tratar", value: !pendingContacts ? "A carregar" : pendingContacts.error ? "Indisponível" : String(pendingContacts.rows.filter((row) => row["status"] === "new" || row["status"] === "in_review").length), note: "Pedidos reais na caixa de entrada", icon: Mail },
    { title: "Revisões", value: !revisions ? "A carregar" : revisions.error ? "Indisponível" : String(revisions.rows.length), note: "Até 100 entradas recentes", icon: History },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => { const Icon = card.icon; return <article key={card.title} className="rounded-xl border border-[#e1e4ea] bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-medium text-[#6a6f7b]"><span>{card.title}</span><Icon size={17} /></div><p className="mt-4 text-3xl font-semibold tracking-tight">{card.value}</p><p className="mt-2 text-[11px] text-[#777c87]">{card.note}</p></article>; })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e1e4ea] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Database size={17} className="text-[#4a5e9c]" /><h2 className="text-sm font-semibold">Estado do sistema</h2></div>
          <dl className="mt-4 divide-y divide-[#eff0f4]">
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[#666b76]">Ligação à base de dados</dt><dd>{workspace ? stateBadge("ready") : stateBadge("pending")}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[#666b76]">Revisão publicada</dt><dd className="font-mono text-xs">{state?.["published_revision"] !== undefined ? String(state["published_revision"]) : workspace?.tables["site_publication_state"]?.error ? "Indisponível" : "Não verificada"}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[#666b76]">Armazenamento</dt><dd>{storage?.status === "ready" ? stateBadge("ready") : stateBadge("unavailable")}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[#666b76]">Buckets detectados</dt><dd className="text-xs">{storage?.status === "ready" ? String(storage.buckets?.length ?? 0) : storage?.error ?? "Não verificado"}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[#666b76]">Sessão</dt><dd>{stateBadge("authenticated")}</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-[#e1e4ea] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Activity size={17} className="text-[#4a5e9c]" /><h2 className="text-sm font-semibold">Alterações recentes</h2></div>
          {revisions?.error ? <p role="alert" className="mt-4 text-xs text-[#922f25]">{revisions.error}</p> : !revisions ? <p className="mt-4 text-xs text-[#777c87]">A carregar histórico...</p> : revisions.rows.length === 0 ? <p className="mt-4 text-xs text-[#777c87]">Ainda não existem alterações editoriais registadas.</p> : <div className="mt-3 divide-y divide-[#eff0f4]">{revisions.rows.slice(0, 6).map((row) => <div key={asText(row["id"])} className="flex items-start justify-between gap-4 py-3"><div><p className="text-xs font-semibold">{asText(row["entity_type"])} · {asText(row["action"])}</p><p className="mt-1 text-[10px] text-[#7a7f8b]">{asText(row["note"]) || "Sem nota"}</p></div><time className="shrink-0 text-[10px] text-[#7a7f8b]">{asText(row["created_at"]).slice(0, 16).replace("T", " ")}</time></div>)}</div>}
        </section>
      </div>
      <section className="rounded-xl border border-[#e1d8bd] bg-[#fffaf0] p-5">
        <h2 className="text-sm font-semibold text-[#735316]">Avisos operacionais</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-[#785f2b]">
          <li>A identidade administrativa tem de estar configurada no Supabase Auth com o claim verificado no servidor.</li>
          <li>A biblioteca nesta fase apresenta registos e inventário; upload e substituição de ficheiros dependem da Fase 4.</li>
          <li>A caixa de entrada apenas permite gerir submissões que existam realmente na base de dados. Os formulários públicos persistentes e a newsletter end-to-end dependem da Fase 4.</li>
          <li>O número de revisões apresentado é limitado às 100 entradas mais recentes carregadas.</li>
        </ul>
      </section>
    </div>
  );
}

function HistoryView({ rows, tables, error, onRestore, busy, stateBadge }: {
  rows: Row[];
  tables: Workspace["tables"] | undefined;
  error: string | null;
  onRestore: (row: Row) => void;
  busy: boolean;
  stateBadge: (value: unknown) => ReactNode;
}) {
  const [compareId, setCompareId] = useState<string | null>(null);
  if (error) return <div role="alert" className="rounded-xl border border-[#e8b4ae] bg-white p-5 text-sm text-[#922f25]">{error}</div>;
  return <div className="overflow-hidden rounded-xl border border-[#e1e4ea] bg-white shadow-sm">
    <div className="border-b border-[#e8eaf0] p-4">
      <h2 className="text-sm font-semibold">Revisões registadas</h2>
      <p className="mt-1 text-xs leading-5 text-[#777c87]">Compare o snapshot seleccionado com o estado actual. Restaurar cria uma nova revisão sem apagar o histórico existente.</p>
    </div>
    {rows.length === 0 ? <p className="p-10 text-center text-sm text-[#727784]">Ainda não existem revisões registadas.</p> : <div className="divide-y divide-[#eff0f4]">
      {rows.map((row) => {
        const id = asText(row["id"]);
        const entityType = asText(row["entity_type"]);
        const entityId = asText(row["entity_id"]);
        const current = tables?.[entityType]?.rows.find((item) => asText(item["id"]) === entityId);
        const snapshot = getRestorableSnapshot(row);
        const comparing = compareId === id;
        return <article key={id} className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold">{entityType} · {asText(row["action"])}</p>
              <p className="mt-1 text-xs text-[#707582]">{asText(row["note"]) || "Sem nota"} · revisão {asText(row["publish_revision"])}</p>
              <p className="mt-1 text-[10px] text-[#8b9099]">{asText(row["created_at"])} · actor {asText(row["actor_id"]) || "indisponível"}</p>
            </div>
            {stateBadge(row["action"])}
            {snapshot && current ? <button type="button" onClick={() => setCompareId(comparing ? null : id)} aria-expanded={comparing} className="h-8 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold hover:bg-[#f7f8fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98]">{comparing ? "Fechar comparação" : "Comparar com actual"}</button> : null}
            {row["before_snapshot"] && snapshot ? <button type="button" onClick={() => onRestore(row)} disabled={busy || !current} className="h-8 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold hover:bg-[#f7f8fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-50">Restaurar esta versão</button> : null}
          </div>
          {comparing && snapshot && current ? <section aria-label={`Comparação da revisão ${asText(row["publish_revision"])} com o estado actual`} className="mt-4 grid gap-3 border-t border-[#eff0f4] pt-4 lg:grid-cols-2">
            <div className="min-w-0"><h3 className="text-xs font-semibold">Snapshot da revisão seleccionada</h3><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f7f8fa] p-3 text-[11px] leading-5">{JSON.stringify(snapshot, null, 2)}</pre></div>
            <div className="min-w-0"><h3 className="text-xs font-semibold">Registo actual</h3><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f7f8fa] p-3 text-[11px] leading-5">{JSON.stringify(current, null, 2)}</pre></div>
          </section> : null}
        </article>;
      })}
    </div>}
  </div>;
}
