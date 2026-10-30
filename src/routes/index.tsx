import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMemo, useRef } from "react";

import { Logo3D } from "@/components/Logo3D";
import { Reveal } from "@/components/Reveal";
import { ClientsMarquee } from "@/components/Clients";
import { ProjectCardFan } from "@/components/ProjectCardFan";
import { buildProjectArtwork } from "@/lib/project-artwork";
import { loadHomeContent } from "@/lib/cms/loaders";
import type { Profile } from "@/lib/cms/types";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: () => loadHomeContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Edmundo Kutuzov" }] },
  component: Home,
});

function Hero({ profile }: { profile: Profile }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.75]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative h-[100svh] overflow-hidden">
      <motion.div style={{ scale, opacity }} className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_30%,transparent),transparent_60%)]" />
        <Logo3D className="absolute inset-0" />
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-6 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-md font-display text-2xl font-semibold leading-tight md:text-3xl"
        >
          {profile.headline}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="eyebrow space-y-1 md:text-right"
        >
          <p>{profile.roles.join(" / ")}</p>
          <p>{profile.location}</p>
          <p className="text-primary">↓ Scroll</p>
        </motion.div>
      </div>
    </section>
  );
}

function Manifesto({ profile, label }: { profile: Profile; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 40%"] });
  const words = profile.intro.split(" ");
  return (
    <section className="px-6 py-32 md:px-12 md:py-48">
      <p className="eyebrow mb-10">{label}</p>
      <div ref={ref} className="max-w-6xl font-display text-3xl font-semibold leading-[1.15] md:text-6xl">
        {words.map((word, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {word}
          </Word>
        ))}
      </div>
    </section>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return <motion.span style={{ opacity }} className="mr-[0.25em] inline-block">{children}</motion.span>;
}

function Home() {
  const data = Route.useLoaderData();
  const { profile, sections, projects, services, metrics, clients, principles } = data;
  const artwork = useMemo(() => buildProjectArtwork(projects), [projects]);
  const numberedSectionTypes = new Set(["manifesto", "featured_work", "services", "clients"]);

  return (
    <>
      {sections.map((section, index) => {
        const number = String(
          sections.slice(0, index).filter((item) => numberedSectionTypes.has(item.section_type)).length + 1,
        ).padStart(2, "0");

        switch (section.section_type) {
          case "hero":
            return <Hero key={section.id} profile={profile} />;

          case "manifesto":
            return <Manifesto key={section.id} profile={profile} label={`(${number}) ${section.config.label}`} />;

          case "featured_work":
            return (
              <section key={section.id} className="px-6 py-32 md:px-12">
                <div className="mb-16 flex items-end justify-between gap-6">
                  <div>
                    <p className="eyebrow mb-4">{`(${number}) ${section.config.label}`}</p>
                    <h2 className="font-display text-5xl font-bold md:text-7xl">
                      {section.config.title_lines.map((line, lineIndex) => (
                        <span key={line}>{lineIndex > 0 && <br />}{line}</span>
                      ))}
                    </h2>
                  </div>
                  <Link to="/work" className="eyebrow shrink-0 whitespace-nowrap hover:text-primary">
                    {section.config.link_label} →
                  </Link>
                </div>
                {artwork.length > 0 && (
                  <div className="-mx-6 md:-mx-12">
                    <ProjectCardFan cards={artwork} />
                  </div>
                )}
              </section>
            );

          case "services":
            return (
              <section key={section.id} className="px-6 py-32 md:px-12">
                <p className="eyebrow mb-10">{`(${number}) ${section.config.label}`}</p>
                <div className="border-t border-border">
                  {services.map((service) => (
                    <Link key={service.slug} to="/services" className="group flex items-center justify-between gap-6 border-b border-border py-8 transition-colors hover:bg-primary hover:text-primary-foreground md:px-6">
                      <span className="font-mono text-xs">{service.n}</span>
                      <span className="flex-1 font-display text-3xl font-semibold transition-transform duration-500 group-hover:translate-x-4 md:text-5xl">{service.title}</span>
                      <span className="hidden max-w-xs text-sm opacity-70 md:block">{service.line}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );

          case "metrics":
            return (
              <section key={section.id} className="grid gap-px bg-border md:grid-cols-5">
                {metrics.map((metric, metricIndex) => (
                  <Reveal key={metric.label} delay={metricIndex * 0.04} className="bg-background px-6 py-16">
                    <p className="font-display text-6xl font-bold text-primary">{metric.value}</p>
                    <p className="mt-2 font-display text-xl font-semibold">{metric.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{metric.note}</p>
                  </Reveal>
                ))}
              </section>
            );

          case "clients":
            return (
              <section key={section.id} className="py-32">
                <div className="mb-14 px-6 md:px-12">
                  <p className="eyebrow mb-4">{`(${number}) ${section.config.label}`}</p>
                  <h2 className="font-display text-5xl font-bold md:text-7xl">
                    {section.config.title_lines.map((line, lineIndex) => (
                      <span key={line}>{lineIndex > 0 && <br />}{line}</span>
                    ))}
                  </h2>
                </div>
                <ClientsMarquee clients={clients} />
                <div className="mt-10 px-6 md:px-12">
                  <Link to="/clients" className="eyebrow hover:text-primary">
                    {section.config.link_label} {clients.length} →
                  </Link>
                </div>
              </section>
            );

          case "principles":
            return (
              <section key={section.id} className="grid gap-px bg-border md:grid-cols-4">
                {principles.map((principle, principleIndex) => (
                  <Reveal key={principle.title} delay={principleIndex * 0.04} className="bg-background p-8 md:p-10">
                    <p className="font-mono text-xs text-primary">{String(principleIndex + 1).padStart(2, "0")}</p>
                    <h3 className="mt-16 font-display text-3xl font-bold">{principle.title}</h3>
                    <p className="mt-3 text-muted-foreground">{principle.text}</p>
                  </Reveal>
                ))}
              </section>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
