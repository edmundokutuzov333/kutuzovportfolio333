import { getAdminServerContext } from "./admin-auth.server";
import mediaManifest from "@/data/portfolio-media-manifest.json";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type PortfolioRow = { [key: string]: JsonValue };
type Snapshot = { snapshot_generated_at?: string; tables: { [key: string]: JsonValue } };

const OWNER = process.env["GITHUB_PORTFOLIO_OWNER"]?.trim() || "edmundokutuzov333";
const REPO = process.env["GITHUB_PORTFOLIO_REPO"]?.trim() || "kutuzovportfolio333";
const BRANCH = process.env["GITHUB_PORTFOLIO_BRANCH"]?.trim() || "main";
const PATH = "src/data/public-cms-snapshot.json";

export class GitHubPortfolioError extends Error {
  constructor(message: string, readonly code: "unavailable" | "conflict" | "invalid" = "unavailable") {
    super(message);
    this.name = "GitHubPortfolioError";
  }
}

function token(): string {
  const value = process.env["GITHUB_PORTFOLIO_TOKEN"]?.trim();
  if (!value) throw new GitHubPortfolioError("O token seguro do GitHub ainda não está configurado no servidor.");
  return value;
}

async function github<T>(resource: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${resource}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new GitHubPortfolioError("Não foi possível contactar o GitHub para guardar o projecto.");
  }
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 409 || response.status === 422) throw new GitHubPortfolioError("O conteúdo mudou no GitHub. Actualize o Admin e tente novamente.", "conflict");
    throw new GitHubPortfolioError(`O GitHub recusou a operação (HTTP ${response.status}).`);
  }
  try { return body ? JSON.parse(body) as T : undefined as T; } catch { throw new GitHubPortfolioError("O GitHub devolveu uma resposta inválida."); }
}

async function readSnapshot(): Promise<{ snapshot: Snapshot; sha: string }> {
  const result = await github<{ content: string; sha: string }>(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
  if (!result.content || !result.sha) throw new GitHubPortfolioError("O snapshot de projectos não foi encontrado no GitHub.");
  const raw = Buffer.from(result.content.replace(/\n/g, ""), "base64").toString("utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  if (!snapshot.tables || !Array.isArray(snapshot.tables["projects"])) throw new GitHubPortfolioError("O snapshot do GitHub não contém projectos válidos.", "invalid");
  return { snapshot, sha: result.sha };
}

function stamp(row: PortfolioRow, timestamp: string): PortfolioRow {
  const gallery = Array.isArray(row["gallery"]) ? row["gallery"] as JsonValue[] : [];
  const galleryAlt = Array.isArray(row["gallery_alt"]) ? row["gallery_alt"] as JsonValue[] : [];
  const localName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const discipline = typeof row["discipline"] === "string" ? row["discipline"] : "";
  const media = (value: JsonValue, alt: JsonValue | undefined): JsonValue => {
    if (typeof value !== "string" || typeof alt !== "string") return value;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(value)) return `/api/media/portfolio/2026/video/${encodeURIComponent(localName(alt))}.mp4`;
    const relative = (mediaManifest as Record<string, string>)[String(alt)]
      ?? (mediaManifest as Record<string, string>)[`${discipline}::${String(alt)}`];
    return relative
      ? `/portfolio-media/${relative.split("/").map(encodeURIComponent).join("/")}`
      : value;
  };
  const coverAlt = row["cover_alt"];
  const cover = row["cover_path"] ?? null;
  return {
    ...row,
    gallery: gallery.map((value, index) => media(value, galleryAlt[index])),
    cover_path: media(cover, coverAlt),
    updated_at: timestamp,
  };
}

export async function loadGitHubProjects(): Promise<PortfolioRow[]> {
  const { snapshot } = await readSnapshot();
  const timestamp = snapshot.snapshot_generated_at || new Date(0).toISOString();
  return (snapshot.tables["projects"] as PortfolioRow[]).map(row => stamp(row, timestamp));
}

export async function uploadGitHubPortfolioImage(input: { originalName: string; contentType: string; base64: string; category?: string | undefined }) {
  await getAdminServerContext();
  if (!/^image\/(png|jpeg|webp)$/.test(input.contentType)) throw new GitHubPortfolioError("As imagens do portfolio devem ser PNG, JPG ou WebP.", "invalid");
  const originalName = input.originalName.replace(/[\\/]/g, "_").trim();
  if (!originalName || originalName.length > 180 || !/\.(png|jpe?g|webp)$/i.test(originalName)) throw new GitHubPortfolioError("O nome da imagem não é válido.", "invalid");
  if (!input.base64 || input.base64.length > 30 * 1024 * 1024) throw new GitHubPortfolioError("A imagem excede o limite seguro de upload.", "invalid");
  const category = input.category?.trim().replace(/[^a-z0-9-]/gi, "").toLowerCase() || "social-media";
  const safeCategory = ["campaign-design", "manipulation", "social-media", "some-dezaines"].includes(category) ? category : "social-media";
  const path = `public/portfolio-media/${safeCategory}/${originalName}`;
  let sha: string | undefined;
  try { sha = (await github<{ sha: string }>(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`)).sha; } catch { /* new file */ }
  await github(`/repos/${OWNER}/${REPO}/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: `admin: upload portfolio image ${originalName}`, content: input.base64, ...(sha ? { sha } : {}), branch: BRANCH }) });
  return { publicUrl: `/portfolio-media/${safeCategory}/${encodeURIComponent(originalName)}`, path };
}

