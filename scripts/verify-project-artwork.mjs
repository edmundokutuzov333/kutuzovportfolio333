import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "src/lib/cms/public-config.ts");
const config = await readFile(configPath, "utf8");
const originMatch = config.match(/PUBLIC_PRODUCTION_ORIGIN\\s*=\\s*"([^"]+)"/);

if (!originMatch) {
  throw new Error("PUBLIC_PRODUCTION_ORIGIN is missing from public-config.ts.");
}

const origin = new URL(originMatch[1]);
if (origin.protocol !== "https:" || origin.pathname !== "/") {
  throw new Error("The project asset origin must be a root HTTPS origin.");
}

const worksDirectory = path.join(root, "src/assets/works");

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

const manifests = (await findManifests(worksDirectory)).sort();
if (manifests.length === 0) {
  throw new Error("No original project artwork manifests were found.");
}

const failures = [];
let verified = 0;

for (let start = 0; start < manifests.length; start += 4) {
  const batch = manifests.slice(start, start + 4);
  const results = await Promise.all(
    batch.map(async (manifestPath) => {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (
        typeof manifest.url !== "string" ||
        !manifest.url.startsWith("/__l5e/assets-v1/") ||
        !Number.isSafeInteger(manifest.size) ||
        typeof manifest.content_type !== "string" ||
        !manifest.content_type.startsWith("image/")
      ) {
        throw new Error(`${path.relative(root, manifestPath)} has invalid asset metadata.`);
      }

      const url = new URL(manifest.url, origin);
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8" },
      });

      if (!response.ok) {
        throw new Error(`${manifest.original_filename ?? manifest.url}: HTTP ${response.status}`);
      }

      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!contentType.startsWith("image/")) {
        throw new Error(`${manifest.original_filename ?? manifest.url}: expected image bytes, received ${contentType || "unknown content type"}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== manifest.size) {
        throw new Error(`${manifest.original_filename ?? manifest.url}: expected ${manifest.size} bytes, received ${bytes.byteLength}`);
      }

      return manifest.original_filename ?? path.basename(manifest.url);
    }),
  ).catch((error) => {
    failures.push(error instanceof Error ? error.message : String(error));
    return [];
  });

  verified += results.length;
}

console.log(`Verified ${verified}/${manifests.length} original project artwork files against ${origin.origin}.`);

if (failures.length > 0) {
  console.error("Project artwork source verification failed:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exitCode = 1;
}
