import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import type { ProjectArtwork } from "@/lib/project-artwork";
import {
  FAN_CENTER_SLOT,
  getFanHeightMultiplier,
  getFanResponsiveMultiplier,
  getFanSlotConfig,
  getVisibleFanCards,
  MAX_VISIBLE_FAN_CARDS,
  PROJECT_FAN_ASPECT_RATIO,
} from "@/lib/project-card-fan";

type ProjectCardFanProps = {
  cards: ProjectArtwork[];
};

type Viewport = { width: number; height: number };

const ARROW_CLASSES =
  "liquid-glass-button relative z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:h-12 md:w-12";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="relative z-[2] h-4 w-4 md:h-5 md:w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

export function ProjectCardFan({ cards }: ProjectCardFanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);
  const hasEntered = useRef(false);
  const directionRef = useRef<"left" | "right">("right");
  const unlockTimer = useRef<number | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const totalCards = cards.length;
  const needsPagination = totalCards > MAX_VISIBLE_FAN_CARDS;
  const [centerIndex, setCenterIndex] = useState(
    needsPagination ? FAN_CENTER_SLOT : totalCards >> 1,
  );
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!totalCards) return;
    if (reducedMotion) {
      isAnimating.current = false;
      hasEntered.current = true;
      return;
    }

    isAnimating.current = true;
    const firstEntry = !hasEntered.current;
    if (unlockTimer.current !== null) window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      isAnimating.current = false;
      hasEntered.current = true;
      unlockTimer.current = null;
    }, firstEntry ? 1900 : 700);

    return () => {
      if (unlockTimer.current !== null) {
        window.clearTimeout(unlockTimer.current);
        unlockTimer.current = null;
      }
    };
  }, [centerIndex, totalCards, reducedMotion]);

  useEffect(() => {
    return () => {
      if (unlockTimer.current !== null) window.clearTimeout(unlockTimer.current);
    };
  }, []);

  const cycle = useCallback(
    (direction: "left" | "right") => {
      if (isAnimating.current || !needsPagination || totalCards <= MAX_VISIBLE_FAN_CARDS) return;
      isAnimating.current = !reducedMotion;
      directionRef.current = direction;
      setHoveredSlot(null);
      setCenterIndex((previous) =>
        direction === "right"
          ? (previous + 1) % totalCards
          : (previous - 1 + totalCards) % totalCards,
      );
    },
    [needsPagination, totalCards, reducedMotion],
  );

  const visibleCards = getVisibleFanCards(cards, centerIndex);
  const multiplier = getFanResponsiveMultiplier(viewport.width);
  const heightMultiplier = getFanHeightMultiplier(viewport.width, viewport.height);
  const slotCount = needsPagination ? MAX_VISIBLE_FAN_CARDS : totalCards;
  const centerSlot = visibleCards.length >> 1;

  const getTarget = (slot: number) => {
    const base = getFanSlotConfig(slotCount, slot);
    let x = base.x * multiplier;
    let y = base.y * heightMultiplier;
    let rotation = base.rot;
    let scale = base.scale;
    let delay = 0;

    if (hoveredSlot !== null) {
      const distance = Math.abs(slot - hoveredSlot);
      delay = distance * 0.02;

      if (slot === hoveredSlot) {
        y -= 2.5 * heightMultiplier;
        scale *= 1.08;
      } else {
        const normalized = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
        const pushStrength =
          8 * (1 - Math.abs(normalized)) * (1 + 0.2 * Math.max(0, 3 - distance));

        if (slot < hoveredSlot) {
          x -= pushStrength * multiplier;
          rotation -= 3 / (distance + 1);
        } else {
          x += pushStrength * multiplier;
          rotation += 3 / (distance + 1);
        }

        if (slot === visibleCards.length - 1 && hoveredSlot < centerSlot) y -= heightMultiplier;
        if (slot === 0 && hoveredSlot > centerSlot) y -= heightMultiplier;
      }
    } else {
      delay = Math.abs(slot - centerSlot) * 0.02;
    }

    return {
      x: x * 16,
      y: y * 16,
      rotate: rotation,
      scale,
      opacity: 1,
      zIndex: base.zIndex,
      delay,
    };
  };

  const onMouseLeave = () => setHoveredSlot(null);

  if (totalCards === 0) return null;

  return (
    <section className="relative z-20 flex w-full flex-col items-center overflow-x-clip px-4 py-4 md:px-8 lg:py-8">
      <div className="flex w-full items-center justify-center">
        <div
          ref={containerRef}
          className="fan-layout relative flex w-full items-center justify-center"
          onMouseLeave={onMouseLeave}
          role="group"
          aria-label="Project artwork fan carousel"
          data-project-fan
          data-project-fan-count={totalCards}
          data-project-fan-visible={visibleCards.length}
          data-project-fan-ratio="4:5"
          data-project-fan-viewport-ready={viewport.width > 0 ? "true" : "false"}
        >
          <AnimatePresence custom={directionRef.current} mode="sync">
            {visibleCards.map(({ item, index, slot }) => {
              const target = getTarget(slot);
              const firstEntry = !hasEntered.current;
              const entryFrom = directionRef.current === "right" ? 40 : -40;
              const initial = firstEntry
                ? { x: 0, y: 12 * heightMultiplier * 16, rotate: 0, scale: 0.5, opacity: 0 }
                : {
                    x: entryFrom * 16,
                    y: target.y,
                    rotate: directionRef.current === "right" ? 30 : -30,
                    scale: 0.5,
                    opacity: 0,
                  };

              return (
                <motion.div
                  key={`${item.slug}-${item.artworkIndex}-${index}`}
                  className="fan-card"
                  style={{ aspectRatio: PROJECT_FAN_ASPECT_RATIO }}
                  initial={reducedMotion ? false : initial}
                  animate={{
                    x: target.x,
                    y: target.y,
                    rotate: target.rotate,
                    scale: target.scale,
                    opacity: 1,
                    zIndex: target.zIndex,
                  }}
                  custom={directionRef.current}
                  variants={{
                    exit: (direction: unknown) => {
                      const isRight = direction === "right";
                      return reducedMotion
                        ? { opacity: 0 }
                        : {
                            x: (isRight ? -40 : 40) * 16,
                            rotate: isRight ? -30 : 30,
                            scale: 0.5,
                            opacity: 0,
                            zIndex: 0,
                          };
                    },
                  }}
                  exit="exit"
                  transition={
                    reducedMotion
                      ? { duration: 0.01 }
                      : firstEntry
                        ? {
                            type: "spring",
                            stiffness: 115,
                            damping: 10,
                            mass: 0.8,
                            delay: 0.2 + slot * 0.06,
                          }
                        : {
                            type: "spring",
                            stiffness: 190,
                            damping: 17,
                            mass: 0.8,
                            delay: target.delay,
                          }
                  }
                  onMouseEnter={() => {
                    if (!isAnimating.current) setHoveredSlot(slot);
                  }}
                  onFocus={() => {
                    if (!isAnimating.current) setHoveredSlot(slot);
                  }}
                  onBlur={() => setHoveredSlot(null)}
                  data-project-fan-card
                  data-project-card-index={index}
                  data-project-card-slot={slot}
                  data-project-artwork-src={item.src}
                  data-project-slug={item.slug}
                  data-card-aspect-ratio={PROJECT_FAN_ASPECT_RATIO}
                >
                  <Link
                    to="/work/$slug"
                    params={{ slug: item.slug }}
                    className="block h-full w-full overflow-hidden rounded-[3px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    aria-label={`Open project: ${item.projectTitle}. ${item.alt}`}
                    draggable={false}
                  >
                    <img
                      src={item.src}
                      alt={item.alt}
                      loading={slot === centerSlot ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                      className="block h-full w-full select-none object-cover"
                    />
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {needsPagination && (
        <div className="z-30 mt-4 flex items-center justify-center gap-4 md:mt-6">
          <button
            type="button"
            className={ARROW_CLASSES}
            onClick={() => cycle("left")}
            aria-label="Previous project"
          >
            <Chevron direction="left" />
          </button>
          <div className="flex max-w-[min(60vw,34rem)] items-center gap-2 overflow-hidden px-1" aria-label="Carousel position">
            {cards.map((card, index) => (
              <span
                key={`${card.slug}-${card.artworkIndex}-${index}`}
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300 ${
                  index === centerIndex ? "scale-[1.35] bg-white/80" : "bg-white/20"
                }`}
                aria-current={index === centerIndex ? "step" : undefined}
                aria-label={`Project ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className={ARROW_CLASSES}
            onClick={() => cycle("right")}
            aria-label="Next project"
          >
            <Chevron direction="right" />
          </button>
        </div>
      )}
    </section>
  );
}
