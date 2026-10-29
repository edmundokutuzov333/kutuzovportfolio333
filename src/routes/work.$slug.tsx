import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageHero, Reveal } from "@/components/Reveal";
import { ArtSlot } from "@/components/ProjectCard";
import { SafeAssetImage } from "@/components/SafeAssetImage";
import { loadProjectDetailContent } from "@/lib/cms/loaders";
import { PUBLIC_SITE_URL } from "@/lib/cms/public-client";
import { seoFromPage, noIndexSeo } from "@/lib/seo";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    const data = await loadProjectDetailContent(params.slug);
    if (!data.project) {
      if (data.redirectSlug) {
        throw redirect({
          to: "/work/$slug",
          params: { slug: data.redirectSlug },
          statusCode: 301,
        });
      }
      throw notFound();
    }
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.project) return noIndexSeo("Project not found");
    const project = loaderData.project;
    const canonicalUrl = PUBLIC_SITE_URL
      ? new URL(`/work/${encodeURIComponent(project.slug)}`, PUBLIC_SITE_URL).toString()
      : undefined;
    return seoFromPage(loaderData.page, {
      title: `${project.title} - Edmundo Kutuzov`,
      description: `${project.discipline} for ${project.client} - case study by Edmundo Kutuzov.`,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      image: project.cover,
    });
  },
  component: CaseStudy,
});

function CaseStudy() {
  const { project, projects } = Route.useLoaderData();
  const index = projects.findIndex((item) => item.slug === project.slug);
  const next = projects[(index + 1) % projects.length] ?? project;
  const facts = [
    ["Client", project.client],
    ["Discipline", project.discipline],
    ["Year", project.year],
    ["Role", "Art Direction"],
  ];

  return (
    <>
      <PageHero eyebrow={`Case ${String(index + 1).padStart(2, "0")}`} lines={project.title.split(" ")} />
      <div className="px-6 md:px-12">
        <div className="aspect-[16/9] overflow-hidden rounded-sm"><ArtSlot project={project} /></div>
      </div>
      <section className="grid gap-12 px-6 py-24 md:grid-cols-3 md:px-12">
        <dl className="space-y-6">
          {facts.map(([key, value]) => (
            <div key={key}>
              <dt className="eyebrow">{key}</dt>
              <dd className="mt-1 font-display text-xl">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-8 text-lg leading-relaxed text-muted-foreground md:col-span-2">
          <Reveal><p><span className="text-foreground">The challenge.</span> {project.challenge}</p></Reveal>
          <Reveal><p><span className="text-foreground">The idea.</span> {project.idea}</p></Reveal>
          <Reveal><p><span className="text-foreground">The outcome.</span> {project.outcome}</p></Reveal>
        </div>
      </section>
      <section className="grid gap-6 px-6 md:grid-cols-2 md:px-12">
        {project.gallery.map((source, imageIndex) => (
          <Reveal key={source} className={imageIndex % 3 === 2 ? "md:col-span-2" : ""}>
            <div className={`overflow-hidden rounded-sm ${imageIndex % 3 === 2 ? "aspect-[21/9]" : "aspect-square"}`}>
              <SafeAssetImage
                src={source}
                alt={project.galleryAlt[imageIndex] || `${project.title}, image ${imageIndex + 1}`}
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center border border-dashed border-border bg-card p-6 text-center"
                fallbackLabel="Image unavailable"
              />
            </div>
          </Reveal>
        ))}
      </section>
      {projects.length > 1 && (
        <Link to="/work/$slug" params={{ slug: next.slug }} data-cursor="Next" className="group mt-32 block border-t border-border px-6 py-24 md:px-12">
          <p className="eyebrow">Next project</p>
          <p className="mt-4 font-display text-6xl font-bold transition-colors group-hover:text-primary md:text-9xl">{next.title}</p>
        </Link>
      )}
    </>
  );
}
