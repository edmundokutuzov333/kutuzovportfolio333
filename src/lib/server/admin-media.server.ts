import { getAdminServerContext } from "@/lib/server/admin-auth.server";
import { inspectImageBytes, normalizeObjectPath, referencesAsset, type SupportedImageMime } from "@/lib/media-validation";

type Row = Record<string, unknown>;
const PUBLIC_BUCKET = "portfolio-public-assets";
const PRIVATE_BUCKET = "contact-private-attachments";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export class AdminMediaError extends Error {
  constructor(message: string, readonly code: "invalid" | "not_found" | "forbidden" | "conflict" | "unavailable" | "unknown" = "unknown") {
    super(message);
    this.name = "AdminMediaError";
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function safeOriginalName(value: string): string {
  const withoutPath = value.replace(/[/\\]/g, "_");
  const safe = Array.from(withoutPath).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
  return safe.trim().slice(0, 180) || "image";
}

function publicAssetUrl(url: string, path: string): string {
  return url.replace(/\/+$/, "") + "/storage/v1/object/public/" + PUBLIC_BUCKET + "/" + encodePath(path);
}

async function request<T>(context: Awaited<ReturnType<typeof getAdminServerContext>>, resource: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(resource, context.supabase.url), {
      ...init,
      cache: "no-store",
      headers: {
        apikey: context.supabase.serviceRoleKey,
        Authorization: "Bearer " + context.supabase.serviceRoleKey,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminMediaError("Não foi possível contactar o serviço de armazenamento. Tente novamente.", "unavailable");
  }
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new AdminMediaError("A sessão administrativa não tem autorização para esta operação.", "forbidden");
    if (response.status === 404) throw new AdminMediaError("O asset ou recurso já não existe. Actualize a lista.", "not_found");
    if (response.status === 409) throw new AdminMediaError("O asset foi alterado por outra operação. Actualize a lista e tente novamente.", "conflict");
    if (response.status >= 500) throw new AdminMediaError("O serviço de armazenamento está temporariamente indisponível.", "unavailable");
    throw new AdminMediaError("O serviço rejeitou os dados do asset. Verifique o ficheiro e tente novamente.", "invalid");
  }
  if (response.status === 204 || !text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { throw new AdminMediaError("O serviço devolveu uma resposta inválida.", "unknown"); }
}

async function storageRequest<T>(context: Awaited<ReturnType<typeof getAdminServerContext>>, resource: string, init: RequestInit = {}): Promise<T> {
  return request<T>(context, resource, init);
}

export function validateMediaUploadInput(input: { originalName: string; contentType: string; byteSize: number; altText?: string; caption?: string }) {
  const supported = ["image/png", "image/jpeg", "image/webp"];
  if (!supported.includes(input.contentType)) throw new AdminMediaError("Formato não permitido. Utilize PNG, JPG ou WEBP. SVG não é aceite sem sanitização.", "invalid");
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_UPLOAD_BYTES) {
    throw new AdminMediaError("O ficheiro tem de ter entre 1 byte e 15 MB.", "invalid");
  }
  if (input.originalName.length > 180) throw new AdminMediaError("O nome original excede 180 caracteres.", "invalid");
  if ((input.altText?.length ?? 0) > 300 || (input.caption?.length ?? 0) > 500) {
    throw new AdminMediaError("O texto alternativo excede 300 caracteres ou a legenda excede 500 caracteres.", "invalid");
  }
}

export async function createMediaUpload(input: { originalName: string; contentType: SupportedImageMime; byteSize: number }) {
  const context = await getAdminServerContext();
  validateMediaUploadInput(input);
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType === "image/png" ? "png" : "webp";
  const now = new Date();
  const path = `uploads/${context.actor.sessionId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${extension}`;
  const data = await storageRequest<{ url?: string; token?: string; path?: string }>(
    context,
    `/storage/v1/object/upload/sign/${PUBLIC_BUCKET}/${encodePath(path)}`,
    { method: "POST", body: JSON.stringify({ upsert: false }) },
  );
  let uploadUrl: URL;
  if (typeof data.url === "string") {
    uploadUrl = data.url.startsWith("http")
      ? new URL(data.url)
      : new URL(data.url.startsWith("/storage/v1/") ? data.url : "/storage/v1" + (data.url.startsWith("/") ? data.url : "/" + data.url), context.supabase.url);
  } else if (typeof data.token === "string") {
    uploadUrl = new URL(`/storage/v1/object/upload/sign/${PUBLIC_BUCKET}/${encodePath(path)}?token=${encodeURIComponent(data.token)}`, context.supabase.url);
  } else {
    throw new AdminMediaError("O armazenamento não devolveu um URL temporário de upload.", "unknown");
  }
  if (uploadUrl.origin !== new URL(context.supabase.url).origin || !uploadUrl.pathname.includes("/storage/v1/object/upload/sign/")) {
    throw new AdminMediaError("O armazenamento devolveu um URL de upload inesperado.", "unknown");
  }
  return { path, uploadUrl: uploadUrl.toString(), expiresInSeconds: 120 };
}

async function deleteStorageObject(context: Awaited<ReturnType<typeof getAdminServerContext>>, bucket: string, path: string): Promise<void> {
  await storageRequest(context, `/storage/v1/object/${bucket}/${encodePath(path)}`, { method: "DELETE" });
}

export async function cancelUnregisteredMediaUpload(input: { path: string }) {
  const context = await getAdminServerContext();
  const path = normalizeObjectPath(input.path);
  if (!path || !path.startsWith(`uploads/${context.actor.sessionId}/`)) throw new AdminMediaError("O caminho de upload não pertence à sua sessão.", "forbidden");
  const rows = await request<Row[]>(context, `/rest/v1/media_assets?bucket_id=eq.${PUBLIC_BUCKET}&object_path=eq.${encodeURIComponent(path)}&select=id`);
  if (rows.length > 0) return { removed: false, reason: "already_registered" };
  const references = await findAssetReferences(context, path);
  if (references.length > 0) return { removed: false, reason: "asset_referenced" };
  await deleteStorageObject(context, PUBLIC_BUCKET, path);
  return { removed: true };
}

export async function completeMediaUpload(input: {
  path: string; originalName: string; contentType: SupportedImageMime; byteSize: number; altText: string; caption: string;
}) {
  const context = await getAdminServerContext();
  validateMediaUploadInput(input);
  const path = normalizeObjectPath(input.path);
  if (!path || !path.startsWith(`uploads/${context.actor.sessionId}/`)) {
    throw new AdminMediaError("O caminho de upload não pertence à sessão administrativa actual.", "forbidden");
  }
  if (input.altText.length > 300 || input.caption.length > 500) throw new AdminMediaError("Texto alternativo ou legenda demasiado longos.", "invalid");
  const resource = `/storage/v1/object/${PUBLIC_BUCKET}/${encodePath(path)}`;
  let bytes: Uint8Array;
  let observedMime: string;
  try {
    const key = context.supabase.serviceRoleKey;
    const response = await fetch(new URL(resource, context.supabase.url), {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
    });
    if (!response.ok) throw new AdminMediaError("O objecto carregado não pôde ser verificado. Volte a carregar o ficheiro.", response.status === 404 ? "not_found" : "unavailable");
    observedMime = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof AdminMediaError) throw error;
    throw new AdminMediaError("Não foi possível verificar os bytes do ficheiro carregado.", "unavailable");
  }

  if (bytes.byteLength !== input.byteSize || bytes.byteLength <= 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    await deleteStorageObject(context, PUBLIC_BUCKET, path).catch(() => undefined);
    throw new AdminMediaError("O tamanho real do ficheiro não corresponde ao anunciado ou excede 15 MB.", "invalid");
  }
  const inspected = inspectImageBytes(bytes);
  if (!inspected || inspected.mime !== input.contentType || (observedMime !== inspected.mime && observedMime !== "application/octet-stream")) {
    await deleteStorageObject(context, PUBLIC_BUCKET, path).catch(() => undefined);
    throw new AdminMediaError("O conteúdo real não corresponde a uma imagem PNG, JPG ou WEBP válida.", "invalid");
  }

  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const sha = await crypto.subtle.digest("SHA-256", digestInput.buffer);
  const sha256 = Array.from(new Uint8Array(sha), (value) => value.toString(16).padStart(2, "0")).join("");
  const mediaRecord = {
    bucket_id: PUBLIC_BUCKET,
    object_path: path,
    original_name: safeOriginalName(input.originalName),
    content_type: inspected.mime,
    byte_size: bytes.byteLength,
    width: inspected.width,
    height: inspected.height,
    sha256,
    alt_text: input.altText.trim() || null,
    caption: input.caption.trim() || null,
    is_public: true,
    uploaded_by: context.actor.id,
  };
  let record: Row | null = null;
  try {
    const rows = await request<Row[]>(context, "/rest/v1/media_assets?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(mediaRecord),
    });
    record = rows[0] ?? null;
    if (!record || typeof record["id"] !== "string") throw new AdminMediaError("A base de dados não confirmou o registo do asset.", "unknown");
  } catch (error) {
    await deleteStorageObject(context, PUBLIC_BUCKET, path).catch(() => undefined);
    if (error instanceof AdminMediaError) throw error;
    throw new AdminMediaError("O objecto foi carregado, mas o registo não foi confirmado. O objecto foi removido.", "unavailable");
  }

  let auditRecorded = true;
  try {
    await request(context, "/rest/v1/admin_audit_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_id: context.actor.id,
        event_type: "media_uploaded",
        success: true,
        subject: path,
        metadata: { media_asset_id: record["id"], content_type: inspected.mime, byte_size: bytes.byteLength, sha256 },
      }),
    });
  } catch {
    auditRecorded = false;
  }
  const asset = {
    id: String(record["id"]),
    bucket_id: String(record["bucket_id"] ?? PUBLIC_BUCKET),
    object_path: String(record["object_path"] ?? path),
    original_name: record["original_name"] == null ? null : String(record["original_name"]),
    content_type: String(record["content_type"] ?? inspected.mime),
    byte_size: Number(record["byte_size"] ?? bytes.byteLength),
    width: Number(record["width"] ?? inspected.width),
    height: Number(record["height"] ?? inspected.height),
    sha256: String(record["sha256"] ?? sha256),
    alt_text: record["alt_text"] == null ? null : String(record["alt_text"]),
    caption: record["caption"] == null ? null : String(record["caption"]),
    is_public: record["is_public"] === true,
    uploaded_by: record["uploaded_by"] == null ? null : String(record["uploaded_by"]),
    created_at: typeof record["created_at"] === "string" ? record["created_at"] : new Date().toISOString(),
  };
  return {
    asset,
    publicUrl: publicAssetUrl(context.supabase.url, path),
    auditRecorded,
  };
}

