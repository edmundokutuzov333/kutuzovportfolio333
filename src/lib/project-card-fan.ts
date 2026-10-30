export const MAX_VISIBLE_FAN_CARDS = 5;
export const MOBILE_VISIBLE_FAN_CARDS = 3;
export const FAN_CENTER_SLOT = 2;
export const MOBILE_FAN_CENTER_SLOT = 1;
export const INITIAL_FAN_INDEX = 3;
export const PROJECT_FAN_ASPECT_RATIO = 4 / 5;

export type FanSlotConfig = {
  rot: number;
  rotateY: number;
  scale: number;
  x: number;
  y: number;
  z: number;
  zIndex: number;
  opacity: number;
};

const DESKTOP_FAN_POSITIONS: readonly FanSlotConfig[] = [
  { rot: -17, rotateY: 10, scale: 0.78, x: -1, y: 2.5, z: -6, zIndex: 5, opacity: 0.92 },
  { rot: -8, rotateY: 5, scale: 0.91, x: -0.5, y: 1, z: -6, zIndex: 3, opacity: 0.97 },
  { rot: 0, rotateY: 0, scale: 1, x: 0, y: 0, z: 42, zIndex: 10, opacity: 1 },
  { rot: 8, rotateY: -5, scale: 0.91, x: 0.5, y: 1, z: -6, zIndex: 3, opacity: 0.97 },
  { rot: 17, rotateY: -10, scale: 0.78, x: 1, y: 2.5, z: -6, zIndex: 5, opacity: 0.92 },
];

const MOBILE_FAN_POSITIONS: readonly FanSlotConfig[] = [
  { rot: -8, rotateY: 7, scale: 0.84, x: -1, y: 1.25, z: -6, zIndex: 4, opacity: 0.95 },
  { rot: 0, rotateY: 0, scale: 1, x: 0, y: 0, z: 36, zIndex: 10, opacity: 1 },
  { rot: 8, rotateY: -7, scale: 0.84, x: 1, y: 1.25, z: -6, zIndex: 4, opacity: 0.95 },
];

export function getFanVisibleCount(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return MAX_VISIBLE_FAN_CARDS;
  return width < 768 ? MOBILE_VISIBLE_FAN_CARDS : MAX_VISIBLE_FAN_CARDS;
}

/** Scales vertical offsets on short viewports without changing artwork dimensions. */
export function getFanHeightMultiplier(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;

  let idealHeight: number;
  if (width < 480) idealHeight = 31 * 16;
  else if (width < 640) idealHeight = 33 * 16;
  else if (width < 768) idealHeight = 35 * 16;
  else if (width < 1024) idealHeight = 39 * 16;
  else idealHeight = 44 * 16;

  return Math.min(1, (height * 0.7) / idealHeight);
}

export function getFanSlotConfig(totalCards: number, slot: number): FanSlotConfig {
  if (totalCards >= MAX_VISIBLE_FAN_CARDS) {
    const index = Math.max(0, Math.min(DESKTOP_FAN_POSITIONS.length - 1, slot));
    return DESKTOP_FAN_POSITIONS[index] ?? DESKTOP_FAN_POSITIONS[FAN_CENTER_SLOT]!;
  }

  if (totalCards === MOBILE_VISIBLE_FAN_CARDS) {
    const index = Math.max(0, Math.min(MOBILE_FAN_POSITIONS.length - 1, slot));
    return MOBILE_FAN_POSITIONS[index] ?? MOBILE_FAN_POSITIONS[MOBILE_FAN_CENTER_SLOT]!;
  }

  const center = (totalCards - 1) / 2;
  const distance = totalCards > 1 ? (slot - center) / center : 0;
  const absDistance = Math.abs(distance);

  return {
    rot: distance * 17,
    rotateY: -distance * 10,
    scale: 1 - 0.22 * absDistance,
    x: distance,
    y: absDistance * 2.5,
    z: absDistance === 0 ? 36 : -6,
    zIndex: absDistance === 0 ? 10 : 5,
    opacity: 1 - absDistance * 0.08,
  };
}

export type VisibleFanCard<T> = {
  item: T;
  index: number;
  slot: number;
};

/** Returns a centred circular window of artwork with no duplicate slots. */
export function getVisibleFanCards<T>(
  cards: readonly T[],
  centerIndex: number,
  visibleCount = MAX_VISIBLE_FAN_CARDS,
): VisibleFanCard<T>[] {
  if (cards.length === 0) return [];

  const count = Math.max(1, Math.min(cards.length, Math.floor(visibleCount)));
  if (cards.length <= count) {
    return cards.map((item, index) => ({ item, index, slot: index }));
  }

  const centerSlot = Math.floor(count / 2);
  return Array.from({ length: count }, (_, slot) => {
    const index = ((centerIndex + slot - centerSlot) % cards.length + cards.length) % cards.length;
    return { item: cards[index]!, index, slot };
  });
}
