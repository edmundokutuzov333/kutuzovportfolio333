import { inspectImageBytes } from "./image-validation.ts";
import nodemailer from "npm:nodemailer@^9";

const PRODUCTION_ORIGIN = "https://kutuzovportfolio333.lovable.app";
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://edmundokutuzov.art",
  "https://www.edmundokutuzov.art",
  "https://kutuzovportfolio333.lovable.app",
  "https://id-preview--866320a4-978d-403b-b184-3e3fd57d0c19.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 17 * 1024 * 1024;
const CONSENT_VERSION = "newsletter-consent-v1-2026-10-29";
const BUCKET_PRIVATE = "contact-private-attachments";

type ContactUpload = { path: string; mime: string; size: number; width: number | null; height: number | null; name: string; bytes: Uint8Array };

function json(data: unknown, status = 200, origin?: string) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info, x-outbox-id, x-outbox-timestamp, x-outbox-signature");
  headers.set("vary", "Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("access-control-allow-origin", origin);
  return new Response(JSON.stringify(data), { status, headers });
}

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof keys.default === "string") return keys.default;
    const first = Object.values(keys).find((value) => typeof value === "string");
    if (typeof first === "string") return first;
  } catch {
    // Missing or malformed platform secret is handled below.
  }
  throw new Error("service_key_unavailable");
}

function apiBase(): string {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  if (!url || !url.startsWith("https://")) throw new Error("supabase_url_unavailable");
  return url;
}

async function db(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = serviceKey();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", "Bearer " + key);
  headers.set("accept", "application/json");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(apiBase() + path, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error("database_http_" + response.status);
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error("database_invalid_response"); }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const item = value[0];
    return item && typeof item === "object" ? item as Record<string, unknown> : null;
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requestIp(request: Request): string {
  const trusted = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (trusted && trusted.length <= 100) return trusted.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length <= 100 ? forwarded : "unknown";
}

async function rateLimit(request: Request, purpose: "contact" | "newsletter" | "newsletter_action"): Promise<boolean> {
  const key = await sha256Hex(serviceKey() + ":" + purpose + ":" + requestIp(request));
  const result = await db("/rest/v1/rpc/consume_public_form_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_purpose: purpose, p_key_hash: key, p_now: new Date().toISOString() }),
  });
  if (result === true) return true;
  if (result === false) return false;
  const record = firstRecord(result);
  if (record?.["allowed"] === true) return true;
  if (record?.["allowed"] === false) return false;
  throw new Error("rate_limit_store_unavailable");
}

function formText(form: FormData, key: string, max: number, required = false): string {
  const entry = form.get(key);
  const value = typeof entry === "string" ? entry.trim() : "";
  if (required && !value) throw new Error("missing_" + key);
  if (value.length > max) throw new Error("invalid_" + key);
  return value;
}

function cleanOriginalName(name: string): string {
  const withoutPath = name.replace(/[/\\\\]/g, "_");
  const safe = Array.from(withoutPath).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
  return safe.slice(0, 180) || "reference";
}

function inspectContactFile(file: File, bytes: Uint8Array): { mime: string; width: number | null; height: number | null } | null {
  const declared = file.type.toLowerCase();
  const pdfName = /\\.pdf$/i.test(file.name);
  const pdfMagic = bytes.length >= 8 &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" &&
    bytes.slice(0, 8).every((byte) => byte >= 0x20 && byte <= 0x7e);
  if (pdfName && pdfMagic && (declared === "application/pdf" || declared === "" || declared === "application/octet-stream")) {
    return { mime: "application/pdf", width: null, height: null };
  }
  const image = inspectImageBytes(bytes);
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mime)) return null;
  if (declared && declared !== image.mime) return null;
  return { mime: image.mime, width: image.width, height: image.height };
}

