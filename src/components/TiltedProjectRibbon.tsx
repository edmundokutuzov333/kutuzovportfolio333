import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ProjectRibbonImage } from "@/lib/project-ribbon";

const SLICES = 16;
const CAMERA = 2.5;
const MAX_WIDTH = 55;
const MAX_VISIBLE_COLUMNS = 12;
const MIN_POSTER_GAP = 8;
const MAX_POSTER_GAP = 28;

export type RibbonLayout = {
  columns: number;
  sweep: number;
  unit: number;
  limit: number;
  tileHeightPx: number;
  tileWidthPx: number;
  gapPx: number;
  pitchPx: number;
  pitchDegrees: number;
  radiusPx: number;
  perspectivePx: number;
  minProjectedGapPx: number;
};

type TiltedProjectRibbonProps = {
  images: ProjectRibbonImage[];
  direction: "left" | "right";
  viewpoint: "below" | "above";
  speed?: number;
  tileHeight?: number;
  aspectRatio?: number;
  gap?: number;
  axis?: number;
  curve?: number;
  fade?: number;
  className?: string;
};

const EMPTY_LAYOUT: RibbonLayout = {
  columns: 0,
  sweep: 0,
  unit: 0,
  limit: 0,
  tileHeightPx: 0,
  tileWidthPx: 0,
  gapPx: 0,
  pitchPx: 0,
  pitchDegrees: 0,
  radiusPx: 0,
  perspectivePx: 0,
  minProjectedGapPx: 0,
};

