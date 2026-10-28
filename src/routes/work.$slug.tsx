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
  const next = projects[(idx + 1) % projects.length];
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
          <Reveal><p><span className="text-foreground">The challenge.</span> Case narrative goes here — the brief, the context and the tension the work needed to resolve.</p></Reveal>
          <Reveal><p><span className="text-foreground">The idea.</span> The core visual idea, its typographic and photographic language, and how it rolled out across channels.</p></Reveal>
          <Reveal><p><span className="text-foreground">The outcome.</span> Reach, recall and results — to be completed with real figures.</p></Reveal>
        </div>
      </section>
      <section className="grid gap-6 px-6 md:grid-cols-2 md:px-12">
        {[0, 1, 2].map((n) => (
          <Reveal key={n} className={n === 2 ? "md:col-span-2" : ""}>
            <div className={n === 2 ? "aspect-[21/9]" : "aspect-square"}>
              <ArtSlot project={{ ...project, hue: project.hue + n * 25 }} />
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
