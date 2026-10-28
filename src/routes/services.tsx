import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { PageHero } from "@/components/Reveal";
import { services } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/services")({
  head: () => seo("Services", "Visual identity, art direction, editorial & print, digital design and AI creative direction."),
  component: Services,
});

function Services() {
  const [open, setOpen] = useState<string | null>(services[0].slug);
  return (
    <>
      <PageHero eyebrow="Services" lines={["Visual capabilities", "& disciplines."]} intro="Five practices, one system. Each engagement is built around what the brand needs to be remembered for." />
      <section className="border-t border-border px-6 pb-32 md:px-12">
        {services.map((s) => {
          const isOpen = open === s.slug;
          return (
            <div key={s.slug} className="border-b border-border">
              <button onClick={() => setOpen(isOpen ? null : s.slug)} className="group flex w-full items-center gap-6 py-10 text-left">
                <span className="font-mono text-xs text-primary">{s.n}</span>
                <span className="flex-1 font-display text-4xl font-bold transition-transform duration-500 group-hover:translate-x-3 md:text-7xl">{s.title}</span>
                <span className={`text-3xl transition-transform duration-500 ${isOpen ? "rotate-45 text-primary" : ""}`}>+</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <div className="grid gap-10 pb-12 md:grid-cols-2 md:pl-12">
                      <div>
                        <p className="font-display text-2xl">{s.line}</p>
                        <p className="mt-4 text-muted-foreground">{s.text}</p>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {s.deliverables.map((d) => (
                          <li key={d} className="rounded-sm border border-border p-4 text-sm">{d}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </section>
    </>
  );
}
