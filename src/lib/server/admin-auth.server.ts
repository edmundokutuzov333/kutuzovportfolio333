import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server";

import {
  isAdminAttemptLocked,
  isAdminPinValid,
  isAuthorizedAdminIdentity,
  type AdminAuthUser,
  type AdminAttemptState,
} from "./admin-auth-core";

const SESSION_COOKIE = "kutuzov-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SupabaseConfig = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
  adminPin: string;
  adminEmail: string;
  rateLimitSalt: string;
};

type AdminSessionCookie = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export type AdminLoginResult =
  | { ok: true; email: string }
  | { ok: false; error: "invalid_credentials" | "rate_limited" | "unavailable" };

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Administrator authorization required");
    this.name = "AdminAuthorizationError";
  }
}

function readConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const adminPin = process.env.ADMIN_ACCESS_CODE;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const rateLimitSalt = process.env.ADMIN_RATE_LIMIT_SALT;

  if (!url || !publishableKey || !serviceRoleKey || !adminPin || !adminEmail || !rateLimitSalt) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
  } catch {
    return null;
  }

  if (!/^\d{3}$/.test(adminPin) || !adminEmail.includes("@") || rateLimitSalt.length < 32) {
    return null;
  }

  return { url, publishableKey, serviceRoleKey, adminPin, adminEmail, rateLimitSalt };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function parseSessionCookie(value: string | undefined): AdminSessionCookie | null {
  if (!value || value.length > 6000) return null;
  try {
    const data = JSON.parse(decodeURIComponent(value)) as Partial<AdminSessionCookie>;
    if (
      typeof data.access_token !== "string" ||
      typeof data.refresh_token !== "string" ||
      typeof data.expires_at !== "number"
    ) {
      return null;
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };
  } catch {
    return null;
  }
}

function writeSessionCookie(session: AdminSessionCookie) {
  setCookie(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), cookieOptions());
}

function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

