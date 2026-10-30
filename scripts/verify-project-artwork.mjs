import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "src/lib/cms/public-config.ts");
const publicClientPath = path.join(root, "src/lib/cms/public-client.ts");
const [config, publicClient] = await Promise.all([
  readFile(configPath, "utf8"),
  readFile(publicClientPath, "utf8"),
]);

function readConstant(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:const|export const) ${escaped}\\s*=\\s*"([^"]+)"`));
  return match?.[1] ?? null;
}

const supabaseUrl =
  process.env.VITE_SUPABASE_URL?.trim() ||
  readConstant(config, "DEFAULT_SUPABASE_URL");
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  readConstant(config, "DEFAULT_SUPABASE_PUBLISHABLE_KEY");
const assetOrigin =
  process.env.PUBLIC_ASSET_ORIGIN?.trim() ||
  readConstant(config, "PUBLIC_PRODUCTION_ORIGIN");

if (!supabaseUrl || !publishableKey || !assetOrigin) {
  throw new Error("Public Supabase or asset-origin configuration is missing.");
}

const cmsEndpoint = new URL(
  "/rest/v1/projects?select=slug,title,cover_path,gallery,position&status=eq.published&order=position.asc",
  supabaseUrl,
);
const cmsResponse = await fetch(cmsEndpoint, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    Accept: "application/json",
  },
  signal: AbortSignal.timeout(20000),
});

if (!cmsResponse.ok) {
  throw new Error(`Could not read published project artwork from Supabase (HTTP ${cmsResponse.status}).`);
}

const projects = await cmsResponse.json();
if (!Array.isArray(projects)) {
  throw new Error("Supabase returned an invalid published projects response.");
}

const artwork = projects.flatMap((project) => [
  ...(typeof project.cover_path === "string" && project.cover_path.trim()
    ? [{ slug: project.slug, source: project.cover_path.trim() }]
    : []),
  ...(Array.isArray(project.gallery)
    ? project.gallery
        .filter((source) => typeof source === "string" && source.trim())
        .map((source) => ({ slug: project.slug, source: source.trim() }))
    : []),
]);

if (artwork.length === 0) {
  throw new Error("No published cover or gallery artwork was returned by Supabase.");
}

async function findManifests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findManifests(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".asset.json")) {
      files.push(fullPath);
    }
  }
  return files;
}

const manifestPaths = await findManifests(path.join(root, "src/assets/works"));
const manifestByUrl = new Map();
for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (typeof manifest.url === "string") {
    manifestByUrl.set(manifest.url, manifest);
  }
}

function resolveAsset(source) {
  try {
    const parsed = new URL(source);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed;
    throw new Error("Unsupported asset URL protocol.");
  } catch (error) {
    if (source.startsWith("/") && !source.startsWith("//")) {
      return new URL(source, assetOrigin);
    }
    throw error;
  }
}

const failures = [];
let verified = 0;

for (let start = 0; start < artwork.length; start += 4) {
  const batch = artwork.slice(start, start + 4);
  const results = await Promise.all(
    batch.map(async ({ slug, source }) => {
      try {
        const response = await fetch(resolveAsset(source), {
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
          headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = (response.headers.get("content-type") ?? "")
          .split(";")[0]
          .trim();
        if (!contentType.startsWith("image/")) {
          throw new Error(`expected image bytes, received ${contentType || "unknown content type"}`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const manifest = manifestByUrl.get(source);
        if (manifest && bytes.byteLength !== manifest.size) {
          throw new Error(`expected ${manifest.size} bytes, received ${bytes.byteLength}`);
        }

        return true;
      } catch (error) {
        failures.push(`${slug}: ${source} — ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    }),
  );

  verified += results.filter(Boolean).length;
}

console.log(
  `Verified ${verified}/${artwork.length} published project artworks across ${projects.length} projects using ${new URL(assetOrigin).origin}.`,
);

if (failures.length > 0) {
  console.error("Published project artwork source verification failed:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exitCode = 1;
}
