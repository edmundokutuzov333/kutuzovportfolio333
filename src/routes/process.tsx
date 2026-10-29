import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { PageHero } from "@/components/Reveal";
import { loadProcessContent } from "@/lib/cms/loaders";
import { requireHeroSection } from "@/lib/cms/section-utils";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/process")({
  loader: () => loadProcessContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Process — Edmundo Kutuzov" }] },
  component: Process,
});

function Process() {
  const data = Route.useLoaderData();
  const hero = requireHeroSection(data.sections);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={hero.config.intro ?? ""} />
      <div ref={ref} className="relative h-[400vh]">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <motion.div style={{ x }} className="flex w-[400vw]">
            {data.process.map((step) => (
              <div key={step.n} className="flex w-screen shrink-0 flex-col justify-center px-6 md:px-24">
                <span className="stroke-text font-display text-[30vw] font-bold leading-none md:text-[18vw]">{step.n}</span>
                <h2 className="font-display text-5xl font-bold md:text-7xl">{step.title}</h2>
                <p className="mt-6 max-w-lg text-xl text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </motion.div>
          <div className="absolute bottom-10 left-6 right-6 h-px bg-border md:left-24 md:right-24">
            <motion.div className="h-px origin-left bg-primary" style={{ scaleX: scrollYProgress }} />
          </div>
        </div>
      </div>
    </>
  );
}
