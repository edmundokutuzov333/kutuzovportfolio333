import { getAdminServerContext } from "./admin-auth.server";
import {
  AdminEntitySchema,
  validateAdminPayload,
  type AdminAction,
  type AdminEntity,
} from "../admin-cms.schema";

type AdminContext = Awaited<ReturnType<typeof getAdminServerContext>>;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Row = Record<string, JsonValue>;
type InputRow = Record<string, unknown>;
type TableState = { rows: Row[]; error: string | null };

const TABLES = [
  "pages", "page_sections", "projects", "clients", "profile_content",
  "experience_items", "metrics", "skills", "disciplines", "principles",
  "services", "process_steps", "site_settings", "content_revisions",
  "contact_submissions", "newsletter_subscribers", "email_outbox", "media_assets",
  "asset_migration_inventory", "site_publication_state",
] as const;

const ORDER_BY: Partial<Record<(typeof TABLES)[number], string>> = {
  pages: "route_path.asc",
  page_sections: "page_id.asc,position.asc",
  projects: "position.asc",
  clients: "position.asc",
  experience_items: "position.asc",
  metrics: "position.asc",
  skills: "position.asc",
  disciplines: "position.asc",
  principles: "position.asc",
  services: "position.asc",
  process_steps: "position.asc",
  site_settings: "setting_key.asc",
  content_revisions: "created_at.desc",
  contact_submissions: "created_at.desc",
  newsletter_subscribers: "created_at.desc",
  email_outbox: "created_at.desc",
  media_assets: "created_at.desc",
  asset_migration_inventory: "manifest_path.asc",
};

export class AdminCmsError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "conflict" | "invalid" | "not_found" | "unavailable" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "AdminCmsError";
  }
}

