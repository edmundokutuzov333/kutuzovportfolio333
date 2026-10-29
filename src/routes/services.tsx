import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { PageHero } from "@/components/Reveal";
import { loadServicesContent } from "@/lib/cms/loaders";
import { requireHeroSection } from "@/lib/cms/section-utils";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/services")({
  loader: () => loadServicesContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Services — Edmundo Kutuzov" }] },
  component: Services,
});

function Services() {
  const data = Route.useLoaderData();
  const hero = requireHeroSection(data.sections);
  const [open, setOpen] = useState<string | null>(data.services[0]?.slug ?? null);

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={hero.config.intro} />
      <section className="border-t border-border px-6 pb-32 md:px-12">
        {data.services.map((service) => {
          const isOpen = open === service.slug;
          return (
            <div key={service.slug} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : service.slug)}
                aria-expanded={isOpen}
                className="group flex w-full items-center gap-6 py-10 text-left"
              >
                <span className="font-mono text-xs text-primary">{service.n}</span>
                <span className="flex-1 font-display text-4xl font-bold transition-transform duration-500 group-hover:translate-x-3 md:text-7xl">{service.title}</span>
                <span className={`text-3xl transition-transform duration-500 ${isOpen ? "rotate-45 text-primary" : ""}`}>+</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-10 pb-12 md:grid-cols-2 md:pl-12">
                      <div>
                        <p className="font-display text-2xl">{service.line}</p>
                        <p className="mt-4 text-muted-foreground">{service.text}</p>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {service.deliverables.map((deliverable) => (
                          <li key={deliverable} className="rounded-sm border border-border p-4 text-sm">{deliverable}</li>
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