async function rows(context: Awaited<ReturnType<typeof getAdminServerContext>>, table: string): Promise<Row[]> {
  const data = await request<unknown>(context, `/rest/v1/${table}?select=*&limit=1000`);
  if (!Array.isArray(data) || data.length >= 1000) {
    throw new AdminMediaError("A verificação de referências está incompleta. A remoção foi bloqueada por segurança.", "unavailable");
  }
  return data as Row[];
}

async function findAssetReferences(context: Awaited<ReturnType<typeof getAdminServerContext>>, path: string): Promise<string[]> {
  const url = publicAssetUrl(context.supabase.url, path);
  const tables = ["projects", "clients", "pages", "profile_content", "page_sections", "site_settings", "services", "process_steps", "disciplines", "skills", "principles", "metrics", "experience_items", "content_revisions"];
  const results = await Promise.all(tables.map(async (table) => ({ table, values: await rows(context, table) })));
  const references: string[] = [];
  for (const result of results) {
    for (const row of result.values) {
      if (referencesAsset(row, path, url)) {
        const label = String(row["slug"] ?? row["title"] ?? row["name"] ?? row["section_key"] ?? row["setting_key"] ?? row["id"] ?? "registo");
        references.push(`${result.table}: ${label}`);
      }
    }
  }
  return [...new Set(references)];
}

