import { Link } from "@tanstack/react-router";
import type { Project } from "@/lib/cms/types";
import { isCampaignDiscipline } from "@/lib/work-title-visibility";
import { ProjectMedia } from "./ProjectMedia";

export function ArtSlot({ project, className, loading = "eager" }: {
  project: Project;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  if (project.cover) {
    return <ProjectMedia src={project.cover} alt={project.coverAlt || project.title}
      className={`block h-auto w-full ${className ?? ""}`} loading={loading} />;
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
    <Link to="/work/$slug" params={{ slug: project.slug }} reloadDocument data-cursor="View"
      data-work-campaign={isCampaignDiscipline(project.discipline) ? "true" : "false"}
      className="group block">
      <div className="overflow-hidden rounded-sm">
        <div className="w-full transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.02]">
          <ArtSlot project={project} loading={index < 3 ? "eager" : "lazy"} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        {isCampaignDiscipline(project.discipline) && <h3 className="font-display text-2xl font-semibold">{project.title}</h3>}
        <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <p className="eyebrow mt-1">
        {project.client} · {project.discipline} · {project.year}
      </p>
    </Link>
  );
}
