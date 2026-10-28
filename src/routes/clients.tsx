import { createFileRoute } from "@tanstack/react-router";
import { ClientsGrid, ClientsMarquee } from "@/components/Clients";
import { PageHero } from "@/components/Reveal";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/clients")({
  head: () => seo("Clients", "A selection of local and international brands Edmundo Kutuzov has collaborated with."),
  component: Clients,
});

function Clients() {
  return (
    <>
      <PageHero
        eyebrow="Selected collaborations"
        lines={["Brands and", "teams."]}
        intro="A selection of local and international brands I have collaborated with as art director, graphic designer and creative lead."
      />
      <div className="pb-24"><ClientsMarquee /></div>
      <section className="px-6 pb-32 md:px-12"><ClientsGrid /></section>
    </>
  );
}