export async function getMediaAssetReferences(input: { id: string }) {
  const context = await getAdminServerContext();
  const found = await request<Row[]>(context, `/rest/v1/media_assets?id=eq.${encodeURIComponent(input.id)}&select=id,bucket_id,object_path,original_name&limit=1`);
  const asset = found[0];
  if (!asset || typeof asset["object_path"] !== "string") throw new AdminMediaError("O asset já não existe.", "not_found");
  if (asset["bucket_id"] !== PUBLIC_BUCKET) throw new AdminMediaError("Só é permitido consultar assets do bucket público do portfólio.", "invalid");
  return { references: await findAssetReferences(context, asset["object_path"]) };
}

export async function deleteMediaAsset(input: { id: string }) {
  const context = await getAdminServerContext();
  const found = await request<Row[]>(context, `/rest/v1/media_assets?id=eq.${encodeURIComponent(input.id)}&select=id,bucket_id,object_path,original_name&limit=1`);
  const asset = found[0];
  if (!asset || typeof asset["object_path"] !== "string") throw new AdminMediaError("O asset já não existe.", "not_found");
  if (asset["bucket_id"] !== PUBLIC_BUCKET) throw new AdminMediaError("Este módulo não pode remover anexos privados de contactos.", "forbidden");
  const path = normalizeObjectPath(asset["object_path"]);
  if (!path) throw new AdminMediaError("O caminho guardado no registo é inválido; a remoção foi bloqueada.", "invalid");
  const references = await findAssetReferences(context, path);
  if (references.length > 0) throw new AdminMediaError(`O asset continua a ser utilizado e não foi removido: ${references.slice(0, 8).join(", ")}.`, "conflict");

  await deleteStorageObject(context, PUBLIC_BUCKET, path);
  await request(context, `/rest/v1/media_assets?id=eq.${encodeURIComponent(input.id)}&bucket_id=eq.${PUBLIC_BUCKET}`, { method: "DELETE" });
  await request(context, "/rest/v1/admin_audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ actor_id: context.actor.id, event_type: "media_deleted", success: true, subject: path, metadata: { media_asset_id: input.id } }),
  }).catch(() => undefined);
  return { deleted: true, id: input.id };
}

