import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import {
  ADMIN_ACCESS_CODE,
  ADMIN_MAX_ATTEMPTS,
  isAdminAttemptLocked,
  isAdminPinValid,
  type AdminAttemptState,
} from "./admin-auth-core";

const SESSION_COOKIE = "kutuzov-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const LOCAL_WINDOW_MS = 15 * 60 * 1000;
const LOCAL_LOCK_MS = 15 * 60 * 1000;

type AdminDatabaseConfig = { url: string; serviceRoleKey: string };
type AdminSessionCookie = { sessionId: string; issuedAt: number; expiresAt: number; signature: string };
type LocalAttempt = { attempt_count: number; window_started_at: number; blocked_until: string | null };

export type AdminLoginResult =
  | { ok: true; email: string }
  | { ok: false; error: "invalid_credentials" | "rate_limited" | "unavailable" };

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Administrator authorization required");
    this.name = "AdminAuthorizationError";
  }
}

export class AdminBackendUnavailableError extends Error {
  constructor() {
    super("O PIN foi aceite, mas o CMS não tem acesso aos dados. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no alojamento, mantendo a chave exclusivamente no servidor.");
    this.name = "AdminBackendUnavailableError";
  }
}

// The access gate is intentionally independent of database credentials.
function readDatabaseConfig(): AdminDatabaseConfig | null {
  const url = (
    process.env["SUPABASE_URL"] ??
    process.env["VITE_SUPABASE_URL"] ??
    ""
  ).trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !serviceRoleKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
  } catch {
    return null;
  }

  return { url, serviceRoleKey };
}

function sessionSigningKey(): string {
  // Use stronger existing server-side material when present, but never block PIN sign-in on it.
  return (
    process.env["ADMIN_SESSION_SECRET"]?.trim() ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ||
    "kutuzov-admin-session-v1:" + ADMIN_ACCESS_CODE
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function parseSessionCookie(value: string | undefined): AdminSessionCookie | null {
  if (!value || value.length > 2048) return null;
  try {
    const data = JSON.parse(decodeURIComponent(value)) as Partial<AdminSessionCookie>;
    if (
      typeof data.sessionId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(data.sessionId) ||
      typeof data.issuedAt !== "number" ||
      !Number.isFinite(data.issuedAt) ||
      typeof data.expiresAt !== "number" ||
      !Number.isFinite(data.expiresAt) ||
      typeof data.signature !== "string" ||
      !/^[0-9a-f]{64}$/i.test(data.signature)
    ) return null;
    return {
      sessionId: data.sessionId,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
      signature: data.signature,
    };
  } catch {
    return null;
  }
}

function sessionPayload(session: Pick<AdminSessionCookie, "sessionId" | "issuedAt" | "expiresAt">): string {
  return "v1|" + session.sessionId + "|" + session.issuedAt + "|" + session.expiresAt;
}

async function signSession(session: AdminSessionCookie): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sessionPayload(session)),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function isSessionValid(session: AdminSessionCookie): Promise<boolean> {
  const now = Date.now();
  if (
    session.issuedAt > now + 60_000 ||
    session.issuedAt < now - SESSION_MAX_AGE_SECONDS * 1000 ||
    session.expiresAt <= now ||
    session.expiresAt <= session.issuedAt ||
    session.expiresAt - session.issuedAt > SESSION_MAX_AGE_SECONDS * 1000
  ) return false;
  return constantTimeEqual(session.signature, await signSession(session));
}

function writeSessionCookie(session: AdminSessionCookie) {
  setCookie(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), cookieOptions());
}

function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    path: "/",
  });
}

function requestAddress(): string {
  const address =
    getRequestHeader("x-vercel-forwarded-for") ??
    getRequestHeader("x-real-ip") ??
    getRequestHeader("cf-connecting-ip") ??
    "unknown";
  return address.split(",")[0]?.trim().slice(0, 100) || "unknown";
}

async function hashClientAddress(): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("admin-local-rate-limit|" + requestAddress()),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const localAttempts = new Map<string, LocalAttempt>();

function trimLocalAttempts(now: number): void {
  if (localAttempts.size < 3000) return;
  for (const [key, state] of localAttempts.entries()) {
    const expired = now - state.window_started_at >= LOCAL_WINDOW_MS &&
      (!state.blocked_until || Date.parse(state.blocked_until) <= now);
    if (expired) localAttempts.delete(key);
    if (localAttempts.size < 2500) break;
  }
  while (localAttempts.size > 5000) {
    const oldest = localAttempts.keys().next().value;
    if (oldest === undefined) break;
    localAttempts.delete(oldest);
  }
}

function registerLocalAttempt(key: string, now = Date.now()): AdminAttemptState {
  let current = localAttempts.get(key);
  if (current?.blocked_until && Date.parse(current.blocked_until) > now) {
    return { attempt_count: current.attempt_count, blocked_until: current.blocked_until };
  }
  if (!current || now < current.window_started_at || now - current.window_started_at >= LOCAL_WINDOW_MS) {
    current = { attempt_count: 0, window_started_at: now, blocked_until: null };
  }

  current.attempt_count += 1;
  if (current.attempt_count >= ADMIN_MAX_ATTEMPTS) {
    current.blocked_until = new Date(now + LOCAL_LOCK_MS).toISOString();
  }
  localAttempts.set(key, current);
  trimLocalAttempts(now);
  return { attempt_count: current.attempt_count, blocked_until: current.blocked_until };
}

function clearLocalAttempt(key: string): void {
  localAttempts.delete(key);
}

function serviceHeaders(config: AdminDatabaseConfig, prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: config.serviceRoleKey,
    Authorization: "Bearer " + config.serviceRoleKey,
    "Content-Type": "application/json",
  };
  if (prefer) headers["Prefer"] = prefer;
  return headers;
}

