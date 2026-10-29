import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { ADMIN_ACCESS_CODE, isAdminAttemptLocked, isAdminPinValid, type AdminAttemptState } from "./admin-auth-core";
const SESSION_COOKIE = "kutuzov-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
type AdminServerConfig = { url: string; serviceRoleKey: string };
type AdminSessionCookie = { sessionId: string; issuedAt: number; expiresAt: number; signature: string };
export type AdminLoginResult = { ok: true; email: string } | { ok: false; error: "invalid_credentials" | "rate_limited" | "unavailable" };
export class AdminAuthorizationError extends Error {
  constructor() { super("Administrator authorization required"); this.name = "AdminAuthorizationError"; }
}
function readConfig(): AdminServerConfig | null {
  const url = process.env["SUPABASE_URL"]?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !serviceRoleKey) return null;
  try { const parsed = new URL(url); if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null; }
  catch { return null; }
  return { url, serviceRoleKey };
}
function cookieOptions() { return { httpOnly: true, secure: process.env["NODE_ENV"] === "production", sameSite: "strict" as const, path: "/", maxAge: SESSION_MAX_AGE_SECONDS }; }
function parseSessionCookie(value: string | undefined): AdminSessionCookie | null {
  if (!value || value.length > 2048) return null;
  try {
    const data = JSON.parse(decodeURIComponent(value)) as Partial<AdminSessionCookie>;
    if (typeof data.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(data.sessionId) ||
      typeof data.issuedAt !== "number" || !Number.isFinite(data.issuedAt) ||
      typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt) ||
      typeof data.signature !== "string" || !/^[0-9a-f]{64}$/i.test(data.signature)) return null;
    return { sessionId: data.sessionId, issuedAt: data.issuedAt, expiresAt: data.expiresAt, signature: data.signature };
  } catch { return null; }
}
function sessionPayload(session: Pick<AdminSessionCookie, "sessionId" | "issuedAt" | "expiresAt">): string { return "v1|" + session.sessionId + "|" + session.issuedAt + "|" + session.expiresAt; }
async function signSession(config: AdminServerConfig, session: AdminSessionCookie): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.serviceRoleKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionPayload(session)));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}
async function isSessionValid(config: AdminServerConfig, session: AdminSessionCookie): Promise<boolean> {
  const now = Date.now();
  if (session.issuedAt > now + 60_000 || session.issuedAt < now - SESSION_MAX_AGE_SECONDS * 1000 ||
    session.expiresAt <= now || session.expiresAt <= session.issuedAt ||
    session.expiresAt - session.issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return false;
  return constantTimeEqual(session.signature, await signSession(config, session));
}
function writeSessionCookie(session: AdminSessionCookie) { setCookie(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), cookieOptions()); }
function clearSessionCookie() { deleteCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env["NODE_ENV"] === "production", sameSite: "strict", path: "/" }); }
async function hashIpKey(config: AdminServerConfig): Promise<string> {
  const address = getRequestHeader("x-vercel-forwarded-for") ?? getRequestHeader("x-real-ip") ?? getRequestHeader("cf-connecting-ip") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("admin-auth|" + config.serviceRoleKey + "|" + address.trim().slice(0, 100)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function serviceHeaders(config: AdminServerConfig, prefer?: string): HeadersInit {
  const headers: Record<string, string> = { apikey: config.serviceRoleKey, Authorization: "Bearer " + config.serviceRoleKey, "Content-Type": "application/json" };
  if (prefer) headers["Prefer"] = prefer;
  return headers;
}
async function registerAttempt(config: AdminServerConfig, ipHash: string): Promise<AdminAttemptState> {
  const response = await fetch(config.url + "/rest/v1/rpc/register_admin_auth_attempt", { method: "POST", headers: serviceHeaders(config), body: JSON.stringify({ p_ip_hash: ipHash, p_now: new Date().toISOString() }), cache: "no-store" });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
  const payload = await response.json() as AdminAttemptState[] | AdminAttemptState;
  const state = Array.isArray(payload) ? payload[0] : payload;
  if (!state || typeof state.attempt_count !== "number" || (state.blocked_until !== null && typeof state.blocked_until !== "string")) throw new Error("invalid_rate_limit_response");
  return state;
}
async function deleteAttempt(config: AdminServerConfig, ipHash: string): Promise<void> {
  const url = new URL("/rest/v1/admin_auth_attempts", config.url); url.searchParams.set("ip_hash", "eq." + ipHash);
  const response = await fetch(url, { method: "DELETE", headers: serviceHeaders(config), cache: "no-store" });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
}
async function recordAuthAudit(config: AdminServerConfig, eventType: string, success: boolean, subject?: string): Promise<void> {
  const response = await fetch(config.url + "/rest/v1/admin_audit_log", {
    method: "POST", headers: serviceHeaders(config, "return=minimal"),
    body: JSON.stringify({ event_type: eventType, success, subject: subject ?? null, metadata: { channel: "admin_login", authentication: "code_only" } }), cache: "no-store",
  });
  if (!response.ok) throw new Error("audit_log_unavailable");
}
export async function loginAdmin(input: { pin: string }): Promise<AdminLoginResult> {
  const config = readConfig();
  if (!config) return { ok: false, error: "unavailable" };
  try {
    const ipHash = await hashIpKey(config), attempt = await registerAttempt(config, ipHash);
    if (isAdminAttemptLocked(attempt.attempt_count, attempt.blocked_until, Date.now())) {
      await recordAuthAudit(config, "admin_login_rate_limited", false, "code-only").catch(() => undefined);
      return { ok: false, error: "rate_limited" };
    }
    if (!isAdminPinValid(input.pin, ADMIN_ACCESS_CODE)) {
      await recordAuthAudit(config, "admin_login_rejected", false, "code-only").catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }
    const now = Date.now();
    const session: AdminSessionCookie = { sessionId: crypto.randomUUID(), issuedAt: now, expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000, signature: "" };
    session.signature = await signSession(config, session);
    await deleteAttempt(config, ipHash);
    await recordAuthAudit(config, "admin_login_succeeded", true, "code-only").catch(() => undefined);
    writeSessionCookie(session);
    return { ok: true, email: "Admin (código)" };
  } catch { clearSessionCookie(); return { ok: false, error: "unavailable" }; }
}
export type AdminActor = { id: string | null; email: string; sessionId: string };
export async function requireAdmin(): Promise<AdminActor> {
  const config = readConfig();
  if (!config) throw new AdminAuthorizationError();
  const session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (!session || !(await isSessionValid(config, session).catch(() => false))) { clearSessionCookie(); throw new AdminAuthorizationError(); }
  return { id: null, email: "Admin (código)", sessionId: session.sessionId };
}
export async function getAdminSession(): Promise<{ id: string; email: string } | null> {
  try { const actor = await requireAdmin(); return { id: actor.sessionId, email: actor.email }; } catch { return null; }
}
export async function logoutAdmin(): Promise<{ ok: true }> {
  const config = readConfig(), session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (config && session && await isSessionValid(config, session).catch(() => false)) await recordAuthAudit(config, "admin_logout", true, "code-only").catch(() => undefined);
  clearSessionCookie(); return { ok: true };
}
/** Server-only context. The service-role key never leaves this module's server runtime. */
export async function getAdminServerContext(): Promise<{ actor: AdminActor; supabase: { url: string; serviceRoleKey: string } }> {
  const actor = await requireAdmin(), config = readConfig();
  if (!config) throw new AdminAuthorizationError();
  return { actor, supabase: { url: config.url, serviceRoleKey: config.serviceRoleKey } };
}
