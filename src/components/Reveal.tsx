import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -5% 0px" }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Line-by-line masked headline reveal. */
export function SplitHeading({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h1 className={className}>
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function PageHero({ eyebrow, lines, intro }: { eyebrow: string; lines: string[]; intro?: string }) {
  const { tx } = useI18n();
  return (
    <section className="px-6 pb-16 pt-40 md:px-12 md:pt-48">
      <p className="eyebrow mb-8">{tx(eyebrow)}</p>
      <SplitHeading lines={lines.map(tx)} className="max-w-[12ch] font-display text-[clamp(3.5rem,8.5vw,9rem)] font-bold leading-[0.88] tracking-tight" />
      {intro && (
        <Reveal delay={0.15} className="mt-10 max-w-xl text-lg text-muted-foreground">
          <p>{tx(intro)}</p>
        </Reveal>
      )}
    </section>
  );
}
