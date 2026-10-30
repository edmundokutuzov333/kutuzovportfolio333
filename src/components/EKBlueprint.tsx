import { useEffect, useId, useRef, useState } from "react";

import { LOGO_H, LOGO_W, logoPolygons } from "./logo-paths";

const LOOP_DURATION = 15_000;
const SHAPE_NAMES = ["e", "k", "period"] as const;
const VIEWBOX = { left: -180, top: -160, right: LOGO_W + 180, bottom: LOGO_H + 160 };

type Point = readonly [number, number];
type Segment = {
  index: number;
  shape: string;
  from: Point;
  to: Point;
};
type GuideLine = {
  axis: "x" | "y";
  value: number;
  d: string;
};

function polygonToPath(points: readonly Point[]): string {
  return `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
}

function uniqueCoordinates(points: readonly Point[], axis: 0 | 1): number[] {
  return [...new Set(points.map((point) => point[axis]))].sort((a, b) => a - b);
}

function buildSegments(): Segment[] {
  return logoPolygons.flatMap((points, shapeIndex) =>
    points.map((from, pointIndex) => ({
      index: logoPolygons
        .slice(0, shapeIndex)
        .reduce((total, shape) => total + shape.length, 0) + pointIndex,
      shape: SHAPE_NAMES[shapeIndex] ?? `shape-${shapeIndex}`,
      from,
      to: points[(pointIndex + 1) % points.length] ?? from,
    })),
  );
}

function buildDiagonalGuides(segments: readonly Segment[]) {
  const placements: { angle: number; normalOffset: number }[] = [];
  const guides: { d: string; index: number }[] = [];

  for (const segment of segments) {
    const [x1, y1] = segment.from;
    const [x2, y2] = segment.to;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 120 || Math.abs(dx) < 1 || Math.abs(dy) < 1) continue;

    let angle = Math.atan2(dy, dx) % Math.PI;
    if (angle < 0) angle += Math.PI;

    // Parallel guides are distinct when their perpendicular offsets differ.
    // Only collapse coincident lines, never an entire family of construction axes.
    const normalOffset = -Math.sin(angle) * x1 + Math.cos(angle) * y1;
    const duplicate = placements.some((known) => {
      const rawAngleDifference = Math.abs(known.angle - angle);
      const angleDifference = Math.min(rawAngleDifference, Math.PI - rawAngleDifference);
      return angleDifference < 0.025 && Math.abs(known.normalOffset - normalOffset) < 24;
    });
    if (duplicate) continue;
    placements.push({ angle, normalOffset });

    const ux = dx / length;
    const uy = dy / length;
    const extension = 260;
    guides.push({
      index: guides.length,
      d: `M${x1 - ux * extension} ${y1 - uy * extension} L${x2 + ux * extension} ${y2 + uy * extension}`,
    });
  }

  return guides;
}

const allPoints = logoPolygons.flat();
const verticalAxes = uniqueCoordinates(allPoints, 0).map((value): GuideLine => ({
  axis: "x",
  value,
  d: `M${value} ${VIEWBOX.top} V${VIEWBOX.bottom}`,
}));
const horizontalAxes = uniqueCoordinates(allPoints, 1).map((value): GuideLine => ({
  axis: "y",
  value,
  d: `M${VIEWBOX.left} ${value} H${VIEWBOX.right}`,
}));
const constructionGuides = [...verticalAxes, ...horizontalAxes];
const constructionSegments = buildSegments();
const diagonalGuides = buildDiagonalGuides(constructionSegments);
const totalContourLength = constructionSegments.reduce(
  (total, segment) => total + Math.hypot(
    segment.to[0] - segment.from[0],
    segment.to[1] - segment.from[1],
  ),
  0,
);
const segmentSchedule = (() => {
  let traversedLength = 0;
  return constructionSegments.map((segment) => {
    const length = Math.hypot(
      segment.to[0] - segment.from[0],
      segment.to[1] - segment.from[1],
    );
    const start = 0.355 + (traversedLength / totalContourLength) * 0.4;
    traversedLength += length;
    const end = 0.355 + (traversedLength / totalContourLength) * 0.4;
    return { start, end, length };
  });
})();
const blueprintShapes = logoPolygons.map((points, index) => ({
  name: SHAPE_NAMES[index] ?? `shape-${index}`,
  path: polygonToPath(points),
}));
const constructionPoints = logoPolygons.flatMap((points, shapeIndex) =>
  points.map(([x, y], pointIndex) => ({
    x,
    y,
    index: logoPolygons
      .slice(0, shapeIndex)
      .reduce((total, shape) => total + shape.length, 0) + pointIndex,
  })),
);

function sequencedFrames(start: number, end: number) {
  return [
    { strokeDashoffset: 1, offset: 0 },
    { strokeDashoffset: 1, offset: start },
    { strokeDashoffset: 0, offset: end },
    { strokeDashoffset: 0, offset: 0.985 },
    { strokeDashoffset: 1, offset: 1 },
  ];
}

function pointFrames(start: number) {
  return [
    { opacity: 0, transform: "scale(0.2)", offset: 0 },
    { opacity: 0, transform: "scale(0.2)", offset: start },
    { opacity: 1, transform: "scale(1.2)", offset: Math.min(start + 0.006, 0.84) },
    { opacity: 0.28, transform: "scale(1)", offset: 0.86 },
    { opacity: 0.28, transform: "scale(1)", offset: 0.985 },
    { opacity: 0, transform: "scale(0.2)", offset: 1 },
  ];
}

function animateElement(
  element: SVGElement | null,
  keyframes: Keyframe[],
  animations: Animation[],
) {
  if (!element) return;
  const animation = element.animate(keyframes, {
    duration: LOOP_DURATION,
    iterations: Number.POSITIVE_INFINITY,
    easing: "linear",
    fill: "both",
  });
  animations.push(animation);
}

export function EKBlueprint() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [animationState, setAnimationState] = useState<"waiting" | "looping" | "paused" | "static">("waiting");
  const reactId = useId().replace(/:/g, "");
  const hatchId = `ek-blueprint-${reactId}-hatch`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    let observer: IntersectionObserver | null = null;
    let isInViewport = false;
    let destroyed = false;

    const cancelAnimations = () => {
      animations.forEach((animation) => animation.cancel());
      animations.length = 0;
    };

    const setStatic = () => {
      cancelAnimations();
      root.classList.remove("is-looping", "is-paused");
      root.classList.add("is-static");
      setAnimationState("static");
    };

    const pauseLoop = () => {
      animations.forEach((animation) => animation.pause());
      root.classList.remove("is-looping");
      root.classList.add("is-paused");
      setAnimationState("paused");
    };

    const playLoop = () => {
      if (destroyed || !isInViewport || document.visibilityState === "hidden") return;
      if (motionPreference.matches) {
        setStatic();
        return;
      }

      if (typeof SVGElement.prototype.animate !== "function") {
        setStatic();
        return;
      }

      if (animations.length === 0) {
        root.classList.remove("is-static", "is-paused");
        root.classList.add("is-looping");

        const axisGuides = [...root.querySelectorAll<SVGPathElement>("[data-alignment-guide]")];
        axisGuides.forEach((element, index) => {
          const start = 0.025 + (index / Math.max(1, axisGuides.length)) * 0.19;
          animateElement(element, sequencedFrames(start, start + 0.027), animations);
        });

        const diagonalElements = [...root.querySelectorAll<SVGPathElement>("[data-diagonal-guide]")];
        diagonalElements.forEach((element, index) => {
          const start = 0.22 + (index / Math.max(1, diagonalElements.length)) * 0.105;
          animateElement(element, sequencedFrames(start, start + 0.024), animations);
        });

        constructionSegments.forEach((segment, index) => {
          const schedule = segmentSchedule[index];
          const path = root.querySelector<SVGPathElement>(`[data-monogram-segment="${index}"]`);
          animateElement(path, sequencedFrames(schedule.start, schedule.end), animations);
        });

        constructionPoints.forEach((point) => {
          const schedule = segmentSchedule[point.index];
          const marker = root.querySelector<SVGGElement>(`[data-construction-point="${point.index}"]`);
          animateElement(marker, pointFrames(schedule.start), animations);
        });

        root.querySelectorAll<SVGPathElement>("[data-monogram-fill]").forEach((element) => {
          animateElement(
            element,
            [
              { opacity: 0, offset: 0 },
              { opacity: 0, offset: 0.7 },
              { opacity: 0.1, offset: 0.79 },
              { opacity: 0.035, offset: 0.91 },
              { opacity: 0, offset: 1 },
            ],
            animations,
          );
        });

        root.querySelectorAll<SVGRectElement>("[data-hatch]").forEach((element, index) => {
          const start = 0.15 + index * 0.012;
          animateElement(
            element,
            [
              { opacity: 0.12, offset: 0 },
              { opacity: 0.12, offset: start },
              { opacity: 0.78, offset: Math.min(start + 0.06, 0.8) },
              { opacity: 0.24, offset: 0.87 },
              { opacity: 0.12, offset: 1 },
            ],
            animations,
          );
        });
      } else {
        animations.forEach((animation) => animation.play());
      }

      root.classList.remove("is-paused");
      root.classList.add("is-looping");
      setAnimationState("looping");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseLoop();
      else if (isInViewport) playLoop();
    };

    const onMotionPreferenceChange = () => {
      if (motionPreference.matches) setStatic();
      else if (isInViewport) playLoop();
      else {
        root.classList.remove("is-static");
        setAnimationState("waiting");
      }
    };

    if (motionPreference.matches) {
      setStatic();
    } else if (typeof IntersectionObserver === "undefined") {
      isInViewport = true;
      playLoop();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          isInViewport = entries.some((entry) => entry.isIntersecting);
          if (isInViewport) playLoop();
          else if (animations.length > 0) pauseLoop();
        },
        { threshold: 0.025, rootMargin: "80px 0px" },
      );
      observer.observe(root);
    }

    motionPreference.addEventListener("change", onMotionPreferenceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      destroyed = true;
      observer?.disconnect();
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelAnimations();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`ek-blueprint ${animationState === "static" ? "is-static" : ""}`}
      role="img"
      aria-label="Technical construction drawing of the Edmundo Kutuzov monogram, continuously traced point by point with geometric alignment guides"
      data-ek-blueprint
      data-animation-state={animationState}
      data-vector-width={LOGO_W}
      data-vector-height={LOGO_H}
      data-guide-count={constructionGuides.length}
      data-diagonal-guide-count={diagonalGuides.length}
      data-segment-count={constructionSegments.length}
    >
      <svg
        viewBox="-180 -160 2280 1135"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        data-blueprint-svg
      >
        <defs>
          <pattern
            id={hatchId}
            data-hatch-pattern
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(42)"
          >
            <path d="M0 0 V8" fill="none" stroke="#a8c6ed" strokeWidth="2.4" />
          </pattern>
        </defs>

        <g className="ek-blueprint__alignment-grid" data-alignment-grid>
          {constructionGuides.map((guide) => (
            <path
              key={`${guide.axis}-${guide.value}`}
              d={guide.d}
              pathLength="1"
              className={`ek-blueprint__guide ek-blueprint__guide--${guide.axis}`}
              data-alignment-guide
              data-guide-axis={guide.axis}
              data-guide-value={guide.value}
            />
          ))}
        </g>

        <g className="ek-blueprint__diagonal-grid" data-diagonal-grid>
          {diagonalGuides.map((guide) => (
            <path
              key={guide.index}
              d={guide.d}
              pathLength="1"
              className="ek-blueprint__guide ek-blueprint__guide--diagonal"
              data-diagonal-guide
              data-guide-index={guide.index}
            />
          ))}
        </g>

        <g className="ek-blueprint__hatches" data-hatch-group>
          {[0, 182, 318, 497, 632, LOGO_H].map((y) => (
            <g key={`hatch-y-${y}`}>
              <rect x="-148" y={y - 8} width="38" height="16" fill={`url(#${hatchId})`} data-hatch />
              <rect x={LOGO_W + 110} y={y - 8} width="38" height="16" fill={`url(#${hatchId})`} data-hatch />
            </g>
          ))}
          {[145, 925, 1278].map((x) => (
            <g key={`hatch-x-${x}`}>
              <rect x={x - 8} y="-146" width="16" height="38" fill={`url(#${hatchId})`} data-hatch />
              <rect x={x - 8} y={LOGO_H + 108} width="16" height="38" fill={`url(#${hatchId})`} data-hatch />
            </g>
          ))}
        </g>

        <g className="ek-blueprint__monogram-fill">
          {blueprintShapes.map((shape) => (
            <path
              key={shape.name}
              d={shape.path}
              className="ek-blueprint__fill"
              data-monogram-fill
            />
          ))}
        </g>

        <g className="ek-blueprint__point-drawing" data-point-drawing>
          {constructionSegments.map((segment) => (
            <path
              key={segment.index}
              d={`M${segment.from[0]} ${segment.from[1]} L${segment.to[0]} ${segment.to[1]}`}
              pathLength="1"
              className={`ek-blueprint__segment ek-blueprint__segment--${segment.shape}`}
              data-monogram-segment={segment.index}
              data-segment-shape={segment.shape}
              data-segment-from={segment.from.join(",")}
              data-segment-to={segment.to.join(",")}
              data-segment-length={segmentSchedule[segment.index]?.length ?? 0}
            />
          ))}
        </g>

        <g className="ek-blueprint__construction-points" data-construction-points>
          {constructionPoints.map((point) => (
            <g
              key={point.index}
              className="ek-blueprint__point"
              data-construction-point={point.index}
              data-point-coordinate={`${point.x},${point.y}`}
            >
              <path
                d={`M${point.x - 10} ${point.y} h20 M${point.x} ${point.y - 10} v20`}
                className="ek-blueprint__point-cross"
              />
              <circle cx={point.x} cy={point.y} r="5.2" className="ek-blueprint__point-ring" />
              <circle cx={point.x} cy={point.y} r="1.8" className="ek-blueprint__point-core" />
            </g>
          ))}
        </g>

        <g className="ek-blueprint__registration-marks" aria-hidden="true">
          {(
            [
              [0, 0],
              [LOGO_W, 0],
              [0, LOGO_H],
              [LOGO_W, LOGO_H],
              [LOGO_W / 2, LOGO_H / 2],
            ] as Point[]
          ).map(([x, y]) => (
            <g key={`registration-${x}-${y}`} className="ek-blueprint__registration">
              <circle cx={x} cy={y} r="15" />
              <circle cx={x} cy={y} r="4" />
              <path d={`M${x - 24} ${y} h48 M${x} ${y - 24} v48`} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