async function hashDatabaseIpKey(config: AdminDatabaseConfig): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("admin-auth|" + config.serviceRoleKey + "|" + requestAddress()),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function registerAttempt(config: AdminDatabaseConfig, ipHash: string): Promise<AdminAttemptState> {
  const response = await fetch(config.url + "/rest/v1/rpc/register_admin_auth_attempt", {
    method: "POST",
    headers: serviceHeaders(config),
    body: JSON.stringify({ p_ip_hash: ipHash, p_now: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
  const payload = await response.json() as AdminAttemptState[] | AdminAttemptState;
  const state = Array.isArray(payload) ? payload[0] : payload;
  if (!state || typeof state.attempt_count !== "number" ||
      (state.blocked_until !== null && typeof state.blocked_until !== "string")) {
    throw new Error("invalid_rate_limit_response");
  }
  return state;
}

async function deleteAttempt(config: AdminDatabaseConfig, ipHash: string): Promise<void> {
  const url = new URL("/rest/v1/admin_auth_attempts", config.url);
  url.searchParams.set("ip_hash", "eq." + ipHash);
  const response = await fetch(url, {
    method: "DELETE",
    headers: serviceHeaders(config),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
}

async function recordAuthAudit(
  config: AdminDatabaseConfig,
  eventType: string,
  success: boolean,
  subject?: string,
): Promise<void> {
  const response = await fetch(config.url + "/rest/v1/admin_audit_log", {
    method: "POST",
    headers: serviceHeaders(config, "return=minimal"),
    body: JSON.stringify({
      event_type: eventType,
      success,
      subject: subject ?? null,
      metadata: { channel: "admin_login", authentication: "code_only" },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("audit_log_unavailable");
}

export async function loginAdmin(input: { pin: string }): Promise<AdminLoginResult> {
  const databaseConfig = readDatabaseConfig();
  let clientKey = "unknown";
  let databaseIpHash: string | null = null;
  let stage = "client_fingerprint";

  try {
    clientKey = await hashClientAddress();
    stage = "local_attempt_check";
    const localAttempt = registerLocalAttempt(clientKey);
    if (isAdminAttemptLocked(localAttempt.attempt_count, localAttempt.blocked_until, Date.now())) {
      if (databaseConfig) await recordAuthAudit(databaseConfig, "admin_login_rate_limited", false, "code-only").catch(() => undefined);
      return { ok: false, error: "rate_limited" };
    }

    // Persistent throttling is used when Supabase is reachable, but its availability is not a login requirement.
    if (databaseConfig) {
      try {
        stage = "persistent_rate_limit";
        databaseIpHash = await hashDatabaseIpKey(databaseConfig);
        const persistentAttempt = await registerAttempt(databaseConfig, databaseIpHash);
        if (isAdminAttemptLocked(persistentAttempt.attempt_count, persistentAttempt.blocked_until, Date.now())) {
          await recordAuthAudit(databaseConfig, "admin_login_rate_limited", false, "code-only").catch(() => undefined);
          return { ok: false, error: "rate_limited" };
        }
      } catch {
        // Fall back to the in-process limiter if the persistent limiter is unavailable.
      }
    }

    stage = "pin_validation";
    if (!isAdminPinValid(input.pin, ADMIN_ACCESS_CODE)) {
      if (databaseConfig) await recordAuthAudit(databaseConfig, "admin_login_rejected", false, "code-only").catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }

    const now = Date.now();
    const session: AdminSessionCookie = {
      sessionId: crypto.randomUUID(),
      issuedAt: now,
      expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
      signature: "",
    };
    stage = "session_signing";
    session.signature = await signSession(session);

    clearLocalAttempt(clientKey);
    if (databaseConfig && databaseIpHash) {
      await deleteAttempt(databaseConfig, databaseIpHash).catch(() => undefined);
      await recordAuthAudit(databaseConfig, "admin_login_succeeded", true, "code-only").catch(() => undefined);
    }
    stage = "session_cookie_write";
    writeSessionCookie(session);
    return { ok: true, email: "Admin (código)" };
  } catch (error) {
    console.error("[admin-auth] login unavailable at", stage, error instanceof Error ? error.name : "UnknownError");
    clearSessionCookie();
    return { ok: false, error: "unavailable" };
  }
}

export type AdminActor = { id: string | null; email: string; sessionId: string };

export async function requireAdmin(): Promise<AdminActor> {
  const session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (!session || !(await isSessionValid(session).catch(() => false))) {
    clearSessionCookie();
    throw new AdminAuthorizationError();
  }
  return { id: null, email: "Admin (código)", sessionId: session.sessionId };
}

export async function getAdminSession(): Promise<{ id: string; email: string } | null> {
  try {
    const actor = await requireAdmin();
    return { id: actor.sessionId, email: actor.email };
  } catch {
    return null;
  }
}

export async function logoutAdmin(): Promise<{ ok: true }> {
  const databaseConfig = readDatabaseConfig();
  const session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (databaseConfig && session && await isSessionValid(session).catch(() => false)) {
    await recordAuthAudit(databaseConfig, "admin_logout", true, "code-only").catch(() => undefined);
  }
  clearSessionCookie();
  return { ok: true };
}

/** Server-only context. The service-role key never leaves this module's server runtime. */
export async function getAdminServerContext(): Promise<{
  actor: AdminActor;
  supabase: { url: string; serviceRoleKey: string };
}> {
  const actor = await requireAdmin();
  const config = readDatabaseConfig();
  if (!config) throw new AdminBackendUnavailableError();
  return {
    actor,
    supabase: { url: config.url, serviceRoleKey: config.serviceRoleKey },
  };
}
