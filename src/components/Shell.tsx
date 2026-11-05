import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getPublicPresentation, getPublishedRevision } from "@/lib/cms/queries";
import { DEFAULT_PUBLIC_PRESENTATION, type Profile, type PublicPresentation } from "@/lib/cms/types";
import { EKBlueprint } from "./EKBlueprint";
import { LogoMark } from "./LogoMark";
import { NewsletterSignup } from "./NewsletterSignup";
import { Intro, REPLAY_EVENT } from "./Intro";
import { JarvisLauncher, JarvisTrigger } from "./JarvisLauncher";
import { LiquidTransition } from "./LiquidTransition";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const lens = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [lensOn, setLensOn] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const move = (event: MouseEvent) => {
      x = event.clientX;
      y = event.clientY;
      const target = event.target as HTMLElement;
      const element = target.closest("a,button,[data-cursor]") as HTMLElement | null;
      setHover(!!element);
      setLabel(element?.dataset["cursor"] ?? null);
      setLensOn(!element && !!target.closest("img,video,h1,h2,h3,h4,p,.font-display"));
    };
    const loop = () => {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      if (dot.current) dot.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      if (lens.current) lens.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
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
    <>
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="ek-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage result="map" preserveAspectRatio="none" href="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3CradialGradient id='g'%3E%3Cstop offset='0' stop-color='%23808080'/%3E%3Cstop offset='1' stop-color='%23ff00ff'/%3E%3C/radialGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="B" result="d" />
        <feColorMatrix in="d" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r" />
        <feOffset in="r" dx="2" result="ro" />
        <feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb" />
        <feOffset in="gb" dx="-1" result="gbo" />
        <feBlend in="ro" in2="gbo" mode="screen" />
      </filter>
    </svg>
    <div
      ref={lens}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[89] hidden h-32 w-32 rounded-full md:block"
      style={{
        opacity: lensOn ? 1 : 0,
        scale: lensOn ? "1" : "0.4",
        transition: "opacity .15s ease, scale .15s ease",
        backdropFilter: "url(#ek-lens) saturate(1.25) brightness(1.08)",
        WebkitBackdropFilter: "saturate(1.25) brightness(1.08)",
        boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--primary) 55%, transparent), inset 0 0 24px color-mix(in oklab, var(--primary) 35%, transparent)",
      }}
    />
    <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[90] hidden md:block">
      <div className={`flex items-center justify-center rounded-full bg-bone text-background mix-blend-difference transition-all duration-300 ${label ? "h-20 w-20" : hover ? "h-10 w-10" : "h-3 w-3"}`}>
        {label && <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>}
      </div>
    </div>
    </>
  );
}

function Header({ open, setOpen, presentation }: { open: boolean; setOpen: (value: boolean) => void; presentation: PublicPresentation["presentation"] }) {
  const { t } = useI18n();
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 text-bone md:px-12">
      <Link to="/" aria-label="Home" className="text-bone"><LogoMark className="h-6 w-auto" /></Link>
      <div className="hidden items-center gap-4 md:flex"><div className="eyebrow text-bone">{presentation.availability_label || t("available")}</div><LanguageSwitcher /></div>
      <div className="flex items-center gap-2">
        <JarvisTrigger className="liquid-glass-button hidden rounded-full px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone sm:inline-flex" />
        <div className="md:hidden"><LanguageSwitcher /></div>
        <button onClick={() => setOpen(!open)} className="liquid-glass-button flex items-center gap-3 rounded-full px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone" aria-expanded={open}>
          {open ? t("close") : t("menu")}
          <span className="relative block h-3 w-6">
            <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-6 bg-bone transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>
    </header>
  );
}

function Menu({ close, profile, presentation }: { close: () => void; profile: Profile | null; presentation: PublicPresentation }) {
  const { t } = useI18n();
  const navLabel = (to: string, fallback: string) => ({ "/": t("home"), "/work": t("work"), "/about": t("about"), "/services": t("services"), "/process": t("process"), "/clients": t("clients"), "/contact": t("contact") }[to] ?? fallback);
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
              <span className="transition-transform duration-500 group-hover:translate-x-6">{navLabel(item.to, item.label)}</span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="flex flex-wrap justify-between gap-6 font-mono text-xs uppercase tracking-widest">
        {profile?.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}
        <div className="flex gap-6">
          <span onClick={close}><JarvisTrigger className="liquid-glass-button rounded-full px-4 py-2 uppercase" label="JARVIS (IA)" /></span>
          <button onClick={() => { close(); window.dispatchEvent(new Event(REPLAY_EVENT)); }} className="liquid-glass-button rounded-full px-4 py-2 uppercase">{t("replay")}</button>
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
  const { t, tx } = useI18n();
  return (
    <footer className="border-t border-border px-6 pb-8 pt-24 md:px-12">
      <div className="grid gap-16 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-6">{tx(copy.next_move_label) || t("talk")}</p>
          <Link to={copy.cta_path} data-cursor="Talk" className="font-display text-6xl font-bold leading-none hover:text-primary md:text-8xl">{tx(copy.cta_label)}</Link>
          <p className="mt-6 max-w-sm text-muted-foreground">{tx(copy.cta_description)}</p>
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">{tx(copy.contact_label) || t("contact")}</p>
            {profile?.email && <a className="block hover:text-primary" href={`mailto:${profile.email}`}>{profile.email}</a>}
            {profile?.whatsapp && profile.phone && <a className="block hover:text-primary" href={profile.whatsapp} target="_blank" rel="noreferrer">{profile.phone}</a>}
            {profile?.location && <p className="text-muted-foreground">{profile.location}</p>}
            <JarvisTrigger className="pt-2 font-mono text-[10px] uppercase tracking-[0.2em] hover:text-primary" label="Falar com JARVIS (IA) →" />
          </div>
          <div className="space-y-3 text-sm">
            <p className="eyebrow mb-4">{tx(copy.social_label) || "Social"}</p>
            {profile?.socials.map((social) => (
              <a key={social.label} className="block hover:text-primary" href={social.href} target="_blank" rel="noreferrer">{social.label} ↗</a>
            ))}
          </div>
          <div className="col-span-2" aria-label="Newsletter subscription">
            <p className="eyebrow mb-4">{tx(copy.newsletter_label) || t("newsletter")}</p>
            <NewsletterSignup />
          </div>
        </div>
      </div>
      <div className="mt-14 overflow-hidden md:mt-20"><EKBlueprint /></div>
      <div className="mt-6 flex flex-wrap justify-between gap-4 eyebrow">
        <span>© {new Date().getFullYear()} Edmundo Kutuzov</span>
        <span>{tx(copy.signature)}</span>
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
      <LiquidTransition />
      <main>{children}</main>
      <Footer profile={profile} presentation={presentation} />
      <JarvisLauncher whatsapp={profile?.whatsapp} />
    </div>
  );
}