const ALLOWED_PROJECT_STAGES = new Set([
  "Idea or early concept",
  "Strategy and planning",
  "New brand or product launch",
  "Existing brand refresh",
  "Campaign already in progress",
  "Ready for execution",
  "Not sure yet",
]);
const ALLOWED_INDUSTRIES = new Set([
  "Technology and SaaS", "Finance and fintech", "Consumer goods and FMCG", "Fashion and lifestyle",
  "Entertainment and music", "Hospitality and tourism", "Real estate and construction",
  "Healthcare and wellness", "Education", "NGO and social impact", "Public sector",
  "Retail and e-commerce", "Food and beverage", "Other",
]);
const ALLOWED_DELIVERABLES = new Set([
  "Brand strategy and positioning", "Naming and verbal identity", "Logo and visual identity",
  "Brand guidelines", "Campaign concept and key visual", "Social media assets",
  "Motion graphics and animation", "Video direction and production", "Website or landing page",
  "UI/UX design", "Presentation or pitch deck", "Packaging and product visuals",
  "Photography and image retouching", "3D, CGI or AI-generated visuals",
  "Content strategy and copy", "Launch assets and rollout",
]);

function formStringArray(form: FormData, key: string, maxItems: number, maxLength: number): string[] {
  const raw = formText(form, key, 4000);
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("invalid_" + key); }
  if (!Array.isArray(value) || value.length > maxItems ||
      !value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= maxLength)) {
    throw new Error("invalid_" + key);
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function encodePath(path: string): string {function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function uploadPrivate(path: string, mime: string, bytes: Uint8Array): Promise<void> {
  const key = serviceKey();
  const response = await fetch(apiBase() + "/storage/v1/object/" + BUCKET_PRIVATE + "/" + encodePath(path), {
    method: "POST",
    headers: {
      apikey: key, authorization: "Bearer " + key, "content-type": mime,
      "cache-control": "3600", "x-upsert": "false",
    },
    body: bytes,
  });
  if (!response.ok) throw new Error("private_attachment_upload_failed");
}

async function deletePrivate(path: string): Promise<void> {
  const key = serviceKey();
  await fetch(apiBase() + "/storage/v1/object/" + BUCKET_PRIVATE + "/" + encodePath(path), {
    method: "DELETE", headers: { apikey: key, authorization: "Bearer " + key },
  }).catch(() => undefined);
}

async function getPublishedProjectTypes(): Promise<string[]> {
  const url = new URL(apiBase() + "/rest/v1/site_settings");
  url.searchParams.set("select", "setting_value");
  url.searchParams.set("setting_key", "eq.project_types");
  url.searchParams.set("is_public", "eq.true");
  url.searchParams.set("limit", "1");
  const result = await db(url.pathname + url.search);
  const rows = Array.isArray(result) ? result : [];
  const value = rows.length > 0 ? (rows[0] as Record<string, unknown>)["setting_value"] : null;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("project_types_unavailable");
  }
  return value as string[];
}

async function getNotificationRecipient(): Promise<string | null> {
  // Accept only aliases/mailboxes already configured in Hostinger.
  // Multiple notification addresses may be separated by commas, semicolons or new lines.
  const configured = Deno.env.get("CONTACT_NOTIFICATION_EMAILS")?.trim()
    || Deno.env.get("ADMIN_EMAILS")?.trim()
    || Deno.env.get("ADMIN_EMAIL")?.trim();
  if (configured) {
    const recipients = configured.split(/[;,\n]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (recipients.length === 0 || recipients.length > 10 ||
        recipients.some((item) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item))) return null;
    return [...new Set(recipients)].join(", ");
  }

  const url = new URL(apiBase() + "/rest/v1/profile_content");
  url.searchParams.set("select", "public_email");
  url.searchParams.set("is_published", "eq.true");
  url.searchParams.set("limit", "1");
  const rows = await db(url.pathname + url.search);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const value = (rows[0] as Record<string, unknown>)["public_email"];
  return typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
    ? value.trim().toLowerCase() : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unbase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptTokenBundle(bundle: { confirmToken: string; unsubscribeToken: string }, secret: string): Promise<{ token_ciphertext: string; token_iv: string }> {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { token_ciphertext: base64(new Uint8Array(ciphertext)), token_iv: base64(iv) };
}

async function decryptTokenBundle(payload: Record<string, unknown>, secret: string): Promise<{ confirmToken: string; unsubscribeToken: string }> {
  if (typeof payload["token_ciphertext"] !== "string" || typeof payload["token_iv"] !== "string") {
    throw new Error("newsletter_token_payload_unavailable");
  }
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(payload["token_iv"]) }, key, unbase64(payload["token_ciphertext"]));
  const bundle = JSON.parse(new TextDecoder().decode(plain));
  if (typeof bundle.confirmToken !== "string" || typeof bundle.unsubscribeToken !== "string") {
    throw new Error("newsletter_token_payload_unavailable");
  }
  return bundle;
}

function randomHexToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function updateOutbox(id: string, patch: Record<string, unknown>): Promise<void> {
  const url = new URL(apiBase() + "/rest/v1/email_outbox");
  url.searchParams.set("id", "eq." + id);
  await db(url.pathname + url.search, {
    method: "PATCH",
    headers: { "prefer": "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}


type HostingerSmtpConfig = {
  host: string;
  port: 465;
  user: string;
  password: string;
  from: string;
};

type HostingerSmtpConfigResult =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "ready"; config: HostingerSmtpConfig };

function readHostingerSmtpConfig(): HostingerSmtpConfigResult {
  const hostRaw = Deno.env.get("SMTP_HOSTNAME")?.trim();
  const portRaw = Deno.env.get("SMTP_PORT")?.trim();
  const secureRaw = Deno.env.get("SMTP_SECURE")?.trim().toLowerCase();
  const user = Deno.env.get("SMTP_USERNAME")?.trim();
  const password = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM")?.trim() || user || "";
  const hasAnySetting = Boolean(hostRaw || portRaw || secureRaw || user || password || Deno.env.get("SMTP_FROM")?.trim());

  if (!hasAnySetting) return { status: "missing" };
  if (!user || !password?.trim() || !from) {
    return { status: "invalid", reason: "hostinger_smtp_credentials_incomplete" };
  }

  const port = portRaw ? Number(portRaw) : 465;
  if (!Number.isInteger(port) || port !== 465) {
    return { status: "invalid", reason: "hostinger_smtp_requires_port_465" };
  }
  if (secureRaw && secureRaw !== "true") {
    return { status: "invalid", reason: "hostinger_smtp_ssl_required" };
  }

  const host = hostRaw || "smtp.hostinger.com";
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    return { status: "invalid", reason: "hostinger_smtp_hostname_invalid" };
  }
  const fromAddress = from.replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromAddress)) {
    return { status: "invalid", reason: "hostinger_smtp_mailbox_invalid" };
  }
  // Hostinger only documents alias-sender selection in Webmail, not external SMTP clients.
  // Use aliases for notification recipients and keep the sender aligned with the authenticated mailbox.
  if (fromAddress !== user.toLowerCase()) {
    return { status: "invalid", reason: "hostinger_smtp_from_must_match_mailbox" };
  }

  return { status: "ready", config: { host, port: 465, user, password, from } };
}

async function sendViaHostingerSmtp(
  config: HostingerSmtpConfig,
  message: { to: string; subject: string; text: string; html: string; replyTo?: string },
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
  } finally {
    transport.close();
  }
}