function arc(bend: number): number {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Measures one ribbon in CSS pixels. The poster pitch is derived from its
 * actual width plus a real pixel gap, then converted to an angular interval
 * on the cylindrical path. This avoids spacing that changes unpredictably
 * with viewport/container query units.
 */
export function measureProjectRibbon(
  width: number,
  height: number,
  tileHeight: number,
  aspectRatio: number,
  gap: number,
  bend: number,
  imageCount: number,
): RibbonLayout {
  const valid =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(tileHeight) &&
    Number.isFinite(aspectRatio) &&
    Number.isFinite(gap) &&
    Number.isFinite(bend) &&
    Number.isFinite(imageCount) &&
    width > 0 &&
    height > 0 &&
    tileHeight > 0 &&
    aspectRatio > 0 &&
    imageCount > 0;

  if (!valid) return EMPTY_LAYOUT;

  const safeBend = clamp(bend, (5 * Math.PI) / 180, (82 * Math.PI) / 180);
  const tileHeightPx = Math.min(
    (clamp(tileHeight, 1, 100) / 100) * height,
    ((MAX_WIDTH / 100) * width) / aspectRatio,
  );
  const tileWidthPx = tileHeightPx * aspectRatio;
  const gapPx = clamp(gap, MIN_POSTER_GAP, MAX_POSTER_GAP);
  const radiusPx = width * arc(safeBend);

  if (!(tileHeightPx > 0) || !(tileWidthPx > 0) || !(radiusPx > 0)) {
    return EMPTY_LAYOUT;
  }

  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const unit = toDegrees(tileHeightPx / radiusPx);
  const pitchPx = tileWidthPx + gapPx;
  const pitchDegrees = toDegrees(pitchPx / radiusPx);
  const halfPosterAngle = toDegrees(tileWidthPx / (2 * radiusPx));
  const visibleLimit = toDegrees(safeBend) + halfPosterAngle;
  const naturalColumns = Math.ceil((2 * visibleLimit) / pitchDegrees);
  const columns = Math.max(
    1,
    Math.min(Math.floor(imageCount), MAX_VISIBLE_COLUMNS, naturalColumns),
  );
  const sweep = (columns * pitchDegrees) / 2;
  const limit = Math.min(sweep, visibleLimit);

  // The cylindrical tangent and camera perspective both foreshorten the
  // physical gap near the outer edge. Sample the visible arc to expose its
  // true minimum projected gap to tests and diagnostics.
  let minProjectedGapPx = gapPx;
  const cameraDistance = radiusPx * CAMERA;
  for (let index = 0; index <= 64; index += 1) {
    const angle = (-limit + (2 * limit * index) / 64) * (Math.PI / 180);
    const perspectiveScale = cameraDistance / (cameraDistance + radiusPx * (Math.cos(angle) - 1));
    const projectedGap = gapPx * Math.cos(angle) * perspectiveScale;
    minProjectedGapPx = Math.min(minProjectedGapPx, projectedGap);
  }

  const round = (value: number) => +value.toFixed(4);
  return {
    columns,
    sweep: round(sweep),
    unit: round(unit),
    limit: round(limit),
    tileHeightPx: round(tileHeightPx),
    tileWidthPx: round(tileWidthPx),
    gapPx: round(gapPx),
    pitchPx: round(pitchPx),
    pitchDegrees: round(pitchDegrees),
    radiusPx: round(radiusPx),
    perspectivePx: round(cameraDistance),
    minProjectedGapPx: round(minProjectedGapPx),
  };
}

function sameLayout(a: RibbonLayout | null, b: RibbonLayout): boolean {
  return (
    a?.columns === b.columns &&
    a.sweep === b.sweep &&
    a.unit === b.unit &&
    a.limit === b.limit &&
    a.tileHeightPx === b.tileHeightPx &&
    a.tileWidthPx === b.tileWidthPx &&
    a.gapPx === b.gapPx &&
    a.radiusPx === b.radiusPx &&
    a.perspectivePx === b.perspectivePx
  );
}

export function TiltedProjectRibbon({
  images,
  direction,
  viewpoint,
  speed = 5,
  tileHeight = 92,
  aspectRatio = 1 / 2,
  gap = 18,
  axis = 50,
  curve = 50,
  fade = 8,
  className,
}: TiltedProjectRibbonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `project-ribbon-orbit-${id}`;
  const tileClass = `project-ribbon-tile-${id}`;
  const rowClass = `project-ribbon-row-${id}`;
  const animatedClass = `project-ribbon-animated-${id}`;
  const staticClass = `project-ribbon-static-${id}`;
  const bend = (clamp(curve, 5, 82) * Math.PI) / 180;
  const [layout, setLayout] = useState<RibbonLayout | null>(null);
  const [shown, setShown] = useState<Record<number, number>>({});
  const imageSignature = useMemo(
    () => images.map((image) => `${image.slug}:${image.src}`).join("|"),
    [images],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateLayout = () => {
      const { width, height } = element.getBoundingClientRect();
      const next = measureProjectRibbon(
        width,
        height,
        tileHeight,
        aspectRatio,
        gap,
        bend,
        images.length,
      );
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
  }, [tileHeight, aspectRatio, gap, bend, imageSignature, images.length]);

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
  }, [imageSignature]);

  const measured =
    layout ??
    measureProjectRibbon(
      1440,
      304,
      tileHeight,
      aspectRatio,
      gap,
      bend,
      images.length,
    );
  const {
    columns,
    sweep,
    unit,
    limit,
    tileHeightPx,
    tileWidthPx,
    gapPx,
    radiusPx,
    perspectivePx,
  } = measured;

  const turn = (degrees: number) =>
    `translateZ(${radiusPx}px) rotateY(${+degrees.toFixed(4)}deg) translateZ(-${radiusPx}px)`;
  const hiddenUntil = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
  const from = direction === "left" ? sweep : -sweep;
  const to = direction === "left" ? -sweep : sweep;
  const desktopOrigin = viewpoint === "below" ? "50% 116%" : "50% -16%";
  const mobileOrigin = viewpoint === "below" ? "50% 108%" : "50% -8%";
  const css =
    `@keyframes ${orbit}{` +
    `from{transform:${turn(from)}}to{transform:${turn(to)}}` +
    `0%,${hiddenUntil}%,${100 - hiddenUntil}%,100%{visibility:hidden}` +
    `${hiddenUntil + 0.001}%,${100 - hiddenUntil - 0.001}%{visibility:visible}}` +
    `.${rowClass}:hover .${tileClass},.${rowClass}:focus-within .${tileClass}{animation-play-state:paused}` +
    `@media(max-width:767px){.${animatedClass}{perspective-origin:${mobileOrigin}}}` +
    `@media(prefers-reduced-motion:reduce){.${animatedClass}{display:none!important}.${staticClass}{display:flex!important}}`;

  const share = aspectRatio / SLICES;
  const interval = Math.max(0.25, speed);
  const duration = columns * interval;
  const fadeWidth = Math.min(24, Math.max(0, fade));
  const mask = `linear-gradient(90deg,transparent,#000 ${fadeWidth}%,#000 ${100 - fadeWidth}%,transparent)`;

  if (images.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`relative isolate overflow-hidden ${className ?? ""} ${rowClass}`}
      style={{ contain: "layout paint" }}
      role="group"
      aria-label={
        viewpoint === "below"
          ? "Upper project artwork ribbon, perspective from below"
          : "Lower project artwork ribbon, perspective from above"
      }
      data-project-ribbon
      data-project-ribbon-viewpoint={viewpoint}
      data-project-ribbon-aspect-ratio={aspectRatio}
      data-project-artwork-count={images.length}
      data-project-ribbon-gap-px={gapPx}
      data-project-ribbon-columns={columns}
      data-project-ribbon-layout-ready={layout ? "true" : "false"}
      data-project-ribbon-perspective-origin={desktopOrigin}
    >
      <style>{css}</style>

      <div
        className={`absolute inset-0 ${animatedClass}`}
        data-project-ribbon-animated
        style={{
          opacity: layout ? 1 : 0,
          transition: "opacity 350ms ease",
          perspective: `${perspectivePx}px`,
          perspectiveOrigin: desktopOrigin,
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
          if (!image) return null;

          return (
            <Link
              key={tileIndex}
              to="/work/$slug"
              params={{ slug: image.slug }}
              className={`absolute block overflow-hidden rounded-[2px] outline-none focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${tileClass}`}
              style={{
                left: `calc(50% - ${tileWidthPx / 2}px)`,
                top: `calc(${axis}% - ${tileHeightPx / 2}px)`,
                width: `${tileWidthPx}px`,
                height: `${tileHeightPx}px`,
                transformStyle: "preserve-3d",
                transformOrigin: "50% 50%",
                backfaceVisibility: "hidden",
                animation: `${orbit} ${duration}s linear ${-tileIndex * interval}s infinite`,
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
              data-project-artwork-src={image.src}
              data-project-slug={image.slug}
            >
              {Array.from({ length: SLICES }, (_, sliceIndex) => (
                <div
                  key={sliceIndex}
                  className="absolute top-0 overflow-hidden"
                  style={{
                    left: `${((aspectRatio - share) / 2) * tileHeightPx}px`,
                    width:
                      sliceIndex === SLICES - 1
                        ? `${share * tileHeightPx}px`
                        : `calc(${share * tileHeightPx}px + 1px)`,
                    height: `${tileHeightPx}px`,
                    transform: turn(
                      (aspectRatio / 2 - (sliceIndex + 0.5) * share) * unit,
                    ),
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
                      left: `${-sliceIndex * share * tileHeightPx}px`,
                      width: `${aspectRatio * tileHeightPx}px`,
                      height: `${tileHeightPx}px`,
                    }}
                  />
                </div>
              ))}
            </Link>
          );
        })}
      </div>

      <div
        className={`absolute inset-0 hidden items-center gap-3 overflow-x-auto px-4 ${staticClass}`}
        data-project-ribbon-static
        aria-label="Static project artwork gallery"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {images.map((image, index) => (
          <Link
            key={`${image.slug}-${image.artworkIndex}-${index}`}
            to="/work/$slug"
            params={{ slug: image.slug }}
            className="block h-[88%] shrink-0 overflow-hidden rounded-[2px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            style={{ width: "auto", aspectRatio }}
            aria-label={`Open project: ${image.projectTitle}. ${image.alt}`}
            data-project-ribbon-tile
            data-project-artwork-src={image.src}
            data-project-slug={image.slug}
          >
            <img
              src={image.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
