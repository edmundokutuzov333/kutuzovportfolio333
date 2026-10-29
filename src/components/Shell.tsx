import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getPublicPresentation, getPublishedRevision } from "@/lib/cms/queries";
import { DEFAULT_PUBLIC_PRESENTATION, type Profile, type PublicPresentation } from "@/lib/cms/types";
import { LogoMark } from "./LogoMark";
import { NewsletterSignup } from "./NewsletterSignup";
import { Intro, REPLAY_EVENT } from "./Intro";

function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const move = (event: MouseEvent) => {
      x = event.clientX;
      y = event.clientY;
      const element = (event.target as HTMLElement).closest("a,button,[data-cursor]") as HTMLElement | null;
      setHover(!!element);
      setLabel(element?.dataset["cursor"] ?? null);
    };
    const loop = () => {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      if (dot.current) dot.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move, { passive: true });
    loop();
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[90] hidden md:block">
      <div className={`flex items-center justify-center rounded-full bg-bone text-background mix-blend-difference transition-all duration-300 ${label ? "h-20 w-20" : hover ? "h-10 w-10" : "h-3 w-3"}`}>
        {label && <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>}
      </div>
    </div>
  );
}

function Header({ open, setOpen, presentation }: { open: boolean; setOpen: (value: boolean) => void; presentation: PublicPresentation["presentation"] }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 mix-blend-difference md:px-12">
      <Link to="/" aria-label="Home" className="text-bone"><LogoMark className="h-6 w-auto" /></Link>
      <div className="eyebrow hidden text-bone md:block">{presentation.availability_label}</div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-bone" aria-expanded={open}>
        {open ? presentation.close_menu_label : presentation.open_menu_label}
        <span className="relative block h-3 w-6">
          <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
        </span>
      </button>
    </header>
  );
}

function Menu({ close, profile, presentation }: { close: () => void; profile: Profile | null; presentation: PublicPresentation }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col justify-between bg-primary px-6 pb-10 pt-28 text-primary-foreground md:px-12"
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0% 0)" }}
      exit={{ clipPath: "inset(100% 0 0 0)" }}
      transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
    >
      <nav className="flex flex-col">
        {presentation.navigation.map((item, index) => (
          <motion.div key={item.to} className="overflow-hidden" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <Link to={item.to} onClick={close} className="group flex items-baseline gap-4 font-display text-[11vw] font-bold leading-[0.95] md:text-[6.5vw]">
              <span className="font-mono text-xs">0{index + 1}</span>
              <span className="transition-transform duration-500 group-hover:translate-x-6">{item.label}</span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="flex flex-wrap justify-between gap-6 font-mono text-xs uppercase tracking-widest">
        {profile?.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}
        <div className="flex gap-6">
          <button onClick={() => { close(); window.dispatchEvent(new Event(REPLAY_EVENT)); }} className="uppercase">Replay intro</button>
          {profile?.socials.map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noreferrer">{social.label}</a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function Footer({ profile, presentation }: { profile: Profile | null; presentation: PublicPresentation }) {
  const copy = presentation.footer;
  return (
    <footer className="border-t border-border px-6 pb-8 pt-24 md:px-12">
      <div className="grid gap-16 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-6">{copy.next_move_label}</p>
          <Link to={copy.cta_path} data-cursor="Talk" className="font-display text-6xl font-bold leading-none hover:text-primary md:text-8xl">{copy.cta_label}</Link>
          <p className="mt-6 max-w-sm text-muted-foreground">{copy.cta_description}</p>
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">{copy.contact_label}</p>
            {profile?.email && <a className="block hover:text-primary" href={`mailto:${profile.email}`}>{profile.email}</a>}
            {profile?.whatsapp && profile.phone && <a className="block hover:text-primary" href={profile.whatsapp} target="_blank" rel="noreferrer">{profile.phone}</a>}
            {profile?.location && <p className="text-muted-foreground">{profile.location}</p>}
          </div>
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">{copy.social_label}</p>
            {profile?.socials.map((social) => (
              <a key={social.label} className="block hover:text-primary" href={social.href} target="_blank" rel="noreferrer">{social.label} ↗</a>
            ))}
          </div>
          <div className="col-span-2" aria-label="Newsletter subscription">
            <p className="eyebrow mb-4">{copy.newsletter_label}</p>
            <NewsletterSignup />
          </div>
        </div>
      </div>
      <div className="mt-24 select-none overflow-hidden"><LogoMark className="w-full text-foreground/[0.06]" /></div>
      <div className="mt-6 flex flex-wrap justify-between gap-4 eyebrow">
        <span>© {new Date().getFullYear()} Edmundo Kutuzov</span>
        <span>{copy.signature}</span>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState<PublicPresentation>(DEFAULT_PUBLIC_PRESENTATION);
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const profile = useRouterState({
    select: (state): Profile | null => {
      for (let index = state.matches.length - 1; index >= 0; index -= 1) {
        const data = state.matches[index]?.loaderData as { profile?: Profile } | undefined;
        if (data?.profile) return data.profile;
      }
      return null;
    },
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.14 });
    let raf = 0;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    let active = true;
    const loadPresentation = async () => {
      try {
        const value = await getPublicPresentation();
        if (active) setPresentation(value);
      } catch {
        // Keep the last validated public copy while the settings endpoint is unavailable.
      }
    };
    void loadPresentation();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let previousRevision: number | null = null;
    let checking = false;
    let active = true;

    const checkRevision = async () => {
      if (!active || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const revision = await getPublishedRevision();
        if (previousRevision === null) {
          previousRevision = revision;
        } else if (revision !== previousRevision) {
          previousRevision = revision;
          await router.invalidate();
          const nextPresentation = await getPublicPresentation();
          if (active) setPresentation(nextPresentation);
        }
      } catch {
        // Public content stays unchanged while the publication endpoint is unavailable.
      } finally {
        checking = false;
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") void checkRevision(); };
    void checkRevision();
    const timer = window.setInterval(() => { void checkRevision(); }, 3000);
    window.addEventListener("focus", checkRevision);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkRevision);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return (
    <div className="grain min-h-screen">
      <Intro />
      <Cursor />
      <Header open={open} setOpen={setOpen} presentation={presentation.presentation} />
      <AnimatePresence>{open && <Menu close={() => setOpen(false)} profile={profile} presentation={presentation} />}</AnimatePresence>
      <motion.div key={pathname + "-curtain"} className="pointer-events-none fixed inset-0 z-[45] bg-[linear-gradient(180deg,var(--primary),var(--background))]" initial={{ scaleY: 1 }} animate={{ scaleY: 0 }} style={{ originY: 0 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} />
      <main>{children}</main>
      <Footer profile={profile} presentation={presentation} />
    </div>
  );
}