async function attemptEmailOutbox(id: string): Promise<{ sent: boolean; reason: string }> {
  const claimedValue = await db("/rest/v1/rpc/claim_email_outbox", {
    method: "POST", body: JSON.stringify({ p_outbox_id: id, p_now: new Date().toISOString() }),
  });
  const row = firstRecord(claimedValue);
  if (!row || typeof row["id"] !== "string") return { sent: false, reason: "not_claimable" };

  const smtp = readHostingerSmtpConfig();

  if (smtp.status === "invalid") {
    await updateOutbox(id, { status: "failed", last_error: smtp.reason,
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    return { sent: false, reason: smtp.reason };
  }
  if (smtp.status === "missing") {
    await updateOutbox(id, { status: "failed", last_error: "hostinger_smtp_not_configured",
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    return { sent: false, reason: "hostinger_smtp_not_configured" };
  }

  const payload = row["payload"] && typeof row["payload"] === "object" ? row["payload"] as Record<string, unknown> : {};
  let subject = "";
  let text = "";
  let html = "";
  try {
    if (row["message_type"] === "contact_submission") {
      subject = "New portfolio enquiry: " + String(payload["request_type"] ?? "Contact request").slice(0, 180);
      const metadata = payload["metadata"] && typeof payload["metadata"] === "object" ? payload["metadata"] as Record<string, unknown> : {};
      const lines = [
        "A new enquiry was recorded in the portfolio.",
        "Name: " + String(payload["name"] ?? ""),
        "Email: " + String(payload["email"] ?? ""),
        "Company: " + String(payload["company"] ?? ""),
        "Request: " + String(payload["request_type"] ?? ""),
        "Budget: " + String(payload["budget"] ?? ""),
        "Message: " + String(payload["message"] ?? ""),
        "Phone: " + String(metadata["phone"] ?? ""),
        "Location: " + String(metadata["location"] ?? ""),
        "Deadline: " + String(metadata["deadline"] ?? ""),
        "Links: " + (Array.isArray(payload["links"]) ? (payload["links"] as unknown[]).join(", ") : ""),
        "Submission ID: " + String(payload["submission_id"] ?? ""),
      ];
      text = lines.join("\n");
      html = "<h2>New portfolio enquiry</h2><pre style=\"white-space:pre-wrap;font-family:Arial,sans-serif\">" + escapeHtml(lines.join("\n")) + "</pre>";
    } else if (row["message_type"] === "newsletter_confirmation") {
      const bundle = await decryptTokenBundle(payload, serviceKey());
      const origin = typeof payload["site_origin"] === "string" && ALLOWED_ORIGINS.has(payload["site_origin"])
        ? payload["site_origin"] : "";
      if (!origin || !origin.startsWith("https://") || origin !== PRODUCTION_ORIGIN) throw new Error("public_site_url_not_configured");
      const confirmUrl = origin + "/newsletter/confirm?token=" + encodeURIComponent(bundle.confirmToken);
      const unsubscribeUrl = origin + "/newsletter/unsubscribe?token=" + encodeURIComponent(bundle.unsubscribeToken);
      subject = "Confirm your Kutuzov newsletter subscription";
      text = "Please confirm your subscription by opening:\n" + confirmUrl + "\n\nTo unsubscribe, open:\n" + unsubscribeUrl + "\n\nIf you did not request this, ignore this message.";
      html = "<p>Please confirm your subscription.</p><p><a href=\"" + escapeHtml(confirmUrl) + "\">Confirm subscription</a></p><p>If you did not request this, ignore this message.</p><p><a href=\"" + escapeHtml(unsubscribeUrl) + "\">Unsubscribe</a></p>";
    } else {
      throw new Error("unsupported_email_message_type");
    }

    const replyTo = row["message_type"] === "contact_submission" &&
      typeof payload["email"] === "string" &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload["email"])
      ? payload["email"].trim()
      : undefined;

    await sendViaHostingerSmtp(smtp.config, {
      to: String(row["recipient"]),
      subject,
      text,
      html,
      replyTo,
    });
    const provider = "hostinger_smtp";

    const minimalPayload: Record<string, unknown> = { delivered: true, message_type: row["message_type"], provider };
    if (typeof payload["submission_id"] === "string") minimalPayload["submission_id"] = payload["submission_id"];
    if (typeof payload["subscriber_id"] === "string") minimalPayload["subscriber_id"] = payload["subscriber_id"];
    await updateOutbox(id, { status: "sent", sent_at: new Date().toISOString(), last_error: null, payload: minimalPayload });
    return { sent: true, reason: "sent" };
  } catch (error) {
    const reason = error instanceof Error && error.message === "public_site_url_not_configured"
      ? "public_site_url_not_configured"
      : error instanceof Error && error.message === "unsupported_email_message_type"
        ? "unsupported_email_message_type" : "email_delivery_failed";
    await updateOutbox(id, { status: "failed", last_error: reason,
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    return { sent: false, reason };
  }
}

async function contactSubmit(request: Request, origin?: string): Promise<Response> {
  if (!(await rateLimit(request, "contact"))) return json({ ok: false, error: "rate_limited" }, 429, origin);
  const form = await request.formData();
  const name = formText(form, "name", 180, true);
  const email = formText(form, "email", 320, true).toLowerCase();
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400, origin);
  const company = formText(form, "company", 180);
  const role = formText(form, "role", 180);
  const location = formText(form, "location", 240);
  const phone = formText(form, "phone", 80);
  const type = formText(form, "type", 180, true);
  const additionalTypes = formStringArray(form, "additionalTypes", 22, 180);
  const projectName = formText(form, "projectName", 180);
  const industry = formText(form, "industry", 120);
  const projectStage = formText(form, "projectStage", 120);
  const deliverables = formStringArray(form, "deliverables", 16, 120);
  const audience = formText(form, "audience", 800);
  const urgency = formText(form, "urgency", 20, true);
  const currency = formText(form, "currency", 3, true);
  const budget = formText(form, "budget", 120);
  const exact = formText(form, "exact", 80);
  const negotiable = form.get("negotiable") === "true";
  const deadline = formText(form, "deadline", 10);
  const channel = formText(form, "channel", 20, true);
  const message = formText(form, "message", 4000, true);
  const rawLinks = formText(form, "links", 2000);

  if (message.length < 10) return json({ ok: false, error: "invalid_message" }, 400, origin);
  if (![ "low", "normal", "high", "urgent" ].includes(urgency)) return json({ ok: false, error: "invalid_urgency" }, 400, origin);
  if (![ "email", "phone", "whatsapp", "linkedin" ].includes(channel)) return json({ ok: false, error: "invalid_channel" }, 400, origin);
  if (![ "EUR", "USD", "GBP", "BRL", "MZN" ].includes(currency)) return json({ ok: false, error: "invalid_currency" }, 400, origin);
  if (deadline && !/^\\d{4}-\\d{2}-\\d{2}$/.test(deadline)) return json({ ok: false, error: "invalid_deadline" }, 400, origin);
  if (industry && !ALLOWED_INDUSTRIES.has(industry)) return json({ ok: false, error: "invalid_industry" }, 400, origin);
  if (projectStage && !ALLOWED_PROJECT_STAGES.has(projectStage)) return json({ ok: false, error: "invalid_project_stage" }, 400, origin);
  if (deliverables.some((item) => !ALLOWED_DELIVERABLES.has(item))) return json({ ok: false, error: "invalid_deliverables" }, 400, origin);
  if (additionalTypes.includes(type)) return json({ ok: false, error: "duplicate_project_service" }, 400, origin);

  const projectTypes = await getPublishedProjectTypes();
  if (![type, ...additionalTypes].every((item) => projectTypes.includes(item))) {
    return json({ ok: false, error: "invalid_project_type" }, 400, origin);
  }

  const links: string[] = [];
  for (const value of rawLinks.split(/\\s+/).filter(Boolean)) {
    let parsed: URL;
    try { parsed = new URL(value); } catch { return json({ ok: false, error: "invalid_links" }, 400, origin); }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return json({ ok: false, error: "invalid_links" }, 400, origin);
    links.push(parsed.href);
    if (links.length > 10) return json({ ok: false, error: "too_many_links" }, 400, origin);
  }

  const fileEntries = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (fileEntries.length > MAX_FILES) return json({ ok: false, error: "too_many_files" }, 400, origin);
  if (fileEntries.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_FILE_BYTES ||
      fileEntries.some((file) => file.size > MAX_FILE_BYTES)) {
    return json({ ok: false, error: "file_size_limit" }, 413, origin);
  }

  const preparedFiles: ContactUpload[] = [];
  for (const file of fileEntries) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectContactFile(file, bytes);
    if (!inspected) return json({ ok: false, error: "invalid_or_unsupported_file" }, 400, origin);
    preparedFiles.push({
      path: "", mime: inspected.mime, size: bytes.byteLength,
      width: inspected.width, height: inspected.height,
      name: cleanOriginalName(file.name), bytes,
    });
  }

  const submissionId = crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    for (const file of preparedFiles) {
      const extension = file.mime === "application/pdf" ? "pdf"
        : file.mime === "image/jpeg" ? "jpg" : file.mime.split("/")[1];
      file.path = submissionId + "/" + crypto.randomUUID() + "." + extension;
      await uploadPrivate(file.path, file.mime, file.bytes);
      uploaded.push(file.path);
    }

    const notificationRecipient = await getNotificationRecipient().catch(() => null);
    const outboxId = notificationRecipient ? crypto.randomUUID() : null;
    const receiptOutboxId = crypto.randomUUID();
    const sourceHash = await sha256Hex(serviceKey() + ":contact:" + requestIp(request));
    const metadata = {
      role,
      location,
      phone,
      urgency,
      currency,
      budget,
      exact,
      negotiable,
      deadline,
      channel,
      project_name: projectName,
      industry,
      project_stage: projectStage,
      services: [type, ...additionalTypes],
      additional_services: additionalTypes,
      deliverables,
      audience,
      attachments: preparedFiles.map(({ name, mime, size, width, height }) => ({
        name, mime, size, width, height,
      })),
    };

    const resultValue = await db("/rest/v1/rpc/submit_contact_submission", {
      method: "POST",
      body: JSON.stringify({
        p_submission_id: submissionId,
        p_name: name,
        p_email: email,
        p_company: company || null,
        p_request_type: type,
        p_budget: budget === "Prefer not to say" ? null : (exact ? currency + " " + exact : budget || null),
        p_message: message,
        p_links: links,
        p_attachment_paths: uploaded,
        p_source_ip_hash: sourceHash,
        p_metadata: metadata,
        p_notification_recipient: notificationRecipient,
        p_notification_outbox_id: outboxId,
        p_receipt_outbox_id: receiptOutboxId,
        p_now: new Date().toISOString(),
      }),
    });
    const result = firstRecord(resultValue);
    if (!result || typeof result["submission_id"] !== "string") throw new Error("contact_persistence_not_confirmed");

    let notification = notificationRecipient ? "queued" : "recipient_unconfigured";
    if (outboxId) {
      try {
        notification = (await attemptEmailOutbox(outboxId)).reason;
      } catch {
        notification = "email_delivery_failed";
        await updateOutbox(outboxId, {
          status: "failed",
          last_error: "email_delivery_failed",
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }).catch(() => undefined);
      }
    }

    let receipt = "queued";
    try {
      receipt = (await attemptEmailOutbox(receiptOutboxId)).reason;
    } catch {
      receipt = "email_delivery_failed";
      await updateOutbox(receiptOutboxId, {
        status: "failed",
        last_error: "email_delivery_failed",
        next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }).catch(() => undefined);
    }

    return json({
      ok: true,
      submissionId: result["submission_id"],
      notification,
      receipt,
      attachmentCount: uploaded.length,
    }, 201, origin);
  } catch {
    await Promise.all(uploaded.map(deletePrivate));
    return json({ ok: false, error: "submission_unavailable" }, 503, origin);
  }
}

async function newsletterSubscribe(request: Request, origin?: string): Promise<Response> {
  if (!(await rateLimit(request, "newsletter"))) return json({ ok: false, error: "rate_limited" }, 429, origin);
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.email !== "string" || input.consent !== true) {
    return json({ ok: false, error: "email_and_consent_required" }, 400, origin);
  }
  const email = input.email.trim().toLowerCase();
  if (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "invalid_email" }, 400, origin);
  }
  const configuredOrigin = Deno.env.get("PUBLIC_SITE_URL")?.trim();
  if (configuredOrigin) {
    try {
      const parsed = new URL(configuredOrigin);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash ||
          !ALLOWED_ORIGINS.has(parsed.origin)) {
        return json({ ok: false, error: "public_site_url_not_configured" }, 503, origin);
      }
    } catch {
      return json({ ok: false, error: "public_site_url_not_configured" }, 503, origin);
    }
  }
  // Confirmation links always use the canonical portfolio domain, not the request's Origin.
  const validOrigin = PRODUCTION_ORIGIN;

  const confirmToken = randomHexToken();
  const unsubscribeToken = randomHexToken();
  const encrypted = await encryptTokenBundle({ confirmToken, unsubscribeToken }, serviceKey());
  const outboxId = crypto.randomUUID();
  const now = new Date();
  const output = await db("/rest/v1/rpc/request_newsletter_subscription", {
    method: "POST",
    body: JSON.stringify({
      p_email: email,
      p_consent_text_version: CONSENT_VERSION,
      p_confirm_token_hash: await sha256Hex(confirmToken),
      p_unsubscribe_token_hash: await sha256Hex(unsubscribeToken),
      p_confirm_expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      p_unsubscribe_expires_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      p_outbox_id: outboxId,
      p_outbox_payload: {
        kind: "newsletter_confirmation",
        site_origin: validOrigin,
        token_ciphertext: encrypted.token_ciphertext,
        token_iv: encrypted.token_iv,
      },
      p_now: now.toISOString(),
    }),
  });
  const result = firstRecord(output);
  const status = typeof result?.["status"] === "string" ? result["status"] : "";
  if (status === "already_confirmed") return json({ ok: true, status: "already_confirmed" }, 200, origin);
  if (status === "unsubscribed") return json({ ok: false, error: "already_unsubscribed" }, 409, origin);
  const id = typeof result?.["outbox_id"] === "string" ? result["outbox_id"] : null;
  if (!id) throw new Error("newsletter_persistence_not_confirmed");
  let deliveryStatus = "email_delivery_failed";
  try {
    const delivery = await attemptEmailOutbox(id);
    deliveryStatus = delivery.sent ? "pending_confirmation" : delivery.reason;
  } catch {
    await updateOutbox(id, {
      status: "failed",
      last_error: "email_delivery_failed",
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }).catch(() => undefined);
  }
  // Persisted subscriptions remain pending; only the one-use token can activate them.
  return json({ ok: true, status: deliveryStatus }, 202, origin);
}

