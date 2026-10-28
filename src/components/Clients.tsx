import { motion } from "framer-motion";
import { clients } from "@/lib/content";

type Client = (typeof clients)[number];

function Slot({ c }: { c: Client }) {
  return (
    <div className="group relative flex aspect-[3/2] items-center justify-center overflow-hidden border-r border-b border-border p-6">
      <span className="eyebrow absolute left-4 top-4">{String(c.id).padStart(2, "0")}</span>
      <div className="absolute inset-0 translate-y-full bg-primary transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0" />
      {c.logo ? (
        <img src={c.logo} alt={c.name} className="relative h-10 w-auto object-contain opacity-70 grayscale transition group-hover:opacity-100" />
      ) : (
        <span className="relative text-center font-display text-lg font-semibold leading-tight text-foreground/70 transition-colors duration-500 group-hover:text-primary-foreground md:text-xl">
          {c.name}
        </span>
      )}
    </div>
  );
}

export function ClientsGrid() {
  return (
    <div className="grid grid-cols-2 border-l border-t border-border md:grid-cols-4 lg:grid-cols-5">
      {clients.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: (i % 5) * 0.06 + Math.floor(i / 5) * 0.05 }}
        >
          <Slot c={c} />
        </motion.div>
      ))}
    </div>
  );
}

export function ClientsMarquee() {
  const rowA = clients.slice(0, 10);
  const rowB = clients.slice(10);
  const Row = ({ items, rev }: { items: Client[]; rev?: boolean }) => (
    <div className="flex overflow-hidden">
      <div className={`flex shrink-0 gap-4 pr-4 ${rev ? "animate-marquee-rev" : "animate-marquee"}`}>
        {[...items, ...items].map((c, i) => (
          <div key={i} className="flex h-20 shrink-0 items-center gap-3 rounded-full border border-border bg-card px-8">
            {c.logo ? (
              <img src={c.logo} alt={c.name} className="h-7 w-auto" />
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="whitespace-nowrap font-display text-lg font-semibold">{c.name}</span>
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
      <Row items={rowB} rev />
    </div>
  );
}
