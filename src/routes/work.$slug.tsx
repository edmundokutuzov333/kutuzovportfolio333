import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero, Reveal } from "@/components/Reveal";
import { ArtSlot } from "@/components/ProjectCard";
import { projects } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/work/$slug")({
  loader: ({ params }) => {
    const project = projects.find((p) => p.slug === params.slug);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(loaderData.project.title, `${loaderData.project.discipline} for ${loaderData.project.client} — case study by Edmundo Kutuzov.`)
      : { meta: [{ title: "Project not found" }, { name: "robots", content: "noindex" }] },
  component: CaseStudy,
});

function CaseStudy() {
  const { project } = Route.useLoaderData();
  const idx = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(idx + 1) % projects.length] ?? project;
  const facts = [["Client", project.client], ["Discipline", project.discipline], ["Year", project.year], ["Role", "Art Direction"]];
  return (
    <>
      <PageHero eyebrow={`Case ${String(idx + 1).padStart(2, "0")}`} lines={project.title.split(" ")} />
      <div className="px-6 md:px-12">
        <div className="aspect-[16/9] overflow-hidden rounded-sm"><ArtSlot project={project} /></div>
      </div>
      <section className="grid gap-12 px-6 py-24 md:grid-cols-3 md:px-12">
        <dl className="space-y-6">
          {facts.map(([k, v]) => (
            <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-1 font-display text-xl">{v}</dd></div>
          ))}
        </dl>
        <div className="space-y-8 text-lg leading-relaxed text-muted-foreground md:col-span-2">
          <Reveal><p><span className="text-foreground">The challenge.</span> {project.challenge}</p></Reveal>
          <Reveal><p><span className="text-foreground">The idea.</span> {project.idea}</p></Reveal>
          <Reveal><p><span className="text-foreground">The outcome.</span> {project.outcome}</p></Reveal>
        </div>
      </section>
      <section className="grid gap-6 px-6 md:grid-cols-2 md:px-12">
        {project.gallery.map((src, n) => (
          <Reveal key={src} className={n % 3 === 2 ? "md:col-span-2" : ""}>
            <div className={`overflow-hidden rounded-sm ${n % 3 === 2 ? "aspect-[21/9]" : "aspect-square"}`}>
              <img src={src} alt={`${project.title} — ${n + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </Reveal>
        ))}
      </section>
      <Link to="/work/$slug" params={{ slug: next.slug }} data-cursor="Next" className="group mt-32 block border-t border-border px-6 py-24 md:px-12">
        <p className="eyebrow">Next project</p>
        <p className="mt-4 font-display text-6xl font-bold transition-colors group-hover:text-primary md:text-9xl">{next.title}</p>
      </Link>
    </>
  );
}
