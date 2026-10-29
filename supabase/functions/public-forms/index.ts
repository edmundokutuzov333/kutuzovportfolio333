const PRODUCTION_ORIGIN = "https://kutuzovportfolio333.lovable.app";
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://id-preview--866320a4-978d-403b-b184-3e3fd57d0c19.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const CONSENT_VERSION = "newsletter-consent-v1-2026-10-29";
const BUCKET_PRIVATE = "contact-private-attachments";

type ContactUpload = { path: string; mime: string; size: number; width: number; height: number; name: string; bytes: Uint8Array };

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

function detectImage(bytes: Uint8Array): { mime: string; ext: string; width: number; height: number } | null {
  const u8 = (n: number) => bytes[n] ?? 0;
  const u16be = (n: number) => (u8(n) << 8) | u8(n + 1);
  const u16le = (n: number) => u8(n) | (u8(n + 1) << 8);
  const u24le = (n: number) => u8(n) | (u8(n + 1) << 8) | (u8(n + 2) << 16);
  const u32be = (n: number) => (u8(n) * 0x1000000) + (u8(n + 1) << 16) + (u8(n + 2) << 8) + u8(n + 3);

  if (bytes.length >= 24 && u8(0) === 0x89 && u8(1) === 0x50 && u8(2) === 0x4e &&
      u8(3) === 0x47 && u8(4) === 0x0d && u8(5) === 0x0a && u8(6) === 0x1a && u8(7) === 0x0a) {
    return { mime: "image/png", ext: "png", width: u32be(16), height: u32be(20) };
  }
  if (bytes.length >= 4 && u8(0) === 0xff && u8(1) === 0xd8 && u8(2) === 0xff) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      while (offset < bytes.length && u8(offset) !== 0xff) offset += 1;
      while (offset < bytes.length && u8(offset) === 0xff) offset += 1;
      const marker = u8(offset++);
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = u16be(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 7) break;
        return { mime: "image/jpeg", ext: "jpg", width: u16be(offset + 5), height: u16be(offset + 3) };
      }
      offset += length;
    }
    return null;
  }
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return { mime: "image/webp", ext: "webp", width: 1 + u24le(24), height: 1 + u24le(27) };
    if (chunk === "VP8 " && u8(23) === 0x9d && u8(24) === 0x01 && u8(25) === 0x2a) {
      return { mime: "image/webp", ext: "webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    }
    if (chunk === "VP8L" && u8(20) === 0x2f && bytes.length >= 25) {
      return {
        mime: "image/webp", ext: "webp",
        width: 1 + u8(21) + ((u8(22) & 0x3f) << 8),
        height: 1 + ((u8(22) & 0xc0) >> 6) + (u8(23) << 2) + ((u8(24) & 0x0f) << 10),
      };
    }
  }
  return null;
}

function validDimensions(image: { width: number; height: number } | null): image is { width: number; height: number; mime: string; ext: string } {
  return !!image && Number.isInteger(image.width) && Number.isInteger(image.height) &&
    image.width > 0 && image.height > 0 && image.width <= 14000 && image.height <= 14000 &&
    image.width * image.height <= MAX_PIXELS;
}

function cleanOriginalName(name: string): string {
  const withoutPath = name.replace(/[/\\]/g, "_");
  const safe = Array.from(withoutPath).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
  return safe.slice(0, 180) || "image";
}