async function hashIpKey(config: SupabaseConfig): Promise<string> {
  const address =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-vercel-forwarded-for") ??
    getRequestHeader("x-real-ip") ??
    "unknown";
  const bytes = new TextEncoder().encode(
    `${config.rateLimitSalt}:${address.trim().slice(0, 100)}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceHeaders(config: SupabaseConfig, prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function registerAttempt(config: SupabaseConfig, ipHash: string): Promise<AdminAttemptState> {
  const response = await fetch(`${config.url}/rest/v1/rpc/register_admin_auth_attempt`, {
    method: "POST",
    headers: serviceHeaders(config),
    body: JSON.stringify({ p_ip_hash: ipHash, p_now: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
  const payload = (await response.json()) as AdminAttemptState[] | AdminAttemptState;
  const state = Array.isArray(payload) ? payload[0] : payload;
  if (
    !state ||
    typeof state.attempt_count !== "number" ||
    (state.blocked_until !== null && typeof state.blocked_until !== "string")
  ) {
    throw new Error("invalid_rate_limit_response");
  }
  return state;
}

async function deleteAttempt(config: SupabaseConfig, ipHash: string): Promise<void> {
  const url = new URL("/rest/v1/admin_auth_attempts", config.url);
  url.searchParams.set("ip_hash", `eq.${ipHash}`);
  const response = await fetch(url, { method: "DELETE", headers: serviceHeaders(config) });
  if (!response.ok) throw new Error("rate_limit_store_unavailable");
}

async function recordAuthAudit(
  config: SupabaseConfig,
  eventType: string,
  success: boolean,
  subject?: string,
): Promise<void> {
  const response = await fetch(`${config.url}/rest/v1/admin_audit_log`, {
    method: "POST",
    headers: serviceHeaders(config, "return=minimal"),
    body: JSON.stringify({
      event_type: eventType,
      success,
      subject: subject ?? null,
      metadata: { channel: "admin_login" },
    }),
  });
  if (!response.ok) throw new Error("audit_log_unavailable");
}

async function supabasePasswordSignIn(
  config: SupabaseConfig,
  email: string,
  password: string,
): Promise<AdminSessionCookie | null> {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as SupabaseAuthResponse;
  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires_in !== "number"
  ) {
    return null;
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

async function refreshSession(
  config: SupabaseConfig,
  current: AdminSessionCookie,
): Promise<AdminSessionCookie | null> {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as SupabaseAuthResponse;
  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires_in !== "number"
  ) {
    return null;
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

async function getAuthUser(
  config: SupabaseConfig,
  accessToken: string,
): Promise<AdminAuthUser | null> {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as AdminAuthUser;
}

export async function loginAdmin(input: {
  pin: string;
  email: string;
  password: string;
}): Promise<AdminLoginResult> {
  const config = readConfig();
  if (!config) return { ok: false, error: "unavailable" };

  try {
    const ipHash = await hashIpKey(config);
    const attempt = await registerAttempt(config, ipHash);
    if (
      isAdminAttemptLocked(
        attempt.attempt_count,
        attempt.blocked_until,
        Date.now(),
      )
    ) {
      await recordAuthAudit(config, "admin_login_rate_limited", false).catch(() => undefined);
      return { ok: false, error: "rate_limited" };
    }

    if (!isAdminPinValid(input.pin, config.adminPin)) {
      await recordAuthAudit(config, "admin_login_rejected", false, config.adminEmail).catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail || !input.password) {
      await recordAuthAudit(config, "admin_login_rejected", false, config.adminEmail).catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }

    const session = await supabasePasswordSignIn(config, normalizedEmail, input.password);
    if (!session) {
      await recordAuthAudit(config, "admin_login_rejected", false, config.adminEmail).catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }

    const user = await getAuthUser(config, session.access_token);
    if (!isAuthorizedAdminIdentity(user, config.adminEmail)) {
      clearSessionCookie();
      await recordAuthAudit(config, "admin_login_rejected", false, config.adminEmail).catch(() => undefined);
      return { ok: false, error: "invalid_credentials" };
    }

    await deleteAttempt(config, ipHash);
    await recordAuthAudit(config, "admin_login_succeeded", true, config.adminEmail).catch(() => undefined);
    writeSessionCookie(session);
    return { ok: true, email: normalizedEmail };
  } catch {
    // Provider responses and secrets are deliberately not logged or returned.
    clearSessionCookie();
    return { ok: false, error: "unavailable" };
  }
}

export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const config = readConfig();
  if (!config) throw new AdminAuthorizationError();

  let session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (!session) throw new AdminAuthorizationError();

  if (session.expires_at < Date.now() + 60_000) {
    const refreshed = await refreshSession(config, session).catch(() => null);
    if (!refreshed) {
      clearSessionCookie();
      throw new AdminAuthorizationError();
    }
    session = refreshed;
    writeSessionCookie(session);
  }

  const user = await getAuthUser(config, session.access_token).catch(() => null);
  if (
    !user ||
    typeof user.id !== "string" ||
    !isAuthorizedAdminIdentity(user, config.adminEmail)
  ) {
    clearSessionCookie();
    throw new AdminAuthorizationError();
  }

  return { id: user.id, email: user.email as string };
}

export async function getAdminSession(): Promise<{ id: string; email: string } | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function logoutAdmin(): Promise<{ ok: true }> {
  const config = readConfig();
  const session = parseSessionCookie(getCookie(SESSION_COOKIE));
  if (config && session) {
    const user = await getAuthUser(config, session.access_token).catch(() => null);
    if (isAuthorizedAdminIdentity(user, config.adminEmail)) {
      await fetch(`${config.url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => undefined);
      await recordAuthAudit(config, "admin_logout", true, config.adminEmail).catch(() => undefined);
    }
  }
  clearSessionCookie();
  return { ok: true };
}
