import { useEffect, useRef } from "react";

/**
 * Decorative liquid-ink transition only. TanStack Router's <Link> retains
 * ownership of navigation: one tap/click immediately triggers the route.
 * Never capture, preventDefault or stopPropagation on application links.
 */
export function LiquidTransition() {
  const layer = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = layer.current;
    if (!el) return;
    const turbulence = document.getElementById("ek-ink-turb");

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank"
          || anchor.hasAttribute("data-native-document")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/admin")) return;
      const dest = new URL(href, window.location.href);
      const current = new URL(window.location.href);
      if (dest.pathname === current.pathname && dest.search === current.search) return;

      cancelAnimationFrame(frame.current);
      const x = event.clientX || innerWidth / 2;
      const y = event.clientY || innerHeight / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 80;
      const started = performance.now();
      el.style.visibility = "visible";
      const duration = 460;
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        const fill = t < .44
          ? 1 - Math.pow(1 - t / .44, 2)
          : Math.pow(1 - (t - .44) / .56, 2);
        el.style.clipPath = `circle(${radius * fill}px at ${x}px ${y}px)`;
        turbulence?.setAttribute("seed", String(Math.floor(now / 55) % 100));
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else {
          el.style.visibility = "hidden";
          el.style.clipPath = "circle(0px at 50% 50%)";
        }
      };
      frame.current = requestAnimationFrame(tick);
    };

    // Bubble-phase listener does not intercept React Router's Link handler.
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(frame.current);
      el.style.visibility = "hidden";
    };
  }, []);

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
        style={{
          visibility:"hidden",
          clipPath:"circle(0px at 50% 50%)",
          filter:"url(#ek-ink)",
          background:"radial-gradient(circle at 50% 50%, var(--primary), var(--background) 75%)"
        }}
      />
    </>
  );
}