function encodePath(path: string): string {
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
  const configured = Deno.env.get("ADMIN_EMAIL")?.trim();
  if (configured && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(configured)) return configured.toLowerCase();
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

async function attemptEmailOutbox(id: string): Promise<{ sent: boolean; reason: string }> {
  const claimedValue = await db("/rest/v1/rpc/claim_email_outbox", {
    method: "POST", body: JSON.stringify({ p_outbox_id: id, p_now: new Date().toISOString() }),
  });
  const row = firstRecord(claimedValue);
  if (!row || typeof row["id"] !== "string") return { sent: false, reason: "not_claimable" };

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const mailFrom = Deno.env.get("MAIL_FROM")?.trim();
  if (!resendKey || !mailFrom) {
    await updateOutbox(id, { status: "failed", last_error: "email_provider_not_configured",
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    return { sent: false, reason: "email_provider_not_configured" };
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + resendKey, "content-type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: [String(row["recipient"])], subject, text, html }),
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      await updateOutbox(id, { status: "failed", last_error: "email_provider_http_" + response.status,
        next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
      return { sent: false, reason: "email_delivery_failed" };
    }

    const minimalPayload: Record<string, unknown> = { delivered: true, message_type: row["message_type"] };
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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400, origin);
  const company = formText(form, "company", 180);
  const role = formText(form, "role", 180);
  const location = formText(form, "location", 240);
  const phone = formText(form, "phone", 80);
  const type = formText(form, "type", 180, true);
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
  if (!["low","normal","high","urgent"].includes(urgency)) return json({ ok: false, error: "invalid_urgency" }, 400, origin);
  if (!["email","phone","whatsapp","linkedin"].includes(channel)) return json({ ok: false, error: "invalid_channel" }, 400, origin);
  if (!["EUR","USD","GBP","BRL","MZN"].includes(currency)) return json({ ok: false, error: "invalid_currency" }, 400, origin);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return json({ ok: false, error: "invalid_deadline" }, 400, origin);

  const projectTypes = await getPublishedProjectTypes();
  if (!projectTypes.includes(type)) return json({ ok: false, error: "invalid_project_type" }, 400, origin);
  const links: string[] = [];
  for (const value of rawLinks.split(/\s+/).filter(Boolean)) {
    let parsed: URL;
    try { parsed = new URL(value); } catch { return json({ ok: false, error: "invalid_links" }, 400, origin); }
    if (!["http:","https:"].includes(parsed.protocol) || !parsed.hostname) return json({ ok: false, error: "invalid_links" }, 400, origin);
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
    const image = detectImage(bytes);
    if (!validDimensions(image)) return json({ ok: false, error: "invalid_image_content_or_dimensions" }, 400, origin);
    if (!["image/png","image/jpeg","image/webp"].includes(image.mime) || (file.type && file.type !== image.mime)) {
      return json({ ok: false, error: "unsupported_image_type" }, 400, origin);
    }
    preparedFiles.push({
      path: "", mime: image.mime, size: bytes.byteLength, width: image.width, height: image.height,
      name: cleanOriginalName(file.name), bytes,
    });
  }

  const submissionId = crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    for (const file of preparedFiles) {
      file.path = submissionId + "/" + crypto.randomUUID() + "." + file.mime.split("/")[1].replace("jpeg", "jpg");
      await uploadPrivate(file.path, file.mime, file.bytes);
      uploaded.push(file.path);
    }

    const notificationRecipient = await getNotificationRecipient().catch(() => null);
    const outboxId = notificationRecipient ? crypto.randomUUID() : null;
    const sourceHash = await sha256Hex(serviceKey() + ":contact:" + requestIp(request));
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
        p_metadata: { role, location, phone, urgency, currency, budget, exact, negotiable, deadline, channel },
        p_notification_recipient: notificationRecipient,
        p_notification_outbox_id: outboxId,
        p_now: new Date().toISOString(),
      }),
    });
    const result = firstRecord(resultValue);
    if (!result || typeof result["submission_id"] !== "string") throw new Error("contact_persistence_not_confirmed");

    let notification = notificationRecipient ? "queued" : "recipient_unconfigured";
    if (outboxId) notification = (await attemptEmailOutbox(outboxId)).reason;
    return json({ ok: true, submissionId: result["submission_id"], notification, attachmentCount: uploaded.length }, 201, origin);
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
  const configuredOrigin = Deno.env.get("PUBLIC_SITE_URL")?.trim() || origin || "";
  let validOrigin = "";
  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol === "https:" && parsed.pathname === "/" && !parsed.search && !parsed.hash &&
        ALLOWED_ORIGINS.has(parsed.origin) && parsed.origin === PRODUCTION_ORIGIN) validOrigin = parsed.origin;
  } catch {
    // Never build confirmation URLs from an unvalidated or preview origin.
  }
  if (!validOrigin) return json({ ok: false, error: "public_site_url_not_configured" }, 503, origin);

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
  const delivery = await attemptEmailOutbox(id);
  return json({ ok: true, status: delivery.sent ? "pending_confirmation" : delivery.reason }, 202, origin);
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
