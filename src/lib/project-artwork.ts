import type { Project } from "@/lib/cms/types";
import { resolvePublicAssetUrl } from "@/lib/public-assets";

export type ProjectArtwork = {
  src: string;
  alt: string;
  slug: string;
  projectTitle: string;
  artworkIndex: number;
};

/** Flatten published projects into an ordered stream: cover, then gallery. */
export function buildProjectArtwork(
  projects: readonly Pick<Project, "slug" | "title" | "position" | "cover" | "coverAlt" | "gallery" | "galleryAlt">[],
): ProjectArtwork[] {
  const orderedProjects = [...projects].sort((a, b) => a.position - b.position);

  return orderedProjects.flatMap((project) => {
    const images: ProjectArtwork[] = [];
    let artworkIndex = 1;

    if (project.cover) {
      const src = resolvePublicAssetUrl(project.cover);
      if (src) {
        images.push({
          src,
          alt: project.coverAlt || project.title + " - cover",
          slug: project.slug,
          projectTitle: project.title,
          artworkIndex: artworkIndex++,
        });
      }
    }

    project.gallery.forEach((source, galleryIndex) => {
      const src = resolvePublicAssetUrl(source);
      if (!src) return;
      images.push({
        src,
        alt: project.galleryAlt[galleryIndex] || project.title + " - artwork " + (galleryIndex + 1),
        slug: project.slug,
        projectTitle: project.title,
        artworkIndex: artworkIndex++,
      });
    });

    return images;
  });
}

/**
 * The homepage fan represents projects, not every asset inside a project.
 * Keep the first artwork for each slug, which is the cover when one exists,
 * so a multi-image project cannot appear as repeated cards in the carousel.
 */
export function buildProjectFanArtwork(
  projects: readonly Pick<Project, "slug" | "title" | "position" | "cover" | "coverAlt" | "gallery" | "galleryAlt">[],
): ProjectArtwork[] {
  const seen = new Set<string>();
  return buildProjectArtwork(projects).filter((artwork) => {
    if (seen.has(artwork.slug)) return false;
    seen.add(artwork.slug);
    return true;
  });
}


/** Backwards-compatible name retained for existing project artwork callers. */
export function resolveProjectArtworkUrl(source: string | null | undefined): string {
  return resolvePublicAssetUrl(source);
}
