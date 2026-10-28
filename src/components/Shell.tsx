import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { profile } from "@/lib/content";
import { LogoMark } from "./LogoMark";

const nav = [
  { to: "/", label: "Home" },
  { to: "/work", label: "Work" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/process", label: "Process" },
  { to: "/clients", label: "Clients" },
  { to: "/contact", label: "Contact" },
] as const;

function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const move = (e: MouseEvent) => {
      x = e.clientX; y = e.clientY;
      const el = (e.target as HTMLElement).closest("a,button,[data-cursor]") as HTMLElement | null;
      setHover(!!el);
      setLabel(el?.dataset["cursor"] ?? null);
    };
    const loop = () => {
      cx += (x - cx) * 0.35; cy += (y - cy) * 0.35;
      if (dot.current) dot.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move, { passive: true });
    loop();
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[70] hidden md:block">
      <div
        className={`flex items-center justify-center rounded-full bg-bone text-background mix-blend-difference transition-all duration-300 ${
          label ? "h-20 w-20" : hover ? "h-10 w-10" : "h-3 w-3"
        }`}
      >
        {label && <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>}
      </div>
    </div>
  );
}

function Header({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 mix-blend-difference md:px-12">
      <Link to="/" aria-label="Home" className="text-bone">
        <LogoMark className="h-6 w-auto" />
      </Link>
      <div className="eyebrow hidden text-bone md:block">Maputo · Available for projects</div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-bone"
        aria-expanded={open}
      >
        {open ? "Close" : "Menu"}
        <span className="relative block h-3 w-6">
          <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
        </span>
      </button>
    </header>
  );
}

function Menu({ close }: { close: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col justify-between bg-primary px-6 pb-10 pt-28 text-primary-foreground md:px-12"
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0% 0)" }}
      exit={{ clipPath: "inset(100% 0 0 0)" }}
      transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
    >
      <nav className="flex flex-col">
        {nav.map((n, i) => (
          <motion.div
            key={n.to}
            className="overflow-hidden"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={n.to}
              onClick={close}
              className="group flex items-baseline gap-4 font-display text-[11vw] font-bold leading-[0.95] md:text-[6.5vw]"
            >
              <span className="font-mono text-xs">0{i + 1}</span>
              <span className="transition-transform duration-500 group-hover:translate-x-6">{n.label}</span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="flex flex-wrap justify-between gap-6 font-mono text-xs uppercase tracking-widest">
        <a href={`mailto:${profile.email}`}>{profile.email}</a>
        <div className="flex gap-6">
          {profile.socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function Footer() {
  const [joined, setJoined] = useState(false);
  return (
    <footer className="border-t border-border px-6 pb-8 pt-24 md:px-12">
      <div className="grid gap-16 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-6">Next move</p>
          <Link to="/contact" data-cursor="Talk" className="font-display text-6xl font-bold leading-none hover:text-primary md:text-8xl">
            Let's talk.
          </Link>
          <p className="mt-6 max-w-sm text-muted-foreground">Let's build a visual presence impossible to ignore.</p>
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">Contact</p>
            <a className="block hover:text-primary" href={`mailto:${profile.email}`}>{profile.email}</a>
            <a className="block hover:text-primary" href={profile.whatsapp} target="_blank" rel="noreferrer">{profile.phone}</a>
            <p className="text-muted-foreground">{profile.location}</p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">Social</p>
            {profile.socials.map((s) => (
              <a key={s.label} className="block hover:text-primary" href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>
            ))}
          </div>
          <form
            className="col-span-2"
            onSubmit={(e) => { e.preventDefault(); setJoined(true); }}
          >
            <p className="eyebrow mb-4">Newsletter — new work & availability</p>
            {joined ? (
              <p className="text-primary">Thanks — you're on the list.</p>
            ) : (
              <div className="flex border-b border-foreground/40">
                <input required type="email" placeholder="your@email.com" className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground" />
                <button className="font-mono text-xs uppercase tracking-widest hover:text-primary">Join</button>
              </div>
            )}
          </form>
        </div>
      </div>
      <div className="mt-24 select-none overflow-hidden">
        <LogoMark className="w-full text-foreground/[0.06]" />
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-4 eyebrow">
        <span>© {new Date().getFullYear()} Edmundo Kutuzov</span>
        <span>Design is how it works.</span>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.14 });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="grain min-h-screen">
      <Cursor />
      <Header open={open} setOpen={setOpen} />
      <AnimatePresence>{open && <Menu close={() => setOpen(false)} />}</AnimatePresence>
      <motion.div
        key={pathname + "-curtain"}
        className="pointer-events-none fixed inset-0 z-[45] bg-[linear-gradient(180deg,var(--primary),var(--background))]"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        style={{ originY: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
