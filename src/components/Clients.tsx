import { motion } from "framer-motion";
import type { Client } from "@/lib/cms/types";
import { SafeAssetImage } from "./SafeAssetImage";
import { clientLogoUrl } from "@/lib/client-logos";

function Slot({ client }: { client: Client }) {
  const logo = clientLogoUrl(client.slug) ?? client.logo;
  return (
    <div className="group relative flex aspect-[3/2] items-center justify-center overflow-hidden border-r border-b border-border bg-background p-6 outline-none transition-colors duration-500 hover:bg-primary focus-within:bg-primary">
      <span className="eyebrow absolute left-4 top-4">{String(client.position + 1).padStart(2, "0")}</span>
      <div className="absolute inset-0 translate-y-full bg-primary transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0" />
      {logo ? (
        <SafeAssetImage
          src={logo}
          alt={client.logoAlt}
          className="relative max-h-12 w-auto max-w-[78%] object-contain opacity-75 grayscale transition duration-500 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0 group-focus-within:scale-105 group-focus-within:opacity-100 group-focus-within:grayscale-0"
          fallbackClassName="relative flex min-h-10 items-center justify-center"
          fallbackLabel={client.name}
        />
      ) : (
        <span className="relative text-center font-display text-lg font-semibold leading-tight text-foreground/70 transition-colors duration-500 group-hover:text-primary-foreground md:text-xl">
          {client.name}
        </span>
      )}
    </div>
  );
}

export function ClientsGrid({ clients }: { clients: Client[] }) {
  return (
    <div className="grid grid-cols-2 border-l border-t border-border md:grid-cols-4 lg:grid-cols-5">
      {clients.map((client, i) => (
        <motion.div
          key={client.slug}
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: (i % 5) * 0.03 + Math.floor(i / 5) * 0.02 }}
        >
          <Slot client={client} />
        </motion.div>
      ))}
    </div>
  );
}

export function ClientsMarquee({ clients }: { clients: Client[] }) {
  const rowA = clients.slice(0, Math.ceil(clients.length / 2));
  const rowB = clients.slice(Math.ceil(clients.length / 2));
  const Row = ({ items, reverse }: { items: Client[]; reverse?: boolean }) => (
    <div className="flex w-full min-w-0 max-w-full overflow-hidden">
      <div className={`flex shrink-0 gap-4 pr-4 ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}>
        {[...items, ...items].map((client, i) => (
          <div key={`${client.slug}-${i}`} className="flex h-20 shrink-0 items-center gap-3 rounded-full border border-border bg-card px-8">
            {(clientLogoUrl(client.slug) ?? client.logo) ? (
              <SafeAssetImage
                src={(clientLogoUrl(client.slug) ?? client.logo) as string}
                alt={client.logoAlt}
                className="max-h-8 w-auto max-w-[10rem] object-contain"
                fallbackClassName="flex items-center gap-2"
                fallbackLabel={client.name}
              />
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="whitespace-nowrap font-display text-lg font-semibold">{client.name}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="clients-marquee w-full min-w-0 max-w-full overflow-x-clip space-y-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <Row items={rowA} />
      {rowB.length > 0 && <Row items={rowB} reverse />}
    </div>
  );
}
