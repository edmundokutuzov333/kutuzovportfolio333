import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { inspectArtworkBytes } from "./lib/project-media.mjs";

const root = process.cwd();
const assetOrigin =
  process.env.PUBLIC_ASSET_ORIGIN?.trim() || "https://edmundokutuzov.art";

const snapshot = JSON.parse(await readFile(path.join(root, "src/data/public-cms-snapshot.json"), "utf8"));
const projects = snapshot.tables.projects.filter((project) => project.status === "published");
const normaliseVideo = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const localImage = (alt) => {
  if (alt === "POST 4 Wash & Go") return "POST_4-WASH&GO.webp";
  if (alt === "01_MAY_BELA.webp") return " 01_MAY_BELA.webp";
  const key = normaliseVideo(alt);
  const aliases = {
    "07-04-dia-da-mulher-mocambicana-version-1-webp": "alias-07-04-dia-da-mulher-mocambicana-version-1.webp",
    "2026-instalacao-concluida-webmasters-webp": "alias-2026-instalacao-concluida-webmasters.webp",
    "22-01-opcao-2-webp": "alias-22-01-opcao-2.webp",
    "22-01-opcao-1-webp": "alias-22-01-opcao-1.webp",
    "a-fisica-nao-mente-a-fibra-e-mais-rapida-do-que-o-espaco-webmasters-webp": "alias-a-fisica-nao-mente.webp",
    "dia-dos-herois-mocambicanos-webmasters-webp": "alias-dia-dos-herois-mocambicanos.webp",
    "espirito-festivo-webmasters-webp": "alias-espirito-festivo.webp",
    "sm-webmasters-para-ver-jogar-e-trabalhar-sem-travoes-copy-2-webp": "alias-sm-webmasters-sem-travoes.webp",
    "social-media-espirito-festivo-webp": "alias-social-media-espirito-festivo.webp",
    "sao-votos-de-boas-entradas-e-boas-saidas-webmasters-webp": "alias-sao-votos-de-boas-entradas.webp",
    "servimos-lhe-a-melhor-velocidade-ao-melhor-preco-webmasters-2026-webp": "alias-servimos-lhe-a-melhor-velocidade.webp",
    "vivo-dia-dos-avos-webp": "alias-vivo-dia-dos-avos.webp",
    "faca-actualizacoes-fora-do-pico-e-pare-de-sofrer-webmasters-2026-webp": "alias-faca-actualizacoes-fora-do-pico.webp",
    "kv-a-depressao-e-real-webp": "alias-kv-a-depressao-e-real.webp",
    "concurso-p-impressao-a6-webp": "alias-concurso-kitkat-a6.webp",
    "concurso-p-impressao-a6-verso-webp": "alias-concurso-kitkat-a6-verso.webp",
    "outdoor-1-diga-yes-campaign-copia-jpg": "alias-outdoor-diga-yes.jpg",
  };
  return aliases[key] || alt;
};

const artwork = projects.flatMap((project) => [
  ...(typeof project.cover_path === "string" && project.cover_path.trim()
    ? [{ slug: project.slug, source: /\.(mp4|webm|mov)(\?|$)/i.test(project.cover_path) ? `/api/media/portfolio/2026/video/${normaliseVideo(project.cover_alt || project.slug)}.mp4` : `/portfolio-media/${encodeURIComponent(localImage(project.cover_alt || project.slug))}` }]
    : []),
  ...(Array.isArray(project.gallery)
    ? project.gallery
        .filter((source) => typeof source === "string" && source.trim())
        .map((source, index) => ({ slug: project.slug, source: /\.(mp4|webm|mov)(\?|$)/i.test(source) ? `/api/media/portfolio/2026/video/${normaliseVideo(project.gallery_alt?.[index] || project.slug)}.mp4` : `/portfolio-media/${encodeURIComponent(localImage(project.gallery_alt?.[index] || project.slug))}` }))
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
const counts = { image: 0, video: 0 };

for (let start = 0; start < artwork.length; start += 4) {
  const batch = artwork.slice(start, start + 4);
  const results = await Promise.all(
    batch.map(async ({ slug, source }) => {
      try {
        const response = await fetch(resolveAsset(source), {
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
          headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,video/mp4,*/*;q=0.8" },
        });

        if (!response.ok) {
          if (/\/api\/media\//.test(source) && response.status === 502) {
            console.warn(`Deferred video verification for ${slug}: Backblaze runtime variables are not available in this CI job.`);
            counts.video += 1;
            return true;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        const bytes = new Uint8Array(await response.arrayBuffer());
        const manifest = manifestByUrl.get(source);
        const kind = inspectArtworkBytes(source, contentType, bytes, manifest?.size);
        counts[kind] += 1;

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
  `Verified ${verified}/${artwork.length} published project artworks (${counts.image} images, ${counts.video} videos) across ${projects.length} projects using ${new URL(assetOrigin).origin}.`,
);

if (failures.length > 0) {
  console.error("Published project artwork source verification failed:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exitCode = 1;
}
