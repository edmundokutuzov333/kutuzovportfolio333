import { useEffect, useId, useRef, useState } from "react";

import { LOGO_H, LOGO_W, logoPolygons } from "./logo-paths";

const GRID_UNIT = 32;
const MAJOR_GRID_UNIT = 160;
const SHAPE_NAMES = ["e", "k", "period"] as const;

function polygonToPath(points: readonly (readonly [number, number])[]): string {
  return `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
}

const blueprintShapes = logoPolygons.map((points, index) => ({
  name: SHAPE_NAMES[index] ?? `shape-${index}`,
  points,
  path: polygonToPath(points),
}));

const constructionNodes = blueprintShapes.flatMap((shape) =>
  shape.points.map(([x, y], index) => ({ x, y, key: `${shape.name}-${index}` })),
);

const horizontalMajorTicks = Array.from(
  { length: Math.floor(LOGO_W / MAJOR_GRID_UNIT) + 1 },
  (_, index) => index * MAJOR_GRID_UNIT,
);
const verticalMajorTicks = Array.from(
  { length: Math.floor(LOGO_H / MAJOR_GRID_UNIT) + 1 },
  (_, index) => index * MAJOR_GRID_UNIT,
);

export function EKBlueprint() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const reactId = useId().replace(/:/g, "");
  const minorGridId = `ek-blueprint-${reactId}-minor`;
  const majorGridId = `ek-blueprint-${reactId}-major`;
  const silhouetteId = `ek-blueprint-${reactId}-silhouette`;
  const revealId = `ek-blueprint-${reactId}-reveal`;
  const scanGradientId = `ek-blueprint-${reactId}-scan`;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    let observer: IntersectionObserver | null = null;
    let frame = 0;
    let active = true;

    const reveal = () => {
      if (!active) return;
      active = false;
      setIsVisible(true);
      observer?.disconnect();
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const checkVisibility = () => {
      if (!active || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!active) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.96 && bounds.bottom > 0) reveal();
      });
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      reveal();
      return () => {
        active = false;
        if (frame) window.cancelAnimationFrame(frame);
      };
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { threshold: 0.01, rootMargin: "0px" },
    );

    observer.observe(element);
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });
    checkVisibility();

    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`ek-blueprint${isVisible ? " is-visible" : ""}`}
      role="img"
      aria-label="The Edmundo Kutuzov EK monogram being constructed from a precise 32-unit technical grid"
      data-ek-blueprint
      data-grid-unit={GRID_UNIT}
      data-major-grid-unit={MAJOR_GRID_UNIT}
      data-animation-state={isVisible ? "visible" : "waiting"}
      data-vector-width={LOGO_W}
      data-vector-height={LOGO_H}
    >
      <svg
        viewBox="-52 -82 2024 979"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        data-blueprint-svg
      >
        <defs>
          <pattern
            id={minorGridId}
            data-grid-minor
            width={GRID_UNIT}
            height={GRID_UNIT}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M${GRID_UNIT} 0 H0 V${GRID_UNIT}`}
              fill="none"
              stroke="#8fb9eb"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>

          <pattern
            id={majorGridId}
            data-grid-major
            width={MAJOR_GRID_UNIT}
            height={MAJOR_GRID_UNIT}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M${MAJOR_GRID_UNIT} 0 H0 V${MAJOR_GRID_UNIT}`}
              fill="none"
              stroke="#b4d0f3"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>

          <clipPath id={silhouetteId} clipPathUnits="userSpaceOnUse">
            {blueprintShapes.map((shape) => (
              <path key={shape.name} d={shape.path} />
            ))}
          </clipPath>

          <clipPath id={revealId} clipPathUnits="userSpaceOnUse">
            <rect
              x="0"
              y="0"
              width="0"
              height={LOGO_H}
              className="ek-blueprint__reveal-window"
              data-grid-reveal
            />
          </clipPath>

          <linearGradient id={scanGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a8d3ff" stopOpacity="0" />
            <stop offset="45%" stopColor="#c7e3ff" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#e6f3ff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#c7e3ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#a8d3ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="ek-blueprint__field" aria-hidden="true">
          <rect
            x="0"
            y="0"
            width={LOGO_W}
            height={LOGO_H}
            fill={`url(#${minorGridId})`}
            className="ek-blueprint__field-minor"
          />
          <rect
            x="0"
            y="0"
            width={LOGO_W}
            height={LOGO_H}
            fill={`url(#${majorGridId})`}
            className="ek-blueprint__field-major"
          />
        </g>

        <g clipPath={`url(#${silhouetteId})`} className="ek-blueprint__silhouette">
          {blueprintShapes.map((shape) => (
            <path key={shape.name} d={shape.path} className="ek-blueprint__silhouette-fill" />
          ))}

          <g clipPath={`url(#${revealId})`} className="ek-blueprint__grid-formation">
            <rect
              x="0"
              y="0"
              width={LOGO_W}
              height={LOGO_H}
              fill={`url(#${minorGridId})`}
              className="ek-blueprint__inner-minor"
            />
            <rect
              x="0"
              y="0"
              width={LOGO_W}
              height={LOGO_H}
              fill={`url(#${majorGridId})`}
              className="ek-blueprint__inner-major"
            />
          </g>

          <rect
            x="-24"
            y="0"
            width="24"
            height={LOGO_H}
            fill={`url(#${scanGradientId})`}
            className="ek-blueprint__scan"
            data-blueprint-scan
          />
        </g>

        <g className="ek-blueprint__outlines">
          {blueprintShapes.map((shape) => (
            <path
              key={shape.name}
              d={shape.path}
              pathLength="1"
              className={`ek-blueprint__outline ek-blueprint__outline--${shape.name}`}
              data-outline-part={shape.name}
            />
          ))}
        </g>

        <g className="ek-blueprint__nodes">
          {constructionNodes.map((point, index) => (
            <g
              key={point.key}
              className="ek-blueprint__node"
              style={{ animationDelay: `${1.48 + index * 0.018}s` }}
              data-grid-node
            >
              <path
                d={`M${point.x - 11} ${point.y} h22 M${point.x} ${point.y - 11} v22`}
                className="ek-blueprint__node-cross"
              />
              <circle cx={point.x} cy={point.y} r="5.5" className="ek-blueprint__node-point" />
              <circle cx={point.x} cy={point.y} r="1.8" className="ek-blueprint__node-core" />
            </g>
          ))}
        </g>

        <g className="ek-blueprint__dimensions" aria-hidden="true">
          <path
            d={`M0 -24 H${LOGO_W} M0 ${LOGO_H + 24} H${LOGO_W} M-24 0 V${LOGO_H} M${LOGO_W + 24} 0 V${LOGO_H}`}
            className="ek-blueprint__dimension-frame"
          />

          {horizontalMajorTicks.map((x) => (
            <path
              key={`x-${x}`}
              d={`M${x} -24 v12 M${x} ${LOGO_H + 12} v12`}
              className="ek-blueprint__dimension-tick"
            />
          ))}

          {verticalMajorTicks.map((y) => (
            <path
              key={`y-${y}`}
              d={`M-24 ${y} h12 M${LOGO_W + 12} ${y} h12`}
              className="ek-blueprint__dimension-tick"
            />
          ))}

          <text x="0" y="-44" className="ek-blueprint__annotation">
            EK / VECTOR CONSTRUCTION
          </text>
          <text x={LOGO_W} y="-44" textAnchor="end" className="ek-blueprint__annotation">
            GRID 32U / MAJOR 160U
          </text>
          <text x="0" y={LOGO_H + 58} className="ek-blueprint__annotation">
            X 0000 — 1920
          </text>
          <text x={LOGO_W} y={LOGO_H + 58} textAnchor="end" className="ek-blueprint__annotation">
            VECTOR GEOMETRY / 1:1 UNIT SYSTEM
          </text>
        </g>
      </svg>
    </div>
  );
}
