// Local, code-owned copy of the portfolio works used by JARVIS.
// Refresh by re-exporting published projects into src/data/portfolio-works.json.
import raw from "@/data/portfolio-works.json";

export type JarvisWork = {
  slug: string;
  title: string;
  client_label: string | null;
  year_label: string | null;
  discipline: string | null;
  cover_path: string | null;
  cover_alt: string | null;
  featured: boolean | null;
  position: number | null;
};

export const jarvisWorks: JarvisWork[] = raw as JarvisWork[];

export function worksDigest(limit = 159): string {
  return jarvisWorks
    .slice(0, limit)
    .map((w) => `- ${w.title}${w.client_label ? ` (${w.client_label})` : ""}${w.year_label ? `, ${w.year_label}` : ""}${w.discipline ? ` — ${w.discipline}` : ""}`)
    .join("\n");
}
