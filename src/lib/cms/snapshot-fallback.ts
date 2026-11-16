import type { PublicCmsTable } from "./public-client";

const LOCAL_MEDIA_PREFIX = "/portfolio-media/";

function isVideoAsset(source: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(source);
}

function localMediaName(alt: string): string {
  // This one historical upload has an alt label without its original filename.
  if (alt === "POST 4 Wash & Go") return "POST_4-WASH&GO.webp";
  // Keep the repository asset lookup tolerant of the one legacy filename that
  // was imported with a leading space on disk.
  if (alt === "01_MAY_BELA.webp") return " 01_MAY_BELA.webp";
  const aliases: Record<string, string> = {
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
  const alias = aliases[localVideoName(alt)];
  if (alias) return alias;
  return alt;
}

function localVideoName(alt: string): string {
  return alt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveSnapshotMedia(source: string, alt: string | undefined): string {
  if (!alt) return source;
  if (isVideoAsset(source)) {
    // Videos deliberately live outside Supabase. The public route signs the
    // private Backblaze object at request time, so no storage credential is
    // exposed in the repository or browser bundle.
    return `/api/media/portfolio/2026/video/${encodeURIComponent(localVideoName(alt))}.mp4`;
  }
  return `${LOCAL_MEDIA_PREFIX}${encodeURIComponent(localMediaName(alt))}`;
}

function localiseSnapshotProject(row: Record<string, unknown>): Record<string, unknown> {
  const gallery = Array.isArray(row["gallery"]) ? row["gallery"] as unknown[] : [];
  const galleryAlt = Array.isArray(row["gallery_alt"]) ? row["gallery_alt"] as unknown[] : [];
  const localGallery = gallery.map((source, index) =>
    typeof source === "string" ? resolveSnapshotMedia(source, typeof galleryAlt[index] === "string" ? galleryAlt[index] : undefined) : source,
  );
  const cover = typeof row["cover_path"] === "string" && row["cover_path"] ? row["cover_path"] : null;
  return {
    ...row,
    gallery: localGallery,
    cover_path: cover ? resolveSnapshotMedia(cover, typeof row["cover_alt"] === "string" ? row["cover_alt"] : undefined) : cover,
  };
}

/**
 * Emergency, READ-ONLY snapshot of the last known published public CMS rows.
 *
 * The snapshot contains no unpublished projects, hidden clients, private
 * submissions, audit logs, credentials or administrative data. It is loaded
 * lazily only after a retriable public Supabase API error.
 *
 * Projects are intentionally repository-authoritative. Other public CMS
 * tables may still use this helper as a temporary read-only fallback while
 * Supabase is quota-restricted.
 */
export async function selectOfflinePublicRows(
  table: PublicCmsTable,
  query: Record<string, string>,
): Promise<unknown[]> {
  const snapshot = (await import("@/data/public-cms-snapshot.json")).default;
  const tables = snapshot.tables as unknown as Record<string, Record<string, unknown>[]>;
  const source = tables[table];
  if (!Array.isArray(source)) throw new Error(`Public snapshot missing: ${table}`);

  let rows = [...source];
  if (table === "projects") rows = rows.map(localiseSnapshotProject);
  for (const [field, condition] of Object.entries(query)) {
    if (field === "select" || field === "order" || field === "limit") continue;

    if (condition.startsWith("eq.")) {
      const expected = condition.slice(3);
      rows = rows.filter(row => String(row[field] ?? "") === expected);
    } else if (condition === "is.true" || condition === "is.false") {
      rows = rows.filter(row => row[field] === (condition === "is.true"));
    } else if (condition === "eq.true" || condition === "eq.false") {
      rows = rows.filter(row => row[field] === (condition === "eq.true"));
    } else if (condition === "is.null") {
      rows = rows.filter(row => row[field] === null || row[field] === undefined);
    } else {
      // Never return an unfiltered result for an unfamiliar PostgREST predicate.
      throw new Error(`Unsupported public snapshot filter: ${table}.${field}`);
    }
  }

  if (query["order"]) {
    const [field, direction] = query["order"].split(".");
    if (!field || (direction !== "asc" && direction !== "desc")) {
      throw new Error("Unsupported public snapshot sort order");
    }
    const sign = direction === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const left = a[field];
      const right = b[field];
      if (left === right) return 0;
      if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
      return String(left ?? "").localeCompare(String(right ?? "")) * sign;
    });
  }

  const limit = query["limit"];
  if (limit !== undefined) {
    const count = Number(limit);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid public snapshot limit");
    rows = rows.slice(0, count);
  }

  // Match the PostgREST column projection: never leak snapshot fields that
  // the corresponding public query did not request.
  const columns = query["select"]?.split(",") ?? [];
  if (columns.length && columns[0] !== "*") {
    rows = rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
  }
  return rows;
}
