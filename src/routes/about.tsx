import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { PageHero, Reveal } from "@/components/Reveal";
import { disciplines, experience, metrics, principles, profile, skills } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => seo("About & Credentials", "Career, metrics, skills and principles of art director Edmundo Kutuzov."),
  component: About,
});

function About() {
  return (
    <>
      <PageHero eyebrow="About · Credentials" lines={["Strategy, craft", "and a sharp", "point of view."]} intro={profile.intro} />

      <section className="grid gap-12 px-6 py-24 md:grid-cols-[1fr_2fr] md:px-12">
        <div className="aspect-[3/4] rounded-sm bg-card">
          <div className="flex h-full items-end p-4"><span className="eyebrow">Portrait slot</span></div>
        </div>
        <Reveal className="space-y-6 text-xl leading-relaxed">
          <p>Based in the Mozambican creative ecosystem, I combine strategy, visual identity, campaign direction, communication systems, typography, digital content, motion and AI tools into one practice.</p>
          <p className="text-muted-foreground">On-site in Maputo and remote worldwide, available for international projects. Agency and corporate experience across identity, advertising, digital content, institutional communication and print.</p>
        </Reveal>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="bg-background px-6 py-14">
            <p className="font-display text-5xl font-bold text-primary">{m.value}</p>
            <p className="mt-2 font-semibold">{m.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>
          </div>
        ))}
      </section>

      <section className="px-6 py-32 md:px-12">
        <p className="eyebrow mb-10">Career</p>
        {experience.map((e, i) => (
          <Reveal key={e.company} delay={i * 0.05}>
            <div className="grid gap-4 border-t border-border py-10 md:grid-cols-[1fr_2fr_1fr]">
              <p className="font-mono text-sm text-primary">{e.period}</p>
              <div>
                <h3 className="font-display text-3xl font-bold">{e.company}</h3>
                <p className="mt-3 max-w-xl text-muted-foreground">{e.text}</p>
              </div>
              <p className="eyebrow md:text-right">{e.role}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="grid gap-16 px-6 pb-32 md:grid-cols-2 md:px-12">
        <div>
          <p className="eyebrow mb-10">Tools & mastery</p>
          <div className="space-y-8">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="mb-2 flex justify-between"><span className="font-display text-lg">{s.name}</span><span className="font-mono text-xs">{s.tier} · {s.value}%</span></div>
                <div className="h-px bg-border">
                  <motion.div className="h-px bg-primary" initial={{ width: 0 }} whileInView={{ width: `${s.value}%` }} viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-10 sm:grid-cols-2">
          {disciplines.map((d) => (
            <div key={d.group}>
              <p className="eyebrow mb-4 text-primary">{d.group}</p>
              <ul className="space-y-2">{d.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-px bg-border md:grid-cols-4">
        {principles.map((p, i) => (
          <div key={p.title} className="bg-background p-10">
            <p className="font-mono text-xs text-primary">0{i + 1}</p>
            <h3 className="mt-12 font-display text-3xl font-bold">{p.title}</h3>
            <p className="mt-3 text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
