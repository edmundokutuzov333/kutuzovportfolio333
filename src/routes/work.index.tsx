import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHero, Reveal } from "@/components/Reveal";
import { ProjectCard } from "@/components/ProjectCard";
import { loadWorkContent } from "@/lib/cms/loaders";
import type { HeroSection } from "@/lib/cms/types";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/work/")({
  loader: () => loadWorkContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Work — Edmundo Kutuzov" }] },
  component: Work,
});

function Work() {
  const data = Route.useLoaderData();
  const hero = data.sections.find((section): section is HeroSection => section.section_type === "hero");
  if (!hero) throw new Error("The published Work page is missing its hero section.");

  const filters = ["All", ...Array.from(new Set(data.projects.map((project) => project.discipline)))];
  const [filter, setFilter] = useState("All");
  const projects = data.projects.filter((project) => filter === "All" || project.discipline === filter);

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={hero.config.intro} />
      <div className="flex flex-wrap gap-2 px-6 pb-12 md:px-12">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-widest transition ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="grid gap-x-8 gap-y-20 px-6 pb-32 md:grid-cols-2 md:px-12 lg:grid-cols-3">
        {projects.map((project, index) => (
          <Reveal key={project.slug} delay={(index % 3) * 0.05}>
            <ProjectCard project={project} index={index} />
          </Reveal>
        ))}
      </section>
    </>
  );
}
