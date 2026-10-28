import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero, Reveal } from "@/components/Reveal";
import { ProjectCard } from "@/components/ProjectCard";
import { projects } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/work/")({
  head: () => seo("Work", "Selected campaigns, identities and digital systems directed by Edmundo Kutuzov."),
  component: Work,
});

function Work() {
  const filters = ["All", ...Array.from(new Set(projects.map((p) => p.discipline)))];
  const [f, setF] = useState("All");
  const list = projects.filter((p) => f === "All" || p.discipline === f);
  return (
    <>
      <PageHero eyebrow="Index of work" lines={["Selected", "work."]} intro="Campaigns, identities and content systems. Official artwork arrives soon — each slot below is ready to receive it." />
      <div className="flex flex-wrap gap-2 px-6 pb-12 md:px-12">
        {filters.map((x) => (
          <button key={x} onClick={() => setF(x)} className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-widest transition ${f === x ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>
            {x}
          </button>
        ))}
      </div>
      <section className="grid gap-x-8 gap-y-20 px-6 pb-32 md:grid-cols-2 md:px-12 lg:grid-cols-3">
        {list.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 3) * 0.1}>
            <ProjectCard project={p} index={i} />
          </Reveal>
        ))}
      </section>
    </>
  );
}
