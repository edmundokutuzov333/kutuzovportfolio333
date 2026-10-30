import { test, expect } from "@playwright/test";

test("footer EK uses geometry-derived construction guides and repeats its point-by-point drawing forever", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const blueprint = page.locator("[data-ek-blueprint]");
  await expect(blueprint).toHaveCount(1);

  // Confirm client hydration before moving the page to the footer.
  const menuToggle = page.locator('header button[aria-expanded]');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(blueprint).toHaveAttribute("data-animation-state", "looping");

  const geometry = await blueprint.evaluate((root) => {
    const svg = root.querySelector("svg");
    const segments = Array.from(svg?.querySelectorAll("[data-monogram-segment]") ?? []);
    const firstSegment = segments[0];
    const segmentAnimation = firstSegment?.getAnimations()[0];
    const timing = segmentAnimation?.effect?.getTiming();
    return {
      vectorWidth: Number(root.getAttribute("data-vector-width")),
      vectorHeight: Number(root.getAttribute("data-vector-height")),
      verticalGuides: svg?.querySelectorAll('[data-guide-axis="x"]').length ?? 0,
      horizontalGuides: svg?.querySelectorAll('[data-guide-axis="y"]').length ?? 0,
      diagonalGuides: svg?.querySelectorAll("[data-diagonal-guide]").length ?? 0,
      segments: segments.length,
      points: svg?.querySelectorAll("[data-construction-point]").length ?? 0,
      hatches: svg?.querySelectorAll("[data-hatch]").length ?? 0,
      labels: svg?.querySelectorAll("text").length ?? 0,
      legacySquareGrid: svg?.querySelectorAll("[data-grid-minor], [data-grid-major]").length ?? 0,
      segmentPathLength: firstSegment?.getAttribute("pathLength"),
      loopIterations: timing?.iterations ?? 0,
      loopDuration: timing?.duration ?? 0,
      playState: segmentAnimation?.playState ?? "missing",
    };
  });

  expect(geometry.vectorWidth).toBe(1920);
  expect(geometry.vectorHeight).toBe(815);
  expect(geometry.verticalGuides).toBeGreaterThanOrEqual(14);
  expect(geometry.horizontalGuides).toBeGreaterThanOrEqual(12);
  expect(geometry.diagonalGuides).toBeGreaterThanOrEqual(10);
  expect(geometry.segments).toBe(29);
  expect(geometry.points).toBe(29);
  expect(geometry.hatches).toBeGreaterThanOrEqual(20);
  expect(geometry.labels).toBe(0);
  expect(geometry.legacySquareGrid).toBe(0);
  expect(geometry.segmentPathLength).toBe("1");
  expect(geometry.loopIterations).toBe(Number.POSITIVE_INFINITY);
  expect(geometry.loopDuration).toBe(15_000);
  expect(geometry.playState).toBe("running");

  const animationProgress = await blueprint.locator("[data-monogram-segment='0']").evaluate((element) => {
    const animation = element.getAnimations()[0];
    const before = Number(animation?.currentTime ?? 0);
    return new Promise<number>((resolve) => {
      window.setTimeout(() => resolve(Number(animation?.currentTime ?? 0) - before), 220);
    });
  });
  expect(animationProgress).toBeGreaterThan(100);
});

test("footer EK remains fully constructed and motion-free when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const blueprint = page.locator("[data-ek-blueprint]");
  await blueprint.scrollIntoViewIfNeeded();
  await expect(blueprint).toHaveAttribute("data-animation-state", "static");

  const staticState = await blueprint.evaluate((root) => {
    const svg = root.querySelector("svg");
    const guide = svg?.querySelector("[data-alignment-guide]");
    const segment = svg?.querySelector("[data-monogram-segment]");
    const point = svg?.querySelector("[data-construction-point]");
    return {
      guideOffset: guide ? Number.parseFloat(getComputedStyle(guide).strokeDashoffset) : Number.NaN,
      segmentOffset: segment ? Number.parseFloat(getComputedStyle(segment).strokeDashoffset) : Number.NaN,
      guideOpacity: guide ? Number.parseFloat(getComputedStyle(guide).opacity) : 0,
      segmentAnimationCount: segment?.getAnimations().length ?? 0,
      pointOpacity: point ? Number.parseFloat(getComputedStyle(point).opacity) : 0,
      hasStaticClass: root.classList.contains("is-static"),
      textNodes: svg?.querySelectorAll("text").length ?? 0,
    };
  });

  expect(staticState.guideOffset).toBe(0);
  expect(staticState.segmentOffset).toBe(0);
  expect(staticState.guideOpacity).toBeGreaterThan(0);
  expect(staticState.segmentAnimationCount).toBe(0);
  expect(staticState.pointOpacity).toBeGreaterThan(0);
  expect(staticState.hasStaticClass).toBe(true);
  expect(staticState.textNodes).toBe(0);
});
