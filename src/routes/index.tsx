import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Logo3D } from "@/components/Logo3D";
import { Reveal } from "@/components/Reveal";
import { ClientsMarquee } from "@/components/Clients";
import { ProjectCard } from "@/components/ProjectCard";
import { capabilities, metrics, principles, profile, projects, services } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Art Director, Maputo", "Edmundo Kutuzov — art director from Maputo building brand systems that stop, stay in memory and make people act."),
  component: Home,
});

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.75]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative h-[100svh] overflow-hidden">
      <motion.div style={{ scale, opacity }} className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--ember)_18%,transparent),transparent_60%)]" />
        <Logo3D className="absolute inset-0" />
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-6 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-12">
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 1 }}
          className="max-w-md font-display text-2xl font-semibold leading-tight md:text-3xl"
        >
          {profile.headline}
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="eyebrow space-y-1 md:text-right">
          <p>{profile.roles.join(" / ")}</p>
          <p>{profile.location}</p>
          <p className="text-primary">↓ Scroll</p>
        </motion.div>
      </div>
    </section>
  );
}

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 40%"] });
  const words = profile.intro.split(" ");
  return (
    <section className="px-6 py-32 md:px-12 md:py-48">
      <p className="eyebrow mb-10">(01) Manifesto</p>
      <div ref={ref} className="max-w-6xl font-display text-3xl font-semibold leading-[1.15] md:text-6xl">
        {words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>
        ))}
      </div>
    </section>
  );
}

function Word({ children, progress, range }: { children: string; progress: ReturnType<typeof useScroll>["scrollYProgress"]; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return <motion.span style={{ opacity }} className="mr-[0.25em] inline-block">{children}</motion.span>;
}

function BigMarquee() {
  const items = [...capabilities, ...capabilities];
  return (
    <div className="overflow-hidden border-y border-border py-8">
      <div className="flex w-max animate-marquee gap-12">
        {items.map((c, i) => (
          <span key={i} className={`whitespace-nowrap font-display text-6xl font-bold md:text-8xl ${i % 2 ? "stroke-text" : ""}`}>
            {c} <span className="text-primary">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <Manifesto />
      <BigMarquee />

      <section className="px-6 py-32 md:px-12">
        <div className="mb-16 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">(02) Selected work</p>
            <h2 className="font-display text-5xl font-bold md:text-7xl">Work that refuses<br />to be ignored.</h2>
          </div>
          <Link to="/work" className="eyebrow hidden hover:text-primary md:block">All projects →</Link>
        </div>
        <div className="grid gap-x-8 gap-y-20 md:grid-cols-2">
          {projects.slice(0, 4).map((p, i) => (
            <Reveal key={p.slug} delay={(i % 2) * 0.15} className={i % 2 ? "md:mt-40" : ""}>
              <ProjectCard project={p} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-6 py-32 md:px-12">
        <p className="eyebrow mb-10">(03) Visual capabilities & disciplines</p>
        <div className="border-t border-border">
          {services.map((s) => (
            <Link key={s.slug} to="/services" className="group flex items-center justify-between gap-6 border-b border-border py-8 transition-colors hover:bg-primary hover:text-primary-foreground md:px-6">
              <span className="font-mono text-xs">{s.n}</span>
              <span className="flex-1 font-display text-3xl font-semibold transition-transform duration-500 group-hover:translate-x-4 md:text-5xl">{s.title}</span>
              <span className="hidden max-w-xs text-sm opacity-70 md:block">{s.line}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-5">
        {metrics.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.08} className="bg-background px-6 py-16">
            <p className="font-display text-6xl font-bold text-primary">{m.value}</p>
            <p className="mt-2 font-display text-xl font-semibold">{m.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{m.note}</p>
          </Reveal>
        ))}
      </section>

      <section className="py-32">
        <div className="mb-14 px-6 md:px-12">
          <p className="eyebrow mb-4">(04) Clients</p>
          <h2 className="font-display text-5xl font-bold md:text-7xl">Brands and teams<br />I have worked with.</h2>
        </div>
        <ClientsMarquee />
        <div className="mt-10 px-6 md:px-12">
          <Link to="/clients" className="eyebrow hover:text-primary">See all 20 →</Link>
        </div>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-4">
        {principles.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08} className="bg-background p-8 md:p-10">
            <p className="font-mono text-xs text-primary">0{i + 1}</p>
            <h3 className="mt-16 font-display text-3xl font-bold">{p.title}</h3>
            <p className="mt-3 text-muted-foreground">{p.text}</p>
          </Reveal>
        ))}
      </section>
    </>
  );
}