export async function createSignedContactAttachmentUrl(input: { submissionId: string; path: string }) {
  const context = await getAdminServerContext();
  const path = normalizeObjectPath(input.path);
  if (!path || !path.startsWith(`${input.submissionId}/`)) throw new AdminMediaError("O caminho do anexo não pertence ao pedido de contacto.", "forbidden");
  const found = await request<Row[]>(context, `/rest/v1/contact_submissions?id=eq.${encodeURIComponent(input.submissionId)}&select=id,attachment_paths&limit=1`);
  const submission = found[0];
  if (!submission) throw new AdminMediaError("O pedido de contacto não existe.", "not_found");
  const paths = submission["attachment_paths"];
  if (!Array.isArray(paths) || !paths.some((value) => value === path)) throw new AdminMediaError("O anexo não está associado a este pedido.", "forbidden");
  const data = await storageRequest<{ signedURL?: string; signedUrl?: string }>(
    context,
    `/storage/v1/object/sign/${PRIVATE_BUCKET}/${encodePath(path)}`,
    { method: "POST", body: JSON.stringify({ expiresIn: 120 }) },
  );
  const signed = data.signedURL ?? data.signedUrl;
  if (typeof signed !== "string") throw new AdminMediaError("Não foi possível criar um link temporário para o anexo.", "unknown");
  const url = signed.startsWith("http") ? new URL(signed) : new URL(signed.startsWith("/storage/v1/") ? signed : "/storage/v1" + (signed.startsWith("/") ? signed : "/" + signed), context.supabase.url);
  if (url.origin !== new URL(context.supabase.url).origin) throw new AdminMediaError("O armazenamento devolveu um link inválido.", "unknown");
  return { url: url.toString(), expiresInSeconds: 120, path };
}

export async function retryEmailOutbox(input: { id: string }) {
  const context = await getAdminServerContext();
  const timestamp = String(Date.now());
  const payload = `${input.id}.${timestamp}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(context.supabase.serviceRoleKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(signed), (value) => value.toString(16).padStart(2, "0")).join("");
  let response: Response;
  try {
    response = await fetch(new URL("/functions/v1/public-forms?action=retry-email", context.supabase.url), {
      method: "POST",
      headers: {
        apikey: context.supabase.serviceRoleKey,
        Authorization: "Bearer " + context.supabase.serviceRoleKey,
        "x-outbox-id": input.id,
        "x-outbox-timestamp": timestamp,
        "x-outbox-signature": signature,
      },
    });
  } catch {
    throw new AdminMediaError("O serviço de entrega de email não respondeu. O pedido permaneceu na fila.", "unavailable");
  }
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || result?.["ok"] !== true) {
    const status = typeof result?.["status"] === "string" ? result["status"] : "email_delivery_failed";
    const message = status.startsWith("hostinger_smtp_")
      ? "A configuração SMTP da Hostinger está incompleta ou inválida. O email não foi enviado e o registo continua na fila."
      : "Não foi possível enviar o email. O estado de falha foi registado na fila; poderá tentar novamente.";
    throw new AdminMediaError(message, "unavailable");
  }
  return { sent: true };
}
