export const MAX_VISIBLE_FAN_CARDS = 7;
export const FAN_CENTER_SLOT = 3;
export const PROJECT_FAN_ASPECT_RATIO = 4 / 5;

export type FanSlotConfig = {
  rot: number;
  scale: number;
  x: number;
  y: number;
  zIndex: number;
};

const FAN_POSITIONS: readonly FanSlotConfig[] = [
  { rot: -21, scale: 0.7756, x: -30, y: 7.3, zIndex: 1 },
  { rot: -14, scale: 0.8498, x: -22, y: 4.0, zIndex: 2 },
  { rot: -7, scale: 0.9346, x: -11, y: 1.3, zIndex: 3 },
  { rot: 0, scale: 1, x: 0, y: 0, zIndex: 10 },
  { rot: 7, scale: 0.9346, x: 11, y: 1.3, zIndex: 3 },
  { rot: 14, scale: 0.8498, x: 22, y: 4.0, zIndex: 2 },
  { rot: 21, scale: 0.7756, x: 30, y: 7.3, zIndex: 1 },
];

export function getFanResponsiveMultiplier(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0.16;
  if (width < 480) return 0.16 + ((Math.max(360, width) - 360) / 120) * 0.12;
  if (width < 640) return 0.28 + ((width - 480) / 160) * 0.17;
  if (width < 768) return 0.45 + ((width - 640) / 128) * 0.13;
  if (width < 1024) return 0.58 + ((width - 768) / 256) * 0.18;
  if (width < 1280) return 0.76 + ((width - 1024) / 256) * 0.24;
  return 1;
}

/** Scales the vertical fan offsets when the viewport is shorter than its design height. */
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
    const index = Math.max(0, Math.min(FAN_POSITIONS.length - 1, slot));
    return FAN_POSITIONS[index] ?? FAN_POSITIONS[FAN_CENTER_SLOT]!;
  }

  const center = totalCards >> 1;
  const distance = totalCards > 1 ? (slot - center) / center : 0;
  const absDistance = Math.abs(distance);

  return {
    rot: distance * 21,
    scale: 1 - 0.2244 * absDistance * absDistance,
    x: distance * 30,
    y: absDistance * absDistance * 7.3,
    zIndex: 10 - Math.abs(slot - center),
  };
}

export type VisibleFanCard<T> = {
  item: T;
  index: number;
  slot: number;
};

/** Returns the visible seven in slot order, wrapping cleanly at both ends. */
export function getVisibleFanCards<T>(
  cards: readonly T[],
  centerIndex: number,
): VisibleFanCard<T>[] {
  if (cards.length === 0) return [];

  if (cards.length <= MAX_VISIBLE_FAN_CARDS) {
    return cards.map((item, index) => ({ item, index, slot: index }));
  }

  return Array.from({ length: MAX_VISIBLE_FAN_CARDS }, (_, slot) => {
    const index =
      ((centerIndex + slot - FAN_CENTER_SLOT) % cards.length + cards.length) % cards.length;
    return { item: cards[index]!, index, slot };
  });
}