function headers(context: AdminContext, prefer?: string): HeadersInit {
  return {
    apikey: context.supabase.serviceRoleKey,
    Authorization: `Bearer ${context.supabase.serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function publicError(status: number, message: string): never {
  console.error("[admin-cms] database error", status, message.slice(0, 500));
  if (/gallery_alt/.test(message) && /does not exist|schema cache|42703|PGRST/i.test(message)) {
    throw new AdminCmsError("O campo de texto alternativo da galeria ainda não foi instalado pela migração da Fase 3. A gravação está bloqueada até a migração ser validada e aplicada.", "unavailable");
  }
  if (status === 404 && /PGRST202|admin_mutate_content|admin_reorder_content|admin_update_contact_submission|schema cache/i.test(message)) {
    throw new AdminCmsError("As funções de escrita da Fase 3 ainda não estão instaladas na base de dados. A gravação permanece bloqueada até a migração ser validada e aplicada.", "unavailable");
  }
  if (status === 401 || status === 403) throw new AdminCmsError("A sessão administrativa expirou ou não tem autorização. Volte a autenticar-se.", "forbidden");
  if (status === 409 || message.includes("record_conflict_or_missing") || message.includes("duplicate key")) {
    throw new AdminCmsError("O registo foi alterado por outra operação ou existe um slug/valor duplicado. Recarregue os dados antes de guardar.", "conflict");
  }
  if (status === 400 || status === 422 || message.includes("invalid") || message.includes("not_editable") || message.includes("unsupported")) {
    throw new AdminCmsError("A base de dados rejeitou os dados. Reveja os campos indicados e tente novamente.", "invalid");
  }
  if (status === 404 || message.includes("record_not_found")) {
    throw new AdminCmsError("O registo já não existe. Actualize a lista antes de continuar.", "not_found");
  }
  if (status >= 500) throw new AdminCmsError("O serviço editorial está temporariamente indisponível. Os dados introduzidos foram mantidos para repetir.", "unavailable");
  throw new AdminCmsError("A operação não foi confirmada pela base de dados. Os dados introduzidos foram mantidos.", "unknown");
}

async function restRequest<T>(
  context: AdminContext,
  resource: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(resource, context.supabase.url), {
      ...init,
      cache: "no-store",
      headers: { ...headers(context), ...(init.headers ?? {}) },
    });
  } catch {
    throw new AdminCmsError("Não foi possível contactar o Supabase. Verifique a ligação e tente novamente.", "unavailable");
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    publicError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new AdminCmsError("O serviço devolveu uma resposta inválida; a operação não foi confirmada.", "unknown");
  }
}

async function readRows(context: AdminContext, table: (typeof TABLES)[number]): Promise<TableState> {
  const publicSafeOutboxSelect = "id,message_type,recipient,status,attempts,next_attempt_at,last_error,sent_at,created_at,updated_at";
  const params = new URLSearchParams({ select: table === "email_outbox" ? publicSafeOutboxSelect : "*" });
  const order = ORDER_BY[table];
  if (order) params.set("order", order);
  if (table === "content_revisions" || table === "contact_submissions" || table === "newsletter_subscribers" || table === "email_outbox") {
    params.set("limit", "100");
  } else if (table === "asset_migration_inventory") {
    params.set("limit", "200");
  }
  try {
    const rows = await restRequest<unknown[]>(context, `/rest/v1/${table}?${params}`);
    if (!Array.isArray(rows)) return { rows: [], error: "A resposta do serviço não contém uma lista de registos." };
    return { rows: rows as Row[], error: null };
  } catch (error) {
    const message = error instanceof AdminCmsError ? error.message : "Não foi possível carregar este módulo.";
    return { rows: [], error: message };
  }
}

export async function loadAdminWorkspace() {
  const context = await getAdminServerContext();
  const results = await Promise.all([
    ...TABLES.map(async (table) => [table, await readRows(context, table)] as const),
    (async () => {
      try {
        const buckets = await restRequest<Array<{ id: string; name: string; public: boolean }>>(context, "/storage/v1/bucket");
        return ["storage", { status: "ready", buckets } as const] as const;
      } catch (error) {
        return ["storage", {
          status: "unavailable",
          buckets: [],
          error: error instanceof AdminCmsError ? error.message : "O estado do armazenamento não pôde ser confirmado.",
        } as const] as const;
      }
    })(),
  ]);
  const tables = Object.fromEntries(results.filter((entry) => entry[0] !== "storage")) as Record<string, TableState>;
  const storage = results.find((entry) => entry[0] === "storage")?.[1];
  return {
    actor: { id: context.actor.id, email: context.actor.email },
    tables,
    storage,
    loadedAt: new Date().toISOString(),
  };
}

export async function mutateAdminContent(input: {
  entity: AdminEntity;
  action: AdminAction;
  id: string | null;
  payload: InputRow;
  expectedUpdatedAt: string | null;
  note?: string | null;
}) {
  const context = await getAdminServerContext();
  const publicSiteUrl = process.env["PUBLIC_SITE_URL"]?.trim();
  let payload: Row;
  let validationInput = input.payload;
  let settingKey: string | undefined;
  // These portfolio controls must also work while an older Supabase project
  // still exposes the previous editorial RPC actor contract. Keep the
  // optimistic timestamp guard and use the authenticated server REST client.
  if (input.entity === "projects" && input.id &&
      ((input.action === "archive" && Object.keys(input.payload).length === 0) ||
       (input.action === "publish" && Object.keys(input.payload).length === 1 && "featured" in input.payload))) {
    if (!input.expectedUpdatedAt) throw new AdminCmsError("Recarregue o projecto antes de alterar o estado.", "conflict");
    const currentRows = await restRequest<Row[]>(context, `/rest/v1/projects?id=eq.${encodeURIComponent(input.id)}&select=id,updated_at,status,featured`);
    const current = currentRows[0];
    if (!current) throw new AdminCmsError("O projecto já não existe. Actualize a lista.", "not_found");
    if (current["updated_at"] !== input.expectedUpdatedAt) {
      throw new AdminCmsError("Conflito: o projecto foi alterado depois de abrir a lista. Actualize os dados.", "conflict");
    }
    const next = input.action === "archive"
      ? { status: "archived", featured: false }
      : { featured: Boolean(input.payload["featured"]) };
    const rows = await restRequest<Row[]>(context, `/rest/v1/projects?id=eq.${encodeURIComponent(input.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(next),
    });
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new AdminCmsError("O projecto foi alterado ou não existe. Actualize os dados antes de tentar novamente.", "conflict");
    }
    return { record: rows[0], published_revision: 0 };
  }
  if (
    input.entity === "site_settings" &&
    input.id &&
    input.action !== "archive"
  ) {
    const existing = await restRequest<Row[]>(
      context,
      `/rest/v1/site_settings?id=eq.${encodeURIComponent(input.id)}&select=id,setting_key,setting_value,is_public,updated_at`,
    );
    const current = existing[0];
    if (!current) throw new AdminCmsError("A definição já não existe. Actualize a lista.", "not_found");
    if (current["updated_at"] !== input.expectedUpdatedAt) {
      throw new AdminCmsError("Conflito: a definição foi alterada depois de abrir o formulário. Os valores locais foram preservados.", "conflict");
    }
    if (typeof current["setting_key"] !== "string") {
      throw new AdminCmsError("A chave da definição não foi confirmada pelo servidor.", "invalid");
    }
    settingKey = current["setting_key"];
    validationInput = { setting_value: current["setting_value"], is_public: current["is_public"], ...input.payload };
  }
  if (
    input.entity === "page_sections" &&
    input.id &&
    input.action !== "archive" &&
    input.action !== "restore" &&
    ("config" in input.payload || "is_visible" in input.payload)
  ) {
    const existing = await restRequest<Row[]>(
      context,
      `/rest/v1/page_sections?id=eq.${encodeURIComponent(input.id)}&select=id,page_id,section_type,config,is_visible,updated_at`,
    );
    const current = existing[0];
    if (!current) throw new AdminCmsError("A secção já não existe. Actualize a lista.", "not_found");
    if (current["updated_at"] !== input.expectedUpdatedAt) {
      throw new AdminCmsError("Conflito: a secção foi alterada depois de abrir o formulário. Os seus valores locais foram preservados.", "conflict");
    }
    validationInput = {
      page_id: input.payload["page_id"] ?? current["page_id"],
      section_type: input.payload["section_type"] ?? current["section_type"],
      config: input.payload["config"] ?? current["config"],
      is_visible: input.payload["is_visible"] ?? current["is_visible"],
      ...input.payload,
    };
  }

  if (
    input.entity === "projects" &&
    input.id &&
    input.action !== "archive" &&
    input.action !== "restore" &&
    ("gallery" in input.payload || "gallery_alt" in input.payload)
  ) {
    const existing = await restRequest<Row[]>(
      context,
      `/rest/v1/projects?id=eq.${encodeURIComponent(input.id)}&select=id,gallery,gallery_alt,updated_at`,
    );
    const current = existing[0];
    if (!current) throw new AdminCmsError("O projecto já não existe. Actualize a lista.", "not_found");
    if (current["updated_at"] !== input.expectedUpdatedAt) {
      throw new AdminCmsError("Conflito: o projecto foi alterado depois de abrir o formulário. Os valores locais foram preservados.", "conflict");
    }
    validationInput = {
      gallery: current["gallery"] ?? [],
      gallery_alt: current["gallery_alt"] ?? [],
      ...validationInput,
      ...input.payload,
    };
  }
  try {
    const validated = validateAdminPayload(input.entity, validationInput, input.action, {
      creating: input.id === null && input.action !== "archive" && input.action !== "restore",
      publicSiteUrl: publicSiteUrl ?? "",
      ...(settingKey ? { settingKey } : {}),
    });
    payload = Object.fromEntries(
      Object.keys(input.payload)
        .filter((key) => key in validated)
        .map((key) => [key, validated[key]]),
    ) as Row;
  } catch (error) {
    if (error instanceof Error) {
      throw new AdminCmsError(error.message, "invalid");
    }
    throw new AdminCmsError("Os dados não passaram a validação do servidor.", "invalid");
  }
  if (input.id !== null && !input.expectedUpdatedAt) {
    throw new AdminCmsError("O registo não tem uma versão base para verificar conflitos. Recarregue-o.", "conflict");
  }
  const result = await restRequest<{ record: Row; published_revision: number }>(
    context,
    "/rest/v1/rpc/admin_mutate_content",
    {
      method: "POST",
      body: JSON.stringify({
        p_entity_type: input.entity,
        p_action: input.action,
        p_entity_id: input.id,
        p_payload: payload,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_actor_id: null, // PIN-only session: no auth.users row; DB authorises service_role calls with null actor
        p_note: input.note ?? null,
      }),
    },
  );
  if (!result || typeof result !== "object" || !("record" in result) || !("published_revision" in result)) {
    throw new AdminCmsError("A base de dados não confirmou a publicação com a revisão esperada.", "unknown");
  }
  return result;
}

