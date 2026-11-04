import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpRight, MapPin } from "lucide-react";

import { PageHero, Reveal } from "@/components/Reveal";
import { SafeAssetImage } from "@/components/SafeAssetImage";
import { loadAboutContent } from "@/lib/cms/loaders";
import { requireHeroSection } from "@/lib/cms/section-utils";
import { aboutBiography } from "@/lib/content";
import { seoFromPage } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  loader: () => loadAboutContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "About — Edmundo Kutuzov" }] },
  component: About,
});

const skillLevelLabel: Record<string, string> = {
  Core: "Core practice",
  Fluent: "Fluent",
  Exploring: "In development",
};

function About() {
  const data = Route.useLoaderData();
  const { tx } = useI18n();
  const { profile, metrics, experience, skills, disciplines, principles, projects, clients, sections } = data;
  const hero = requireHeroSection(sections);
  const biography = profile.biography?.trim()
    ? profile.biography.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : aboutBiography;
  // The About portrait is the approved profile image supplied for the current site.
  // Keep it local so the public page does not depend on an outdated CMS asset path.
  const portrait = "/edmundo-kutuzov-foto.jpg";
  const selectedProjects = projects.slice(0, 4);

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={profile.intro} />

      <section className="grid gap-10 px-6 py-20 md:grid-cols-[minmax(250px,0.82fr)_minmax(0,1.5fr)] md:gap-16 md:px-12 md:py-28">
        <Reveal>
          <div className="about-portrait relative isolate aspect-[3/4] overflow-hidden rounded-sm border border-border bg-card">
            {portrait ? (
              <SafeAssetImage
                src={portrait}
                alt={profile.name + ", Art Director"}
                loading="eager"
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center bg-card"
                fallbackLabel="Portrait unavailable"
              />
            ) : (
              <div className="about-portrait__fallback flex h-full flex-col justify-between p-6 md:p-8" aria-label="Portrait awaiting upload" role="img">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-foreground/70">Maputo, Mozambique</span>
                  <span className="font-mono text-xs text-primary">01 / 04</span>
                </div>
                <div className="relative">
                  <span className="about-portrait__monogram font-display font-bold tracking-[-0.12em]">EK</span>
                  <div className="mt-5 h-px w-16 bg-primary" />
                  <p className="mt-4 max-w-[12rem] font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-muted-foreground">
                    Art direction<br />Brand systems<br />Creative technology
                  </p>
                </div>
                <div className="flex items-end justify-between border-t border-border pt-4">
                  <span className="eyebrow text-foreground/70">Edmundo Kutuzov</span>
                  <span className="font-mono text-xs text-muted-foreground">Since 2020</span>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={13} aria-hidden="true" /> {tx("Based in Maputo. Working worldwide.")}
          </p>
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col justify-center">
          <p className="eyebrow mb-7 text-primary">{tx("The person behind the practice")}</p>
          <div className="space-y-6 text-lg leading-relaxed md:text-xl">
            {biography.map((paragraph, index) => (
              <p key={index} className={index === 0 ? "text-foreground" : "text-muted-foreground"}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="/edmundo-kutuzov-cv-2026.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <ArrowDownToLine size={16} aria-hidden="true" />
              View CV (PDF)
            </a>
            <a href="/contact" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm transition hover:border-primary">
              {tx("Start a conversation")} <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </section>

      <section className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => {
          const yearsMetric = metric.label.toLowerCase().includes("year");
          const displayValue = yearsMetric && /^7\+?$/.test(metric.value) ? "6+" : metric.value;
          const note = yearsMetric ? "Creative practice since 2020" : metric.note;
          return (
            <div key={metric.label} className="bg-background px-6 py-10 md:px-7 md:py-14">
              <p className="font-display text-4xl font-bold tracking-tight text-primary md:text-5xl">{displayValue}</p>
              <p className="mt-3 font-semibold">{metric.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note}</p>
            </div>
          );
        })}
      </section>

      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mb-12 flex flex-col justify-between gap-5 md:mb-16 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-5 text-primary">{tx("Experience / 2020 - 2026")}</p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">{tx("Professional timeline.")}</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            A progression from hands-on graphic design to art direction, marketing communication and the leadership of integrated creative work.
          </p>
        </div>

        <div className="border-t border-border">
          {experience.map((item, index) => (
            <Reveal key={item.company} delay={index * 0.035}>
              <article className="grid gap-4 border-b border-border py-8 md:grid-cols-[0.72fr_1.8fr_1fr] md:gap-10 md:py-10">
                <p className="font-mono text-sm text-primary">{item.period}</p>
                <div>
                  <p className="eyebrow mb-3">{item.role}</p>
                  <h3 className="font-display text-2xl font-bold md:text-3xl">{item.company}</h3>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
                <p className="eyebrow md:pt-1 md:text-right"> {String(index + 1).padStart(2, "0")} / Career</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-card/40 px-6 py-24 md:px-12 md:py-32">
        <div className="mb-12 flex flex-col justify-between gap-5 md:mb-16 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-5 text-primary">{tx("Selected achievements")}</p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">{tx("Work with a point of view.")}</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Selected projects that demonstrate creative responsibility, visual direction and the ability to carry one idea across a wider communication system.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {selectedProjects.map((project, index) => {
            const cover = resolvePublicAssetUrl(project.cover);
            return (
              <Reveal key={project.id} delay={index * 0.04}>
                <article className="group h-full overflow-hidden rounded-sm border border-border bg-background">
                  <Link to="/work/$slug" params={{ slug: project.slug }} className="block">
                    <div className="relative aspect-[16/9] overflow-hidden bg-card">
                      {cover ? (
                        <SafeAssetImage
                          src={cover}
                          alt={project.coverAlt || project.title}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-card"
                          fallbackLabel="Project image unavailable"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-display text-5xl font-bold text-primary/60">EK</div>
                      )}
                      <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-background/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground backdrop-blur">
                        {String(index + 1).padStart(2, "0")} / Selected
                      </span>
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <span>{project.client}</span><span aria-hidden="true">/</span><span>{project.year}</span><span aria-hidden="true">/</span><span>{project.discipline}</span>
                      </div>
                      <h3 className="font-display text-2xl font-bold md:text-3xl">{project.title}</h3>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{project.outcome || project.idea || project.summary}</p>
                      <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        {tx("Explore project")} <ArrowUpRight size={15} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <p className="eyebrow mb-6">{tx("Selected collaborations")}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {clients.map((client) => (
              <span key={client.slug} className="text-sm text-muted-foreground">{client.name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-16 px-6 py-24 md:grid-cols-2 md:px-12 md:py-32">
        <div>
          <p className="eyebrow mb-8 text-primary">{tx("Tools & proficiency")}</p>
          <h2 className="mb-10 font-display text-4xl font-bold tracking-tight md:text-5xl">{tx("The tools serve the idea.")}</h2>
          <div className="divide-y divide-border border-y border-border">
            {skills.map((skill) => (
              <div key={skill.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
                <span className="font-display text-lg">{skill.name}</span>
                <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {skillLevelLabel[skill.tier] || skill.tier}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
            Proficiency is described through the current role of each tool in the practice, not through unsupported percentage scores.
          </p>
        </div>

        <div className="grid content-start gap-10 sm:grid-cols-2">
          {disciplines.map((discipline) => (
            <div key={discipline.group}>
              <p className="eyebrow mb-4 text-primary">{discipline.group}</p>
              <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                {discipline.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-4">
        {principles.map((principle, index) => (
          <div key={principle.title} className="bg-background p-8 md:p-10">
            <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-10 font-display text-2xl font-bold md:text-3xl">{principle.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{principle.text}</p>
          </div>
        ))}
      </section>

    </>
  );
}
