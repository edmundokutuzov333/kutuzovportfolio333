import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { PageHero, Reveal } from "@/components/Reveal";
import { loadAboutContent } from "@/lib/cms/loaders";
import { requireHeroSection, requireRichTextSection } from "@/lib/cms/section-utils";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  loader: () => loadAboutContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "About — Edmundo Kutuzov" }] },
  component: About,
});

function About() {
  const data = Route.useLoaderData();
  const { profile, metrics, experience, skills, disciplines, principles, sections } = data;
  const hero = requireHeroSection(sections);
  const aboutCopy = requireRichTextSection(sections, "about-copy");

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={profile.intro} />

      <section className="grid gap-12 px-6 py-24 md:grid-cols-[1fr_2fr] md:px-12">
        <div className="aspect-[3/4] rounded-sm bg-card">
          <div className="flex h-full items-end p-4"><span className="eyebrow">Portrait slot</span></div>
        </div>
        <Reveal className="space-y-6 text-xl leading-relaxed">
          {aboutCopy.config.paragraphs.map((paragraph, index) => (
            <p key={index} className={index === 1 ? "text-muted-foreground" : undefined}>{paragraph}</p>
          ))}
        </Reveal>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-background px-6 py-14">
            <p className="font-display text-5xl font-bold text-primary">{metric.value}</p>
            <p className="mt-2 font-semibold">{metric.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{metric.note}</p>
          </div>
        ))}
      </section>

      <section className="px-6 py-32 md:px-12">
        <p className="eyebrow mb-10">Career</p>
        {experience.map((item, index) => (
          <Reveal key={item.company} delay={index * 0.03}>
            <div className="grid gap-4 border-t border-border py-10 md:grid-cols-[1fr_2fr_1fr]">
              <p className="font-mono text-sm text-primary">{item.period}</p>
              <div>
                <h2 className="font-display text-3xl font-bold">{item.company}</h2>
                <p className="mt-3 max-w-xl text-muted-foreground">{item.text}</p>
              </div>
              <p className="eyebrow md:text-right">{item.role}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="grid gap-16 px-6 pb-32 md:grid-cols-2 md:px-12">
        <div>
          <p className="eyebrow mb-10">Tools & mastery</p>
          <div className="space-y-8">
            {skills.map((skill) => (
              <div key={skill.name}>
                <div className="mb-2 flex justify-between">
                  <span className="font-display text-lg">{skill.name}</span>
                  <span className="font-mono text-xs">{skill.tier} · {skill.value}%</span>
                </div>
                <div className="h-px bg-border">
                  <motion.div
                    className="h-px bg-primary"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${skill.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-10 sm:grid-cols-2">
          {disciplines.map((discipline) => (
            <div key={discipline.group}>
              <p className="eyebrow mb-4 text-primary">{discipline.group}</p>
              <ul className="space-y-2">
                {discipline.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-4">
        {principles.map((principle, index) => (
          <div key={principle.title} className="bg-background p-10">
            <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-12 font-display text-3xl font-bold">{principle.title}</h2>
            <p className="mt-3 text-muted-foreground">{principle.text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
