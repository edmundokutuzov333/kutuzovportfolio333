import { test, expect } from "@playwright/test";

test("footer EK is constructed from its source vectors and an exact 32/160-unit grid", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const blueprint = page.locator("[data-ek-blueprint]");
  await expect(blueprint).toHaveCount(1);

  // Confirm client hydration before driving the same scroll path used by the public shell.
  const menuToggle = page.locator('header button[aria-expanded]');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(blueprint).toHaveAttribute("data-animation-state", "visible");

  const geometry = await blueprint.evaluate((root) => {
    const svg = root.querySelector("svg");
    const minor = svg?.querySelector("[data-grid-minor]");
    const major = svg?.querySelector("[data-grid-major]");
    const reveal = svg?.querySelector("[data-grid-reveal]");
    return {
      gridUnit: Number(root.getAttribute("data-grid-unit")),
      majorGridUnit: Number(root.getAttribute("data-major-grid-unit")),
      vectorWidth: Number(root.getAttribute("data-vector-width")),
      vectorHeight: Number(root.getAttribute("data-vector-height")),
      minorWidth: Number(minor?.getAttribute("width")),
      minorHeight: Number(minor?.getAttribute("height")),
      majorWidth: Number(major?.getAttribute("width")),
      majorHeight: Number(major?.getAttribute("height")),
      outlineParts: Array.from(svg?.querySelectorAll("[data-outline-part]") ?? []).map((path) =>
        path.getAttribute("data-outline-part"),
      ),
      constructionNodes: svg?.querySelectorAll("[data-grid-node]").length ?? 0,
      hasScanPass: Boolean(svg?.querySelector("[data-blueprint-scan]")),
      revealAnimation: reveal ? getComputedStyle(reveal).animationName : "missing",
    };
  });

  expect(geometry).toMatchObject({
    gridUnit: 32,
    majorGridUnit: 160,
    vectorWidth: 1920,
    vectorHeight: 815,
    minorWidth: 32,
    minorHeight: 32,
    majorWidth: 160,
    majorHeight: 160,
    outlineParts: ["e", "k", "period"],
    hasScanPass: true,
  });
  expect(geometry.constructionNodes).toBeGreaterThanOrEqual(25);
  expect(geometry.revealAnimation).toBe("ek-blueprint-reveal");

  const revealWindow = blueprint.locator("[data-grid-reveal]");
  await expect.poll(
    () => revealWindow.evaluate((element) => Number.parseFloat(getComputedStyle(element).width)),
    { timeout: 5_000 },
  ).toBeGreaterThan(0);
  await expect.poll(
    () => revealWindow.evaluate((element) => Number.parseFloat(getComputedStyle(element).width)),
    { timeout: 5_000 },
  ).toBeGreaterThanOrEqual(1919);
});

test("footer EK blueprint is fully formed without motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const blueprint = page.locator("[data-ek-blueprint]");
  await blueprint.scrollIntoViewIfNeeded();
  await expect(blueprint).toHaveAttribute("data-animation-state", "visible");

  const reducedMotionState = await blueprint.evaluate((root) => {
    const svg = root.querySelector("svg");
    const outline = svg?.querySelector("[data-outline-part]");
    const reveal = svg?.querySelector("[data-grid-reveal]");
    const scan = svg?.querySelector("[data-blueprint-scan]");
    return {
      outlineAnimation: outline ? getComputedStyle(outline).animationName : "missing",
      outlineDashOffset: outline ? Number.parseFloat(getComputedStyle(outline).strokeDashoffset) : Number.NaN,
      revealAnimation: reveal ? getComputedStyle(reveal).animationName : "missing",
      revealWidth: reveal ? Number.parseFloat(getComputedStyle(reveal).width) : 0,
      scanDisplay: scan ? getComputedStyle(scan).display : "missing",
    };
  });

  expect(reducedMotionState.outlineAnimation).toBe("none");
  expect(reducedMotionState.outlineDashOffset).toBe(0);
  expect(reducedMotionState.revealAnimation).toBe("none");
  expect(reducedMotionState.revealWidth).toBeGreaterThanOrEqual(1919);
  expect(reducedMotionState.scanDisplay).toBe("none");
});
