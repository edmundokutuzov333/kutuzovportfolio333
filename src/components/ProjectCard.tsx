import { Link } from "@tanstack/react-router";
import type { Project } from "@/lib/content";

/** Art slot: shows the official cover when provided, otherwise a generative placeholder. */
export function ArtSlot({ project, className }: { project: Project; className?: string }) {
  if (project.cover) {
    return <img src={project.cover} alt={project.title} className={`h-full w-full object-cover ${className ?? ""}`} />;
  }
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, oklch(0.55 0.16 ${project.hue}) 0%, transparent 55%), radial-gradient(circle at 75% 80%, oklch(0.4 0.12 ${project.hue + 40}) 0%, transparent 50%), var(--card)`,
      }}
    >
      <span className="eyebrow absolute bottom-4 left-4 text-foreground/60">Official art slot</span>
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
