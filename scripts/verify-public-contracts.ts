import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
  PUBLIC_PRODUCTION_ORIGIN,
} from "../src/lib/cms/public-config";

const headers = {
  apikey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  accept: "application/json",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pass(message: string): void {
  console.log(`[PASS] ${message}`);
}

async function getPublicRows(table: string, query: Record<string, string>): Promise<unknown[]> {
  const url = new URL(`/rest/v1/${table}`, DEFAULT_SUPABASE_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  assert(response.ok, `Public read contract failed for ${table}: HTTP ${response.status}`);
  const payload: unknown = await response.json();
  assert(Array.isArray(payload), `Public read contract for ${table} returned a non-array payload`);
  return payload;
}

async function expectPrivateReadDenied(table: string): Promise<void> {
  const url = new URL(`/rest/v1/${table}`, DEFAULT_SUPABASE_URL);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  assert(
    response.status === 401 || response.status === 403,
    `Anonymous access to private table ${table} should be denied, received HTTP ${response.status}`,
  );
  pass(`anonymous cannot read ${table}`);
}

async function expectRpcMutationDenied(name: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, DEFAULT_SUPABASE_URL), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  assert(
    response.status === 401 || response.status === 403,
    `Anonymous RPC ${name} should be denied at the permission boundary, received HTTP ${response.status}`,
  );
  pass(`anonymous cannot invoke ${name}`);
}

async function verifyCorsAndMethodContract(): Promise<void> {
  const endpoint = new URL("/functions/v1/public-forms?action=contact", DEFAULT_SUPABASE_URL);
  const accepted = await fetch(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: PUBLIC_PRODUCTION_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,apikey,content-type",
    },
    signal: AbortSignal.timeout(15_000),
  });
  assert(accepted.status === 204, `Expected public-forms preflight to return 204, received HTTP ${accepted.status}`);
  assert(
    accepted.headers.get("access-control-allow-origin") === PUBLIC_PRODUCTION_ORIGIN,
    "Public forms CORS did not allow the configured production origin",
  );
  pass("public-forms CORS preflight accepts the configured production origin");

  const rejectedOrigin = await fetch(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://invalid-phase5-origin.example",
      "Access-Control-Request-Method": "POST",
    },
    signal: AbortSignal.timeout(15_000),
  });
  assert(
    !rejectedOrigin.headers.get("access-control-allow-origin"),
    "Public forms CORS exposed an allow-origin header for an untrusted origin",
  );
  pass("public-forms CORS does not grant an untrusted origin");

  const wrongMethod = await fetch(endpoint, {
    method: "GET",
    headers: { Origin: PUBLIC_PRODUCTION_ORIGIN },
    signal: AbortSignal.timeout(15_000),
  });
  assert(wrongMethod.status === 405, `Expected public-forms GET to return 405, received HTTP ${wrongMethod.status}`);
  pass("public-forms rejects methods other than POST and OPTIONS");
}

async function verifyPrivateBucketDenied(): Promise<void> {
  const endpoint = new URL("/storage/v1/object/list/contact-private-attachments", DEFAULT_SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1, offset: 0, sortBy: { column: "name", order: "asc" } }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  assert(response.status >= 400 && response.status < 500, `Anonymous private-bucket listing was not denied with a client error (HTTP ${response.status})`);
  pass("anonymous cannot list private contact attachments");
}

async function main(): Promise<void> {
  console.log("Read-only production contract check. No records are created or modified.");
  console.log(`Supabase project: ${new URL(DEFAULT_SUPABASE_URL).hostname}`);

  const projects = await getPublicRows("projects", { select: "id,slug,status", order: "position.asc", limit: "100" });
  assert(projects.length >= 1, "No published project is visible to anonymous visitors");
  assert(projects.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["status"] === "published"),
    "A non-published project was returned to an anonymous visitor");
  pass(`published projects read correctly (${projects.length} visible)`);

  const drafts = await getPublicRows("projects", { select: "id,slug,status", status: "eq.draft", limit: "100" });
  assert(drafts.length === 0, `Anonymous visitors can see ${drafts.length} draft project(s)`);
  pass("draft projects are not visible anonymously");

  const pages = await getPublicRows("pages", { select: "slug,status", status: "eq.published", limit: "100" });
  assert(pages.length >= 1, "No published CMS page is visible to anonymous visitors");
  assert(pages.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["status"] === "published"),
    "An unpublished page was returned to an anonymous visitor");
  pass(`published pages read correctly (${pages.length} visible)`);

  const visibleSections = await getPublicRows("page_sections", { select: "id,section_type,is_visible", is_visible: "eq.true", limit: "100" });
  assert(visibleSections.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["is_visible"] === true),
    "An invisible page section was returned to an anonymous visitor");
  pass(`visible page-section policy behaves correctly (${visibleSections.length} visible)`);

  const clients = await getPublicRows("clients", { select: "id,slug,is_visible", is_visible: "eq.true", limit: "100" });
  assert(clients.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["is_visible"] === true),
    "A hidden client was returned to an anonymous visitor");
  pass(`visible clients read correctly (${clients.length} visible)`);

  const settings = await getPublicRows("site_settings", { select: "setting_key,is_public", limit: "100" });
  assert(settings.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["is_public"] === true),
    "A non-public site setting was returned anonymously");
  pass(`site settings expose only public rows (${settings.length} visible)`);

  const profile = await getPublicRows("profile_content", { select: "id,is_published", limit: "100" });
  assert(profile.every((value) => !!value && typeof value === "object" && (value as Record<string, unknown>)["is_published"] === true),
    "Unpublished profile content was returned anonymously");
  pass(`profile content exposes only published rows (${profile.length} visible)`);

  const media = await getPublicRows("media_assets", { select: "bucket_id,is_public", limit: "100" });
  assert(media.every((value) => !!value && typeof value === "object"
    && (value as Record<string, unknown>)["is_public"] === true
    && (value as Record<string, unknown>)["bucket_id"] === "portfolio-public-assets"),
  "Private or unapproved media was returned anonymously");
  pass(`media policy exposes only approved public assets (${media.length} visible)`);

  for (const table of [
    "contact_submissions", "newsletter_subscribers", "newsletter_tokens",
    "email_outbox", "content_revisions", "admin_audit_log", "public_form_rate_limits",
  ]) {
    await expectPrivateReadDenied(table);
  }

  const adminActor = "00000000-0000-4000-8000-000000000000";
  await expectRpcMutationDenied("admin_mutate_content", {
    p_entity_type: "projects",
    p_action: "create",
    p_entity_id: null,
    p_payload: {},
    p_expected_updated_at: null,
    p_actor_id: adminActor,
    p_note: "anonymous permission contract; no write expected",
  });
  await expectRpcMutationDenied("admin_reorder_content", {
    p_entity_type: "projects",
    p_ids: [],
    p_page_id: null,
    p_actor_id: adminActor,
  });
  await expectRpcMutationDenied("admin_update_contact_submission", {
    p_submission_id: adminActor,
    p_status: "archived",
    p_internal_notes: "",
    p_expected_updated_at: new Date().toISOString(),
    p_actor_id: adminActor,
  });

  await verifyPrivateBucketDenied();
  await verifyCorsAndMethodContract();
  console.log("PASS: all read-only public contract and anonymous-access checks passed.");
}

main().catch((error: unknown) => {
  console.error("FAIL: production contract check did not pass.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
