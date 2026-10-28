import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { IntroClock } from "./IntroScene";

const Scene = lazy(() => import("./IntroScene"));

const SEEN_KEY = "ek-intro-seen";
export const REPLAY_EVENT = "ek:replay-intro";
const AUTO_MS = 3200; // auto-breach if the visitor doesn't act
const BREACH_MS = 1150; // must match IntroScene
const ease = [0.76, 0, 0.24, 1] as const;

type Phase = "idle" | "breach" | "flash" | "done";

export function Intro() {
  // Rendered on the server too, so the home page never flashes before the intro.
  const [phase, setPhase] = useState<Phase>("idle");
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const clock = useRef<IntroClock>({ breachAt: null });

  const breach = useCallback(() => {
    if (clock.current.breachAt !== null) return;
    clock.current.breachAt = performance.now();
    setPhase("breach");
    window.setTimeout(() => setPhase("flash"), BREACH_MS - 120);
    window.setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem(SEEN_KEY, "1");
    }, BREACH_MS + 80);
  }, []);

  // decide whether to play
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || sessionStorage.getItem(SEEN_KEY)) setPhase("done");
    else setMounted(true);
    const replay = () => {
      clock.current = { breachAt: null };
      setCount(0);
      setPhase("idle");
      setMounted(true);
      window.scrollTo(0, 0);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  // idle: triggers, counter, scroll lock
  useEffect(() => {
    if (phase !== "idle" || !mounted) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / AUTO_MS);
      setCount(Math.round(p * 100));
      if (p >= 1) breach();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const go = () => breach();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setPhase("done"); sessionStorage.setItem(SEEN_KEY, "1"); } else go(); };
    window.addEventListener("wheel", go, { passive: true });
    window.addEventListener("touchmove", go, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", go);
      window.removeEventListener("touchmove", go);
      window.removeEventListener("keydown", key);
    };
  }, [phase, mounted, breach]);

  useEffect(() => {
    if (phase === "done") document.documentElement.style.overflow = "";
  }, [phase]);

  const skip = () => { setPhase("done"); sessionStorage.setItem(SEEN_KEY, "1"); };
  const breaching = phase === "breach" || phase === "flash";

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[80] cursor-pointer overflow-hidden"
          onClick={breach}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          aria-label="Intro — click to enter"
          role="button"
        >
          {/* two halves of the abyss that split apart at the end */}
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 bg-background"
            animate={{ y: phase === "flash" ? "-100%" : 0 }}
            transition={{ duration: 0.45, ease }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-background"
            animate={{ y: phase === "flash" ? "100%" : 0 }}
            transition={{ duration: 0.45, ease }}
          />

          <motion.div
            className="absolute inset-0"
            animate={{ opacity: phase === "flash" ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* depth glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%)]" />

            {/* the slit */}
            <motion.div
              className="absolute left-1/2 top-0 h-full -translate-x-1/2"
              initial={{ width: 1, opacity: 0 }}
              animate={breaching ? { width: "120vw", opacity: [1, 1, 0] } : { width: [1, 2, 1], opacity: [0.6, 1, 0.6] }}
              transition={breaching ? { duration: 1.1, ease: [0.7, 0, 0.84, 0] } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="h-full w-full bg-[linear-gradient(180deg,transparent,var(--ice),var(--primary),var(--ice),transparent)] shadow-[0_0_40px_6px_color-mix(in_oklab,var(--primary)_70%,transparent)]" />
            </motion.div>

            {mounted && (
              <Suspense fallback={null}>
                <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                  <Scene clock={clock.current} />
                </motion.div>
              </Suspense>
            )}

            {/* telemetry */}
            <motion.div
              className="pointer-events-none absolute inset-0 font-mono text-[10px] uppercase tracking-[0.25em] text-ice/70 md:text-xs"
              animate={{ opacity: breaching ? 0 : 1, scale: breaching ? 1.15 : 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute left-6 top-6 space-y-1 md:left-12 md:top-8">
                <p className="text-foreground">Edmundo Kutuzov</p>
                <p>Art Director · Maputo</p>
              </div>
              <div className="absolute right-6 top-6 text-right md:right-12 md:top-8">
                <p>-25.9692 / 32.5732</p>
                <p>Depth {String(count).padStart(3, "0")}</p>
              </div>
              <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
                <p className="text-foreground">Click · Scroll · Any key</p>
                <p>to breach</p>
                <div className="mt-2 h-px w-40 bg-foreground/15">
                  <div className="h-px bg-ice" style={{ width: `${count}%` }} />
                </div>
              </div>
              <p className="absolute bottom-10 left-6 hidden md:left-12 md:block">© 2026</p>
            </motion.div>
          </motion.div>

          {/* impact flash */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--ice),var(--primary)_40%,transparent_75%)] mix-blend-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "flash" ? [0, 1, 0] : 0 }}
            transition={{ duration: 0.45, times: [0, 0.2, 1] }}
          />

          <button
            onClick={(e) => { e.stopPropagation(); skip(); }}
            className="absolute bottom-9 right-6 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground md:right-12 md:text-xs"
          >
            Skip →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
