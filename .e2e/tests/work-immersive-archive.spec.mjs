import { expect, test } from "@playwright/test";

const ARCHIVE = "https://showreel-kutuzov-v2.vercel.app/";
const SELECTOR = '[data-testid="work-immersive-archive-link"]';

test.beforeEach(async ({ page }) => {
  // The global portfolio intro is tested separately; begin directly in Work.
  await page.addInitScript(() => sessionStorage.setItem("ek-intro-seen", "1"));
});

test("Work has one animated, floating archive link without disturbing the project grid", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/work", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  const launcher = page.locator(SELECTOR);
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveCount(1);
  await expect(launcher).toHaveAttribute("href", ARCHIVE);
  await expect(launcher).toHaveAttribute("target", "_blank");
  await expect(launcher).toHaveAttribute("rel", /noopener noreferrer/);
  await expect(launcher).toHaveAttribute("aria-label", /immersive archive/i);
  await expect(page.locator('a[href^="/work/"]').first()).toBeVisible();

  const motion = await launcher.evaluate((element) => {
    const orb = element.querySelector(".ek-archive-cta__orb");
    const letter = orb.querySelector(".ek-archive-cta__letter");
    const bounds = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      zIndex: getComputedStyle(element).zIndex,
      size: { width: bounds.width, height: bounds.height },
      circle: getComputedStyle(orb, "::before").animationName,
      letter: getComputedStyle(letter).animationName,
      float: getComputedStyle(orb).animationName,
    };
  });
  expect(motion.position).toBe("fixed");
  expect(motion.zIndex).toBe("35");
  expect(motion.circle).toContain("ekArchiveCircle");
  expect(motion.letter).toContain("ekArchiveLetter");
  expect(motion.float).toContain("ekArchiveFloat");
  expect(motion.size.width).toBeLessThan(300);
  expect(motion.size.height).toBeLessThan(150);

  // Existing filter and the independent project route must remain operational.
  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(page.getByRole("button", { name: "Video", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(launcher).toBeVisible();

  // Never leave the portfolio, and never add a full-screen loading barrier.
  await page.context().route("https://showreel-kutuzov-v2.vercel.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Immersive Archive</title>" }),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), launcher.click()]);
  await expect.poll(() => popup.url()).toBe(ARCHIVE);
  expect(new URL(page.url()).pathname).toBe("/work");
  await popup.close();
  expect(errors).toEqual([]);
});

test("responsive fixed launcher stays inside viewport at six device sizes", async ({ page }) => {
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const launcher = page.locator(SELECTOR);
  for (const width of [320, 360, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
    await expect(launcher).toBeVisible();
    const geometry = await launcher.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        documentWidth: document.documentElement.scrollWidth,
        windowWidth: window.innerWidth, windowHeight: window.innerHeight,
      };
    });
    expect(geometry.left, `left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
    expect(geometry.right, `right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    expect(geometry.top, `top edge at ${width}px`).toBeGreaterThan(0);
    expect(geometry.bottom, `bottom edge at ${width}px`).toBeLessThanOrEqual(geometry.windowHeight);
    expect(geometry.documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
  }
});

test("reduced motion disables all orbit and letter animation without hiding the link", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const launcher = page.locator(SELECTOR);
  await expect(launcher).toBeVisible();
  const names = await launcher.evaluate((element) => {
    const orb = element.querySelector(".ek-archive-cta__orb");
    const letter = orb.querySelector(".ek-archive-cta__letter");
    return {
      orb: getComputedStyle(orb).animationName,
      ring: getComputedStyle(orb, "::before").animationName,
      letter: getComputedStyle(letter).animationName,
    };
  });
  expect(names).toEqual({ orb: "none", ring: "none", letter: "none" });
});

test("Portuguese site mode changes the launcher copy and accessible name", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ek-language", "pt-PT"));
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const launcher = page.locator(SELECTOR);
  await expect(launcher).toHaveAttribute("aria-label", /Explorar o arquivo imersivo/i);
  await expect(launcher).toContainText("ARQUIVO IMERSIVO");
  await expect(launcher).toContainText("ENTRAR");
});