async function newsletterToken(request: Request, origin?: string): Promise<Response> {
  if (!(await rateLimit(request, "newsletter_action"))) return json({ ok: false, error: "rate_limited" }, 429, origin);
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || !["confirm","unsubscribe"].includes(String(input.action)) ||
      typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token)) {
    return json({ ok: false, status: "invalid_or_expired" }, 400, origin);
  }
  const result = firstRecord(await db("/rest/v1/rpc/consume_newsletter_token", {
    method: "POST",
    body: JSON.stringify({ p_token_hash: await sha256Hex(input.token), p_now: new Date().toISOString() }),
  }));
  if (result?.["ok"] === true) return json({ ok: true, status: result["status"] }, 200, origin);
  return json({ ok: false, status: result?.["status"] ?? "invalid_or_expired" }, 400, origin);
}

async function retryOutbox(request: Request): Promise<Response> {
  const id = request.headers.get("x-outbox-id") ?? "";
  const timestamp = request.headers.get("x-outbox-timestamp") ?? "";
  const signature = request.headers.get("x-outbox-signature") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 120_000 || !/^[a-f0-9]{64}$/.test(signature)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const expected = await hmacHex(serviceKey(), id + "." + timestamp);
  if (!safeEqual(signature, expected)) return json({ ok: false, error: "unauthorized" }, 401);
  const result = await attemptEmailOutbox(id);
  return json({ ok: result.sent, status: result.reason }, result.sent ? 200 : 503);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? undefined;
  if (request.method === "OPTIONS") {
    const headers = new Headers({
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-outbox-id, x-outbox-timestamp, x-outbox-signature",
      "cache-control": "no-store",
      "vary": "Origin",
    });
    if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("access-control-allow-origin", origin);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403);

  try {
    const action = new URL(request.url).searchParams.get("action");
    if (action === "contact") return await contactSubmit(request, origin);
    if (action === "subscribe") return await newsletterSubscribe(request, origin);
    if (action === "token") return await newsletterToken(request, origin);
    if (action === "retry-email") return await retryOutbox(request);
    return json({ ok: false, error: "unknown_action" }, 404, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "rate_limit_store_unavailable" || message.endsWith("_unavailable") ? 503 : 400;
    return json({ ok: false, error: status === 503 ? "service_unavailable" : "invalid_request" }, status, origin);
  }
});
