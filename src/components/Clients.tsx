import { motion } from "framer-motion";
import type { Client } from "@/lib/cms/types";
import { SafeAssetImage } from "./SafeAssetImage";

function Slot({ client }: { client: Client }) {
  return (
    <div className="group relative flex aspect-[3/2] items-center justify-center overflow-hidden border-r border-b border-border p-6">
      <span className="eyebrow absolute left-4 top-4">{String(client.position + 1).padStart(2, "0")}</span>
      <div className="absolute inset-0 translate-y-full bg-primary transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0" />
      {client.logo ? (
        <SafeAssetImage
          src={client.logo}
          alt={client.logoAlt}
          className="relative h-10 w-auto object-contain opacity-70 grayscale transition group-hover:opacity-100"
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
    <div className="flex overflow-hidden">
      <div className={`flex shrink-0 gap-4 pr-4 ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}>
        {[...items, ...items].map((client, i) => (
          <div key={`${client.slug}-${i}`} className="flex h-20 shrink-0 items-center gap-3 rounded-full border border-border bg-card px-8">
            {client.logo ? (
              <SafeAssetImage
                src={client.logo}
                alt={client.logoAlt}
                className="h-7 w-auto"
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
    <div className="space-y-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <Row items={rowA} />
      {rowB.length > 0 && <Row items={rowB} reverse />}
    </div>
  );
}
