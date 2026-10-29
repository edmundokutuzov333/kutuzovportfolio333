import { Link } from "@tanstack/react-router";
import type { Project } from "@/lib/cms/types";
import { SafeAssetImage } from "./SafeAssetImage";

export function ArtSlot({ project, className }: { project: Project; className?: string }) {
  if (project.cover) {
    return (
      <SafeAssetImage
        src={project.cover}
        alt={project.coverAlt}
        className={`h-full w-full object-cover ${className ?? ""}`}
        fallbackClassName={`flex h-full w-full items-center justify-center border border-dashed border-border bg-card p-6 text-center ${className ?? ""}`}
        fallbackLabel="Cover unavailable"
        loading="eager"
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center border border-dashed border-border bg-card p-6 text-center ${className ?? ""}`}
      role="img"
      aria-label={`No verified cover is available for ${project.title}`}
      data-asset-state="unavailable"
    >
      <span className="eyebrow text-muted-foreground">Cover unavailable</span>
    </div>
  );
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <Link to="/work/$slug" params={{ slug: project.slug }} data-cursor="View" className="group block">
      <div className="aspect-[4/5] overflow-hidden rounded-sm">
        <div className="h-full w-full transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-105">
          <ArtSlot project={project} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-2xl font-semibold">{project.title}</h3>
        <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <p className="eyebrow mt-1">
        {project.client} · {project.discipline} · {project.year}
      </p>
    </Link>
  );
}
