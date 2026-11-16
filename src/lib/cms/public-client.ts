import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from "./public-config";
import { selectOfflinePublicRows } from "./snapshot-fallback";

const env = import.meta.env;

const envUrl = env["VITE_SUPABASE_URL"]?.trim().replace(/\/+$/, "");
const publishableKey = env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
const anonKey = env["VITE_SUPABASE_ANON_KEY"]?.trim();
const envKey = publishableKey || anonKey;
// URL and key must come from the same project; a mixed pair returns HTTP 401.
const useEnv = Boolean(envUrl && envKey);

export const SUPABASE_URL = useEnv ? envUrl! : DEFAULT_SUPABASE_URL;
export const SUPABASE_API_KEY = useEnv ? envKey! : DEFAULT_SUPABASE_PUBLISHABLE_KEY;
// Only legacy JWT anon keys may be sent as a bearer; opaque sb_ keys cause 401.
const AUTHORIZATION_KEY = useEnv && anonKey?.startsWith("eyJ") && !publishableKey ? anonKey : null;
export function validatePublicOrigin(value: string | undefined): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
    return url.origin;
  } catch {
    return "";
  }
}

// No preview-domain fallback: canonical URLs are emitted only when the deployment
// explicitly supplies a valid HTTPS origin.
export const PUBLIC_SITE_URL = validatePublicOrigin(env["VITE_PUBLIC_SITE_URL"]);

export type PublicCmsTable =
  | "site_settings"
  | "pages"
  | "page_sections"
  | "profile_content"
  | "metrics"
  | "experience_items"
  | "skills"
  | "disciplines"
  | "principles"
  | "services"
  | "process_steps"
  | "clients"
  | "projects"
  | "slug_redirects"
  | "site_publication_state";

export class CmsRequestError extends Error {
  constructor(readonly table: PublicCmsTable, readonly status: number) {
    super(`Published content could not be loaded (HTTP ${status}, ${table}).`);
    this.name = "CmsRequestError";
  }
}

// A restricted/free-tier Supabase Data API must not take the public portfolio
// offline. This is an ephemeral circuit breaker, not a long-lived content cache.
let temporarilyUnavailableUntil = 0;
let lastFallbackNoticeAt = 0;
const PUBLIC_API_RETRY_DELAY_MS = 45_000;

function isTemporaryBackendFailure(status: number): boolean {
  return status === 402 || status === 408 || status === 429 || status >= 500;
}

async function usePublishedFallback(
  table: PublicCmsTable,
  query: Record<string, string>,
  reason: string,
  activateCircuit = true,
): Promise<unknown[]> {
  const now = Date.now();
  if (activateCircuit) temporarilyUnavailableUntil = now + PUBLIC_API_RETRY_DELAY_MS;
  if (now - lastFallbackNoticeAt > 120_000) {
    console.warn("[cms] live Supabase public API temporarily unavailable; serving last published snapshot.", reason);
    lastFallbackNoticeAt = now;
  }
  return selectOfflinePublicRows(table, query);
}

export async function selectPublicRows(
  table: PublicCmsTable,
  query: Record<string, string>,
): Promise<unknown[]> {
  if (Date.now() < temporarilyUnavailableUntil) {
    return usePublishedFallback(table, query, "circuit-breaker", false);
  }

  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
      headers: {
        apikey: SUPABASE_API_KEY,
        ...(AUTHORIZATION_KEY ? { Authorization: `Bearer ${AUTHORIZATION_KEY}` } : {}),
        Accept: "application/json",
      },
    });
  } catch {
    return usePublishedFallback(table, query, "network/timeout");
  }

  if (!response.ok) {
    if (isTemporaryBackendFailure(response.status)) {
      return usePublishedFallback(table, query, `HTTP ${response.status}`);
    }
    // Never obscure real authorization, schema or configuration errors.
    throw new CmsRequestError(table, response.status);
  }

  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return usePublishedFallback(table, query, "invalid array response");
    return payload;
  } catch {
    return usePublishedFallback(table, query, "invalid JSON response");
  }
}
