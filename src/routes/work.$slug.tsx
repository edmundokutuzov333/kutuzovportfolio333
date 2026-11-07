import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageHero, Reveal } from "@/components/Reveal";
import { ArtSlot } from "@/components/ProjectCard";
import { ProjectMedia } from "@/components/ProjectMedia";
import { loadProjectDetailContent } from "@/lib/cms/loaders";
import { PUBLIC_SITE_URL } from "@/lib/cms/public-client";
import { seoFromPage, noIndexSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

function headlineLines(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > 19) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [title];
}

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
  const { t } = useI18n();
  const index = projects.findIndex((item) => item.slug === project.slug);
  const next = projects[(index + 1) % projects.length] ?? project;
  const facts = [
    [t("client"), project.client],
    [t("discipline"), project.discipline],
    [t("year"), project.year],
    [t("role"), "Art Direction"],
  ];

  return (
    <>
      <PageHero eyebrow={project.discipline} lines={headlineLines(project.title)} />
      <div className="px-6 md:px-12">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-sm"><ArtSlot project={project} /></div>
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
          {project.challenge ? <Reveal><p><span className="text-foreground">{t("challenge")}.</span> {project.challenge}</p></Reveal> : null}
          {project.idea ? <Reveal><p><span className="text-foreground">{t("idea")}.</span> {project.idea}</p></Reveal> : null}
          {project.outcome ? <Reveal><p><span className="text-foreground">{t("outcome")}.</span> {project.outcome}</p></Reveal> : null}
        </div>
      </section>
      <section className="grid items-start gap-6 px-6 md:grid-cols-2 md:px-12">
        {project.gallery.map((source, imageIndex) => (
          <Reveal key={source}>
            <div className="overflow-hidden rounded-sm">
              <ProjectMedia src={source} controls
                alt={project.galleryAlt[imageIndex] || project.title}
                className="block h-auto w-full" />
            </div>
          </Reveal>
        ))}
      </section>
      {projects.length > 1 && (
        <Link to="/work/$slug" params={{ slug: next.slug }} data-cursor="Next" className="group mt-32 block border-t border-border px-6 py-24 md:px-12">
          <p className="eyebrow">{t("nextProject")}</p>
          <p className="mt-4 max-w-4xl font-display text-[clamp(3rem,8vw,8rem)] font-bold leading-[0.9] tracking-tight transition-colors group-hover:text-primary">{next.title}</p>
        </Link>
      )}
    </>
  );
}