export async function mutateGitHubProject(input: {
  action: "create" | "update" | "publish" | "archive" | "restore";
  id: string | null;
  payload: Record<string, unknown>;
  expectedUpdatedAt: string | null;
  note?: string | null;
}) {
  await getAdminServerContext();
  const current = await readSnapshot();
  const payload = input.payload as PortfolioRow;
  const projects = current.snapshot.tables["projects"] as PortfolioRow[];
  const now = new Date().toISOString();
  let record: PortfolioRow | undefined;
  if (input.id === null) {
    record = {
      id: crypto.randomUUID(),
      position: projects.length,
      status: "draft",
      featured: false,
      project_type: "image",
      gallery: [],
      gallery_alt: [],
      ...payload,
      updated_at: now,
    };
    projects.push(record);
  } else {
    const index = projects.findIndex(row => row["id"] === input.id);
    if (index < 0) throw new GitHubPortfolioError("O projecto já não existe no GitHub.", "conflict");
    const existing = projects[index]!;
    if (input.expectedUpdatedAt && existing["updated_at"] && existing["updated_at"] !== input.expectedUpdatedAt) {
      throw new GitHubPortfolioError("O projecto foi alterado depois de abrir o Admin. Actualize os dados.", "conflict");
    }
    record = { ...existing, ...payload, ["id"]: existing["id"] ?? "", ["updated_at"]: now };
    if (input.action === "archive") record = { ...record, ["status"]: "archived", ["featured"]: false };
    if (input.action === "restore") record = { ...record, ["status"]: "draft" };
    if (input.action === "publish") record = { ...record, ["status"]: "published" };
    projects[index] = record;
  }
  if (!record) throw new GitHubPortfolioError("O projecto não pôde ser preparado para gravação.", "invalid");
  current.snapshot.snapshot_generated_at = now;
  const content = Buffer.from(JSON.stringify(current.snapshot, null, 2) + "\n", "utf8").toString("base64");
  await github(`/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `admin: ${input.action} portfolio project ${record["slug"] || record["id"]}`,
      content,
      sha: current.sha,
      branch: BRANCH,
    }),
  });
  return { record, published_revision: 0 };
}

export async function reorderGitHubProjects(ids: string[], expectedIds: string[]) {
  await getAdminServerContext();
  if (ids.length === 0 || ids.length !== expectedIds.length || new Set(ids).size !== ids.length || !ids.every(id => expectedIds.includes(id))) {
    throw new GitHubPortfolioError("A ordem tem de conter todos os projectos uma única vez.", "invalid");
  }
  const current = await readSnapshot();
  const projects = current.snapshot.tables["projects"] as PortfolioRow[];
  const byId = new Map(projects.map(row => [String(row["id"]), row]));
  ids.forEach((id, position) => { const row = byId.get(id); if (row) row["position"] = position; });
  current.snapshot.snapshot_generated_at = new Date().toISOString();
  const content = Buffer.from(JSON.stringify(current.snapshot, null, 2) + "\n", "utf8").toString("base64");
  await github(`/repos/${OWNER}/${REPO}/contents/${PATH}`, { method: "PUT", body: JSON.stringify({ message: "admin: reorder portfolio projects", content, sha: current.sha, branch: BRANCH }) });
  return { count: ids.length, changed: ids.length, published_revision: 0 };
}

export async function deleteGitHubProject(id: string, expectedUpdatedAt: string | null) {
  await getAdminServerContext();
  const current = await readSnapshot();
  const projects = current.snapshot.tables["projects"] as PortfolioRow[];
  const index = projects.findIndex(row => row["id"] === id);
  if (index < 0) throw new GitHubPortfolioError("O projecto já não existe no GitHub.", "conflict");
  const row = projects[index]!;
  if (row["status"] !== "archived") throw new GitHubPortfolioError("Só é possível apagar definitivamente um projecto arquivado.", "invalid");
  if (expectedUpdatedAt && row["updated_at"] && row["updated_at"] !== expectedUpdatedAt) throw new GitHubPortfolioError("O projecto foi alterado depois de abrir o Admin.", "conflict");
  projects.splice(index, 1);
  current.snapshot.snapshot_generated_at = new Date().toISOString();
  const content = Buffer.from(JSON.stringify(current.snapshot, null, 2) + "\n", "utf8").toString("base64");
  await github(`/repos/${OWNER}/${REPO}/contents/${PATH}`, { method: "PUT", body: JSON.stringify({ message: `admin: permanently delete portfolio project ${id}`, content, sha: current.sha, branch: BRANCH }) });
  return { record: row, published_revision: 0 };
}
