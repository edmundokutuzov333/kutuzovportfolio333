import snapshot from "@/data/public-cms-snapshot.json";
import type { Fact } from "@/lib/jarvis/facts";

/**
 * Read-only emergency knowledge, sourced exclusively from the repository's
 * last published public CMS export. This is NOT a replacement for the reviewed
 * database KB and must never include unpublished rows or unapproved Facebook.
 */
export function publishedJarvisFacts(): Fact[] {
  const tables = snapshot.tables;
  const profile = tables.profile_content.find(row =>
    row.is_published && row.public_email === "contact@edmundokutuzov.art",
  );
  if (!profile) return [];

  const facts: Fact[] = [];
  const add = (key: string, value: unknown, priority: number, spoken: string | null = null) => {
    if (typeof value !== "string" || !value.trim() || value.length > 700) return;
    facts.push({
      key, locale: "all", value: value.trim(), spoken,
      status: "verified", visibility: "public", priority,
      source: "published_cms_snapshot:" + snapshot.snapshot_generated_at,
    });
  };

  add("contact.email", profile.public_email, 1, "contact arroba edmundokutuzov ponto art");
  add("identity.name", profile.name, 10);
  add("identity.roles", profile.roles.join(" / "), 20);
  add("identity.location", profile.location, 30);
  add("identity.tagline", profile.headline, 30);
  add("contact.phone", profile.phone, 10);
  if (profile.whatsapp?.startsWith("https://wa.me/")) {
    add("contact.whatsapp", profile.whatsapp, 10);
  }
  add("contact.site", "https://www.edmundokutuzov.art", 10);
  for (const social of profile.socials) {
    if (social.label === "LinkedIn" && social.href.startsWith("https://www.linkedin.com/")) {
      add("social.linkedin", social.href, 40);
    }
    if (social.label === "Instagram" && social.href.startsWith("https://www.instagram.com/")) {
      add("social.instagram", social.href, 40);
    }
  }
  for (const client of tables.clients) {
    if (client.is_visible && client.show_on_clients_page && client.slug) {
      add("client." + client.slug, client.name, 60);
    }
  }
  for (const service of tables.services) {
    if (service.is_published && service.slug) {
      add("service." + service.slug, service.title + ": " + service.line, 55);
    }
  }
  for (const metric of tables.metrics) {
    if (metric.is_published && metric.label) {
      add("stats." + metric.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), metric.value, 70);
    }
  }
  return facts.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
}

/**
 * Best-effort limits while Supabase billing/availability prevents distributed
 * atomic quotas. Intentionally stricter; not a distributed global rate limiter.
 * Never use these limits to authorize continuous Gemini Live sessions.
 */
type Slot = { minute: number; perMinute: number; day: number; perDay: number };
const fallbackSlots = new Map<string, Slot>();
const MINUTE = 60_000;
const DAY = 86_400_000;

function checkSlot(key: string, now: number, minuteLimit: number, dayLimit: number): Slot | null {
  const minute = Math.floor(now / MINUTE);
  const day = Math.floor(now / DAY);
  const previous = fallbackSlots.get(key);
  const state: Slot = {
    minute, day,
    perMinute: previous?.minute === minute ? previous.perMinute : 0,
    perDay: previous?.day === day ? previous.perDay : 0,
  };
  return state.perMinute < minuteLimit && state.perDay < dayLimit ? state : null;
}

export function acquireEmergencyQuota(bucket: string, now = Date.now()): boolean {
  if (!/^[a-f0-9]{64}$/.test(bucket)) return false;
  const clientKey = "ip:" + bucket;
  const globalKey = "instance:all";
  const client = checkSlot(clientKey, now, 12, 48);
  const global = checkSlot(globalKey, now, 100, 240);
  if (!client || !global) return false;

  fallbackSlots.set(clientKey, { ...client, perMinute: client.perMinute + 1, perDay: client.perDay + 1 });
  fallbackSlots.set(globalKey, { ...global, perMinute: global.perMinute + 1, perDay: global.perDay + 1 });
  // Bound memory on long-lived instances. Eviction makes limits more permissive,
  // hence preserve the global slot and keep the most recent distinct visitors.
  if (fallbackSlots.size > 1000) {
    for (const key of fallbackSlots.keys()) {
      if (key !== globalKey && key !== clientKey) fallbackSlots.delete(key);
      if (fallbackSlots.size <= 800) break;
    }
  }
  return true;
}

