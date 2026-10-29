import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(root, "src", "assets");
const reportDirectory = path.join(root, "reports");
const reportPath = path.join(reportDirectory, "assets-inventory.json");
const publicSiteUrl = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || null;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(fullPath)));
    else if (entry.isFile() && entry.name.endsWith(".asset.json")) paths.push(fullPath);
  }
  return paths;
}

const manifests = (await walk(assetRoot)).sort();
const assets = [];

for (const manifestPath of manifests) {
  const repositoryPath = path.relative(root, manifestPath).split(path.sep).join("/");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    assets.push({
      repositoryPath,
      valid: false,
      issue: error instanceof Error ? error.message : "Invalid JSON",
    });
    continue;
  }

  const binaryPath = manifestPath.slice(0, -".asset.json".length);
  let binaryAvailable = false;
  let binarySha256 = null;
  let binarySize = null;
  try {
    const info = await stat(binaryPath);
    if (info.isFile()) {
      binaryAvailable = true;
      binarySize = info.size;
      binarySha256 = createHash("sha256").update(await readFile(binaryPath)).digest("hex");
    }
  } catch {
    // Asset-service metadata often points to binaries not stored in Git.
  }

  const localUrl = typeof manifest.url === "string" ? manifest.url : null;
  const valid =
    manifest.version === 1 &&
    typeof manifest.asset_id === "string" &&
    typeof manifest.project_id === "string" &&
    typeof localUrl === "string" &&
    localUrl.startsWith("/__l5e/assets-v1/") &&
    typeof manifest.r2_key === "string" &&
    typeof manifest.content_type === "string" &&
    Number.isSafeInteger(manifest.size) &&
    manifest.size >= 0;

  assets.push({
    repositoryPath,
    valid,
    assetId: manifest.asset_id ?? null,
    lovableProjectId: manifest.project_id ?? null,
    manifestUrl: localUrl,
    sourceUrlCandidate: publicSiteUrl && localUrl ? new URL(localUrl, publicSiteUrl).toString() : null,
    storageKey: manifest.r2_key ?? null,
    originalFilename: manifest.original_filename ?? null,
    declaredByteSize: Number.isSafeInteger(manifest.size) ? manifest.size : null,
    contentType: manifest.content_type ?? null,
    createdAt: manifest.created_at ?? null,
    binaryAvailableInRepository: binaryAvailable,
    binarySize,
    binarySha256,
    dimensions: null,
    limitations: binaryAvailable
      ? ["Image dimensions have not yet been extracted by this metadata inventory."]
      : [
          "Binary not present beside the manifest in the Git repository.",
          "Dimensions and binary hash require retrieving the original binary from its current asset service.",
        ],
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  repository: "edmundokutuzov333/kutuzovportfolio333",
  currentMainSha: process.env.GITHUB_SHA ?? null,
  documentedPublicOrigin: publicSiteUrl,
  manifestCount: assets.length,
  invalidManifestCount: assets.filter((asset) => asset.valid === false).length,
  binariesAvailableInRepository: assets.filter((asset) => asset.binaryAvailableInRepository).length,
  assets,
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(
  `Asset inventory: ${report.manifestCount} manifests, ${report.invalidManifestCount} invalid, ${report.binariesAvailableInRepository} binaries available in repository.`,
);
if (report.invalidManifestCount > 0) process.exitCode = 1;
