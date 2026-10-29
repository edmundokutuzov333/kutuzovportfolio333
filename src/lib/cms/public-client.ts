const DEFAULT_SUPABASE_URL = "https://qwjaoheaolpxtciljzvb.supabase.co";
// This is a browser-safe Supabase publishable key, not a service-role secret. RLS remains the access boundary.
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_D2urR5PRQGDpHqVBLtb_CA_n75HUgmE"; // gitleaks:allow

const env = import.meta.env;

export const SUPABASE_URL =
  env["VITE_SUPABASE_URL"]?.trim().replace(/\/+$/, "") || DEFAULT_SUPABASE_URL;
const publishableKey = env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
const anonKey = env["VITE_SUPABASE_ANON_KEY"]?.trim();

export const SUPABASE_API_KEY = publishableKey || anonKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
const AUTHORIZATION_KEY = anonKey || null;
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
