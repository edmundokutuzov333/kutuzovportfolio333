import type { Project } from "@/lib/cms/types";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

export const PROJECT_RIBBON_ASPECT_RATIO = 4 / 5;

export type ProjectRibbonImage = {
  src: string;
  alt: string;
  slug: string;
  projectTitle: string;
  artworkIndex: number;
};

/**
 * The CMS stores legacy Lovable asset-service paths as root-relative URLs.
 * The Vercel custom domain does not host the /__l5e route, so resolve those
 * paths against the project's explicitly configured public asset origin.
 */
export function resolveProjectArtworkUrl(source: string): string {
  const value = source.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return "";
  } catch {
    // Root-relative paths are expected for the existing Lovable asset service.
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return new URL(value, PUBLIC_PRODUCTION_ORIGIN).toString();
  }

  return "";
}

type ProjectArtworkSource = Pick<
  Project,
  "slug" | "title" | "position" | "cover" | "coverAlt" | "gallery" | "galleryAlt"
>;

/**
 * Convert the published CMS projects into a stable, ordered artwork stream:
 * each project's cover first, then its gallery in the exact stored order.
 * The homepage loader already filters this list to published projects.
 */
export function buildProjectRibbonImages(
  projects: readonly ProjectArtworkSource[],
): ProjectRibbonImage[] {
  const orderedProjects = [...projects].sort((a, b) => a.position - b.position);

  return orderedProjects.flatMap((project) => {
    const artwork: ProjectRibbonImage[] = [];
    let artworkIndex = 1;

    if (project.cover) {
      const src = resolveProjectArtworkUrl(project.cover);
      if (src) {
        artwork.push({
          src,
          alt: project.coverAlt || `${project.title} — cover`,
          slug: project.slug,
          projectTitle: project.title,
          artworkIndex: artworkIndex++,
        });
      }
    }

    project.gallery.forEach((source, galleryIndex) => {
      const src = resolveProjectArtworkUrl(source);
      if (!src) return;

      artwork.push({
        src,
        alt: project.galleryAlt[galleryIndex] || `${project.title} — artwork ${galleryIndex + 1}`,
        slug: project.slug,
        projectTitle: project.title,
        artworkIndex: artworkIndex++,
      });
    });

    return artwork;
  });
}
