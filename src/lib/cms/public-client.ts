import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from "./public-config";

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

export async function selectPublicRows(
  table: PublicCmsTable,
  query: Record<string, string>,
): Promise<unknown[]> {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: SUPABASE_API_KEY,
      ...(AUTHORIZATION_KEY ? { Authorization: `Bearer ${AUTHORIZATION_KEY}` } : {}),
      Accept: "application/json",
    },
  });

  if (!response.ok) throw new CmsRequestError(table, response.status);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new CmsRequestError(table, 502);
  return payload;
}
