import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "@tanstack/react-router";

import type { ProjectArtwork } from "@/lib/project-artwork";
import {
  getFanHeightMultiplier,
  getFanSlotConfig,
  getFanVisibleCount,
  getVisibleFanCards,
  INITIAL_FAN_INDEX,
  PROJECT_FAN_ASPECT_RATIO,
} from "@/lib/project-card-fan";

type ProjectCardFanProps = {
  cards: ProjectArtwork[];
};

type Viewport = {
  width: number;
  height: number;
  stageWidth: number;
  cardWidth: number;
};

type PointerStart = {
  pointerId: number;
  x: number;
  y: number;
};

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
  const pointerStart = useRef<PointerStart | null>(null);
  const suppressNextClick = useRef(false);
  const unlockTimer = useRef<number | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    width: 0,
    height: 0,
    stageWidth: 0,
    cardWidth: 0,
  });
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const totalCards = cards.length;
  const visibleCount = getFanVisibleCount(viewport.width);
  const needsPagination = totalCards > visibleCount;
  const [centerIndex, setCenterIndex] = useState(INITIAL_FAN_INDEX);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const stage = containerRef.current;
    const updateViewport = () => {
      const currentStage = containerRef.current;
      const currentCard = currentStage?.querySelector<HTMLElement>(".fan-card");
      const width = window.innerWidth;

      setViewport({
        width,
        height: window.innerHeight,
        stageWidth: currentStage?.clientWidth || width * (width < 768 ? 0.94 : 0.89),
        cardWidth:
          currentCard?.offsetWidth ||
          width * (width < 768 ? 0.55 : width < 1024 ? 0.27 : 0.28),
      });
    };

    updateViewport();
    const observer =
      typeof ResizeObserver !== "undefined" && stage ? new ResizeObserver(updateViewport) : null;
    if (stage && observer) observer.observe(stage);
    window.addEventListener("resize", updateViewport, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!totalCards) return;
    if (centerIndex >= totalCards) setCenterIndex(totalCards - 1);
  }, [centerIndex, totalCards]);

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
    }, firstEntry ? 1450 : 680);

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
      if (isAnimating.current || !needsPagination || totalCards <= visibleCount) return;
      isAnimating.current = !reducedMotion;
      directionRef.current = direction;
      setHoveredSlot(null);
      setCenterIndex((previous) =>
        direction === "right"
          ? (previous + 1) % totalCards
          : (previous - 1 + totalCards) % totalCards,
      );
    },
    [needsPagination, totalCards, visibleCount, reducedMotion],
  );

  const visibleCards = getVisibleFanCards(cards, centerIndex, visibleCount);
  const centerSlot = Math.floor(visibleCards.length / 2);
  const slotCount = visibleCards.length;
  const heightMultiplier = getFanHeightMultiplier(viewport.width, viewport.height);
  const stageWidth =
    viewport.stageWidth ||
    (viewport.width > 0 ? viewport.width * (viewport.width < 768 ? 0.94 : 0.89) : 1280);
  const cardWidth =
    viewport.cardWidth ||
    (viewport.width > 0
      ? viewport.width * (viewport.width < 768 ? 0.55 : viewport.width < 1024 ? 0.27 : 0.28)
      : 358);

  const getTarget = (slot: number) => {
    const base = getFanSlotConfig(slotCount, slot);
    const rotationRadians = (Math.abs(base.rot) * Math.PI) / 180;
    const rotateYRadians = (Math.abs(base.rotateY) * Math.PI) / 180;
    const projectedHalfWidth =
      cardWidth *
      base.scale *
      0.5 *
      (Math.cos(rotationRadians) * Math.cos(rotateYRadians) +
        PROJECT_FAN_ASPECT_RATIO ** -1 * Math.sin(rotationRadians));
    const desktopOuterOffset = Math.max(0, stageWidth * 0.5 - projectedHalfWidth - 14);
    const horizontalOffset = slotCount === 3 ? stageWidth * 0.22 : desktopOuterOffset;
    let x = base.x * horizontalOffset;
    let y = base.y * 16 * heightMultiplier;
    let rotation = base.rot;
    const rotateY = base.rotateY;
    let scale = base.scale;
    let z = base.z;
    const opacity = base.opacity;
    let delay = Math.abs(slot - centerSlot) * 0.025;

    if (hoveredSlot !== null && viewport.width >= 768) {
      const distance = Math.abs(slot - hoveredSlot);
      delay = distance * 0.018;

      if (slot === hoveredSlot) {
        y -= 0.65 * 16 * heightMultiplier;
        scale *= 1.025;
        z += 8;
      } else {
        const normalized = centerSlot > 0 ? Math.abs(slot - centerSlot) / centerSlot : 0;
        const pushStrength = stageWidth * 0.022 * (1 - normalized * 0.3);
        if (slot < hoveredSlot) {
          x -= pushStrength;
          rotation -= 1.2 / Math.max(1, distance);
        } else {
          x += pushStrength;
          rotation += 1.2 / Math.max(1, distance);
        }
      }
    }

    return {
      x,
      y,
      z,
      rotate: rotation,
      rotateY,
      scale,
      opacity,
      zIndex: base.zIndex,
      delay,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    suppressNextClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    pointerStart.current = null;

    if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      suppressNextClick.current = true;
      cycle(deltaX < 0 ? "right" : "left");
    }
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressNextClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick.current = false;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      cycle("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      cycle("right");
    }
  };

  if (totalCards === 0) return null;

  return (
    <section className="relative z-20 flex w-full flex-col items-center overflow-visible px-4 py-4 md:px-8 lg:py-8">
      <div className="flex w-full items-center justify-center">
        <div
          ref={containerRef}
          className="fan-layout relative flex items-center justify-center"
          onMouseLeave={() => setHoveredSlot(null)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStart.current = null;
          }}
          onClickCapture={handleClickCapture}
          onKeyDown={handleKeyDown}
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured project gallery"
          tabIndex={0}
          data-project-fan
          data-project-fan-count={totalCards}
          data-project-fan-visible={visibleCards.length}
          data-project-fan-center-slot={centerSlot}
          data-project-fan-mode={visibleCount === 3 ? "mobile" : "desktop"}
          data-project-fan-ratio="4:5"
          data-project-fan-viewport-ready={viewport.width > 0 ? "true" : "false"}
        >
          <AnimatePresence custom={directionRef.current} mode="sync">
            {visibleCards.map(({ item, index, slot }) => {
              const target = getTarget(slot);
              const firstEntry = !hasEntered.current;
              const entryFrom = directionRef.current === "right" ? 1 : -1;
              const initial = firstEntry
                ? {
                    x: target.x,
                    y: target.y + 14,
                    z: target.z - 12,
                    rotate: target.rotate,
                    rotateY: target.rotateY,
                    scale: target.scale * 0.94,
                    opacity: 0,
                  }
                : {
                    x: target.x + entryFrom * stageWidth * 0.12,
                    y: target.y - 8,
                    z: target.z - 16,
                    rotate: target.rotate + entryFrom * 8,
                    rotateY: target.rotateY,
                    scale: target.scale * 0.94,
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
                    z: target.z,
                    rotate: target.rotate,
                    rotateY: target.rotateY,
                    scale: target.scale,
                    opacity: target.opacity,
                    zIndex: target.zIndex,
                  }}
                  custom={directionRef.current}
                  variants={{
                    exit: (direction: unknown) => {
                      const isRight = direction === "right";
                      return reducedMotion
                        ? { opacity: 0 }
                        : {
                            x: target.x + (isRight ? -1 : 1) * stageWidth * 0.12,
                            y: target.y - 8,
                            z: target.z - 16,
                            rotate: target.rotate + (isRight ? -8 : 8),
                            rotateY: target.rotateY,
                            scale: target.scale * 0.92,
                            opacity: 0,
                          };
                    },
                  }}
                  exit="exit"
                  transition={
                    reducedMotion
                      ? { duration: 0.01 }
                      : {
                          type: "spring",
                          stiffness: firstEntry ? 135 : 165,
                          damping: 24,
                          mass: 0.9,
                          delay: firstEntry
                            ? 0.08 + Math.abs(slot - centerSlot) * 0.055
                            : target.delay,
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
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {centerIndex + 1} of {totalCards}: {cards[centerIndex]?.projectTitle ?? "Featured project"}
      </span>
    </section>
  );
}
