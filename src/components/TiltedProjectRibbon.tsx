import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ProjectRibbonImage } from "@/lib/project-ribbon";

const SLICES = 16;
const CAMERA = 1.6;
const MAX_WIDTH = 55;

type RibbonLayout = {
  columns: number;
  sweep: number;
  unit: number;
  limit: number;
};

type TiltedProjectRibbonProps = {
  images: ProjectRibbonImage[];
  direction: "left" | "right";
  speed?: number;
  tileHeight?: number;
  aspectRatio?: number;
  gap?: number;
  axis?: number;
  curve?: number;
  fade?: number;
  className?: string;
};

function arc(bend: number): number {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

function measure(
  width: number,
  height: number,
  tileHeight: number,
  aspectRatio: number,
  gap: number,
  bend: number,
): RibbonLayout {
  const tile = Math.min(
    (tileHeight / 100) * height,
    ((MAX_WIDTH / 100) * width) / aspectRatio,
  );
  const radius = width * arc(bend);

  if (!(tile > 0) || !(radius > 0)) {
    return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  }

  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const unit = toDegrees(tile / radius);
  const pitch = (aspectRatio + gap / 100) * unit;
  const limit = toDegrees(bend) + (aspectRatio * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
  const round = (value: number) => +value.toFixed(4);

  return {
    columns,
    sweep: round((columns * pitch) / 2),
    unit: round(unit),
    limit: round(Math.min((columns * pitch) / 2, limit)),
  };
}

function sameLayout(a: RibbonLayout | null, b: RibbonLayout): boolean {
  return (
    a?.columns === b.columns &&
    a.sweep === b.sweep &&
    a.unit === b.unit &&
    a.limit === b.limit
  );
}

export function TiltedProjectRibbon({
  images,
  direction,
  speed = 5,
  tileHeight = 86,
  aspectRatio = 4 / 5,
  gap = 7,
  axis = 50,
  curve = 78,
  fade = 13,
  className,
}: TiltedProjectRibbonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `project-ribbon-orbit-${id}`;
  const tileClass = `project-ribbon-tile-${id}`;
  const rowClass = `project-ribbon-row-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;
  const [layout, setLayout] = useState<RibbonLayout | null>(null);
  const [shown, setShown] = useState<Record<number, number>>({});

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateLayout = () => {
      const { width, height } = element.getBoundingClientRect();
      const next = measure(width, height, tileHeight, aspectRatio, gap, bend);
      setLayout((previous) => (sameLayout(previous, next) ? previous : next));
    };

    updateLayout();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateLayout);
    observer?.observe(element);
    window.addEventListener("resize", updateLayout, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [tileHeight, aspectRatio, gap, bend]);

  useEffect(() => {
    const preloaded = images.map((image) => {
      const preload = new Image();
      preload.decoding = "async";
      preload.src = image.src;
      return preload;
    });

    return () => {
      preloaded.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [images]);

  const { columns, sweep, unit, limit } =
    layout ?? measure(1440, 640, tileHeight, aspectRatio, gap, bend);

  const unitSize = (value: number) =>
    `calc(${+value.toFixed(4)} * min(${tileHeight}cqh, ${+(
      MAX_WIDTH / aspectRatio
    ).toFixed(4)}cqw))`;

  const radiusShare = 100 * arc(bend);
  const radius = `${+radiusShare.toFixed(3)}cqw`;
  const turn = (degrees: number) =>
    `translateZ(${radius}) rotateY(${+degrees.toFixed(4)}deg) translateZ(-${radius})`;

  const hiddenUntil = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
  const from = direction === "left" ? sweep : -sweep;
  const to = direction === "left" ? -sweep : sweep;
  const css =
    `@keyframes ${orbit}{` +
    `from{transform:${turn(from)}}to{transform:${turn(to)}}` +
    `0%,${hiddenUntil}%,${100 - hiddenUntil}%,100%{visibility:hidden}` +
    `${hiddenUntil + 0.001}%,${100 - hiddenUntil - 0.001}%{visibility:visible}}` +
    `.${rowClass}:hover .${tileClass},.${rowClass}:focus-within .${tileClass}{animation-play-state:paused}` +
    `@media(prefers-reduced-motion:reduce){.${tileClass}{animation-play-state:paused!important}}`;

  const share = aspectRatio / SLICES;
  const duration = columns * Math.max(0.25, speed);
  const fadeWidth = Math.min(35, Math.max(0, fade));
  const mask = `linear-gradient(90deg,transparent,#000 ${fadeWidth}%,#000 ${100 - fadeWidth}%,transparent)`;

  if (images.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`relative isolate overflow-hidden ${className ?? ""} ${rowClass}`}
      style={{ containerType: "size" }}
      role="group"
      aria-label={direction === "left" ? "Project artwork ribbon, moving left" : "Project artwork ribbon, moving right"}
      data-project-ribbon
      data-project-artwork-count={images.length}
    >
      <style>{css}</style>

      <div
        className="absolute inset-0"
        style={{
          opacity: layout ? 1 : 0,
          transition: "opacity 450ms ease",
          perspective: `${+(radiusShare * CAMERA).toFixed(3)}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {Array.from({ length: columns }, (_, tileIndex) => {
          const firstImageIndex = columns - 1 - tileIndex;
          const imageIndex =
            ((shown[tileIndex] ?? firstImageIndex) % images.length + images.length) %
            images.length;
          const image = images[imageIndex];

          return (
            <Link
              key={tileIndex}
              to="/work/$slug"
              params={{ slug: image.slug }}
              className={`absolute block rounded-sm outline-none focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${tileClass}`}
              style={{
                left: `calc(50% - ${unitSize(aspectRatio / 2)})`,
                top: `calc(${axis}% - ${unitSize(0.5)})`,
                width: unitSize(aspectRatio),
                height: unitSize(1),
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                animation: `${orbit} ${duration}s linear ${-tileIndex * Math.max(0.25, speed)}s infinite`,
              }}
              onAnimationIteration={(event) => {
                const lap = Math.max(1, Math.round(event.elapsedTime / duration));
                const nextImageIndex = lap * columns + firstImageIndex;
                setShown((previous) =>
                  previous[tileIndex] === nextImageIndex
                    ? previous
                    : { ...previous, [tileIndex]: nextImageIndex },
                );
              }}
              aria-label={`Open project: ${image.projectTitle}. ${image.alt}`}
              data-project-ribbon-tile
              data-project-slug={image.slug}
            >
              {Array.from({ length: SLICES }, (_, sliceIndex) => (
                <div
                  key={sliceIndex}
                  className={`absolute top-0 overflow-hidden bg-muted ${sliceIndex === 0 ? "rounded-l-sm" : ""} ${sliceIndex === SLICES - 1 ? "rounded-r-sm" : ""}`}
                  style={{
                    left: unitSize((aspectRatio - share) / 2),
                    width:
                      sliceIndex === SLICES - 1
                        ? unitSize(share)
                        : `calc(${unitSize(share)} + 1px)`,
                    height: unitSize(1),
                    transform: turn((aspectRatio / 2 - (sliceIndex + 0.5) * share) * unit),
                  }}
                >
                  <img
                    src={image.src}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    className="absolute top-0 max-w-none object-cover"
                    style={{
                      left: unitSize(-sliceIndex * share),
                      width: unitSize(aspectRatio),
                      height: unitSize(1),
                    }}
                  />
                </div>
              ))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
