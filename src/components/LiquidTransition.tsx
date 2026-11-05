import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * "Liquid Ink Drag": intercepts internal link clicks, floods the screen with deep-blue ink
 * from the click point (~0.35s), navigates, then recedes on the new page.
 * Liquid edge comes from an SVG turbulence displacement on a clip-path circle.
 */
export function LiquidTransition() {
  const router = useRouter();
  const layer = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = layer.current;
    if (!el || reduced) return;
    const turb = document.getElementById("ek-ink-turb");

    const animate = (from: number, to: number, x: number, y: number, ms: number) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const ease = (t: number) => 1 - Math.pow(1 - t, 3);
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / ms);
          const r = from + (to - from) * ease(t);
          el.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
          turb?.setAttribute("seed", String(Math.floor(now / 40) % 100));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

    const onClick = (event: MouseEvent) => {
      if (busy.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = (event.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/admin")) return;
      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname && !url.search) return;
      event.preventDefault();
      event.stopPropagation();
      busy.current = true;
      const x = event.clientX, y = event.clientY;
      const max = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 80;
      el.style.visibility = "visible";
      void animate(0, max, x, y, 350)
        .then(() => router.history.push(url.pathname + url.search + url.hash))
        .then(() => new Promise((r) => setTimeout(r, 60)))
        .then(() => animate(max, 0, innerWidth / 2, innerHeight / 2, 420))
        .finally(() => { el.style.visibility = "hidden"; busy.current = false; });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="ek-ink">
          <feTurbulence id="ek-ink-turb" type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="1" />
          <feDisplacementMap in="SourceGraphic" scale="70" />
        </filter>
      </svg>
      <div
        ref={layer}
        aria-hidden
        className="pointer-events-none fixed inset-[-60px] z-[85]"
        style={{ visibility: "hidden", clipPath: "circle(0px at 50% 50%)", filter: "url(#ek-ink)", background: "radial-gradient(circle at 50% 50%, var(--primary), var(--background) 75%)" }}
      />
    </>
  );
}