export async function reorderAdminContent(input: {
  entity: string;
  ids: string[];
  pageId: string | null;
}) {
  const context = await getAdminServerContext();
  const entity = zReorderEntity(input.entity);
  if (entity === "projects") {
    await Promise.all(input.ids.map((id, position) => restRequest<Row[]>(context, `/rest/v1/projects?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ position }),
    })));
    return { count: input.ids.length, published_revision: 0 };
  }
  const result = await restRequest<{ count: number; published_revision: number }>(
    context,
    "/rest/v1/rpc/admin_reorder_content",
    {
      method: "POST",
      body: JSON.stringify({
        p_entity_type: entity,
        p_ids: input.ids,
        p_page_id: input.pageId,
        p_actor_id: null, // PIN-only session: no auth.users row; DB authorises service_role calls with null actor
      }),
    },
  );
  return result;
}

export async function deleteArchivedProject(input: {
  id: string;
  expectedUpdatedAt: string;
  note?: string | null;
}) {
  const context = await getAdminServerContext();
  const result = await restRequest<{ record: Row; published_revision: number }>(
    context,
    "/rest/v1/rpc/admin_delete_archived_project",
    {
      method: "POST",
      body: JSON.stringify({
        p_entity_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_actor_id: null,
        p_note: input.note ?? null,
      }),
    },
  );
  if (!result || typeof result !== "object" || !("record" in result) || !("published_revision" in result)) {
    throw new AdminCmsError("A base de dados não confirmou a eliminação definitiva.", "unknown");
  }
  return result;
}

function zReorderEntity(value: string): string {
  const allowed = [
    "page_sections", "projects", "clients", "experience_items", "metrics",
    "skills", "disciplines", "principles", "services", "process_steps",
  ];
  if (!allowed.includes(value)) throw new AdminCmsError("Este módulo não permite reordenação.", "invalid");
  return value;
}

export async function updateContactSubmission(input: {
  id: string;
  status: "new" | "in_review" | "replied" | "archived";
  internalNotes: string;
  expectedUpdatedAt: string;
}) {
  const context = await getAdminServerContext();
  const expected = new Date(input.expectedUpdatedAt);
  if (!Number.isFinite(expected.getTime()) || input.internalNotes.length > 4000) {
    throw new AdminCmsError("Os dados do pedido de contacto são inválidos.", "invalid");
  }
  return restRequest<{ record: Row }>(
    context,
    "/rest/v1/rpc/admin_update_contact_submission",
    {
      method: "POST",
      body: JSON.stringify({
        p_submission_id: input.id,
        p_status: input.status,
        p_internal_notes: input.internalNotes,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_actor_id: null, // PIN-only session: no auth.users row; DB authorises service_role calls with null actor
      }),
    },
  );
}

export function parseAdminEntity(entity: unknown): AdminEntity {
  const parsed = AdminEntitySchema.safeParse(entity);
  if (!parsed.success) throw new AdminCmsError("Módulo editorial desconhecido.", "invalid");
  return parsed.data;
}
