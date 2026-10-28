import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { PageHero } from "@/components/Reveal";
import { process } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/process")({
  head: () => seo("Process", "The four-phase editorial method behind every project: discovery, direction, craft and rollout."),
  component: Process,
});

function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);
  return (
    <>
      <PageHero eyebrow="Process" lines={["From brief", "to rollout."]} intro="The working method proposed for each engagement — four phases, scaled to the project." />
      <div ref={ref} className="relative h-[400vh]">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <motion.div style={{ x }} className="flex w-[400vw]">
            {process.map((p) => (
              <div key={p.n} className="flex w-screen shrink-0 flex-col justify-center px-6 md:px-24">
                <span className="stroke-text font-display text-[30vw] font-bold leading-none md:text-[18vw]">{p.n}</span>
                <h2 className="font-display text-5xl font-bold md:text-7xl">{p.title}</h2>
                <p className="mt-6 max-w-lg text-xl text-muted-foreground">{p.text}</p>
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
