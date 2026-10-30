import type { Project } from "@/lib/cms/types";
import { PUBLIC_PRODUCTION_ORIGIN } from "@/lib/cms/public-config";

export const PROJECT_RIBBON_ASPECT_RATIO = 1 / 2;

export type ProjectRibbonImage = {
  src: string;
  alt: string;
  slug: string;
  projectTitle: string;
  artworkIndex: number;
};

export type ProjectRibbonRows = {
  upper: ProjectRibbonImage[];
  lower: ProjectRibbonImage[];
  total: number;
};

/**
 * The CMS stores legacy Lovable asset-service paths as root-relative URLs.
 * The Vercel custom domain does not host the /__l5e route, so resolve those
 * paths against the project's configured public asset origin.
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
 * Convert published CMS projects into a deterministic visual artwork stream:
 * cover first, then gallery in CMS order, and finally distribute every image
 * alternately between the two rows. This keeps both rows balanced and ensures
 * each published artwork appears in only one row before its loop repeats.
 */
export function buildProjectRibbonRows(
  projects: readonly ProjectArtworkSource[],
): ProjectRibbonRows {
  const orderedProjects = [...projects].sort((a, b) => a.position - b.position);
  const artwork = orderedProjects.flatMap((project) => {
    const images: ProjectRibbonImage[] = [];
    let artworkIndex = 1;

    if (project.cover) {
      const src = resolveProjectArtworkUrl(project.cover);
      if (src) {
        images.push({
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
      images.push({
        src,
        alt: project.galleryAlt[galleryIndex] || `${project.title} — artwork ${galleryIndex + 1}`,
        slug: project.slug,
        projectTitle: project.title,
        artworkIndex: artworkIndex++,
      });
    });

    return images;
  });

  return {
    upper: artwork.filter((_, index) => index % 2 === 0),
    lower: artwork.filter((_, index) => index % 2 === 1),
    total: artwork.length,
  };
}
