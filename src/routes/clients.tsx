import { createFileRoute } from "@tanstack/react-router";

import { ClientsGrid, ClientsMarquee } from "@/components/Clients";
import { PageHero } from "@/components/Reveal";
import { loadClientsContent } from "@/lib/cms/loaders";
import { requireHeroSection } from "@/lib/cms/section-utils";
import { seoFromPage } from "@/lib/seo";

export const Route = createFileRoute("/clients")({
  loader: () => loadClientsContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Clients — Edmundo Kutuzov" }] },
  component: Clients,
});

function Clients() {
  const data = Route.useLoaderData();
  const hero = requireHeroSection(data.sections);

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={hero.config.intro} />
      <div className="pb-24"><ClientsMarquee clients={data.clients} /></div>
      <section className="px-6 pb-32 md:px-12"><ClientsGrid clients={data.clients} /></section>
    </>
  );
}
