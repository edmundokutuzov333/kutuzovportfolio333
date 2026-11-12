import { test, expect } from "@playwright/test";

test("JARVIS keeps the reference voice stage and native pointer navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  const open = page.locator('button[aria-haspopup="dialog"]').first();
  await expect(open).toBeVisible();
  await open.click({ force: true });

  const jarvis = page.locator(".jv-root");
  await expect(jarvis).toBeVisible();
  await expect(jarvis.locator(".jv-panel h1")).toHaveText("Estou por aqui.");
  await expect(jarvis.locator(".jv-visual__bar")).toHaveCount(34);
  await expect(jarvis.locator(".jv-chat-button")).toHaveCSS("cursor", "pointer");
  await expect(page.locator("html")).toHaveClass(/jarvis-active/);

  await jarvis.getByRole("button", { name: "Abrir conversa escrita" }).click();
  const chat = jarvis.locator(".jv-chat-card");
  await expect(chat).toBeVisible();
  await expect(chat.locator("h2")).toHaveText("CONVERSA COMIGO");
  await expect(chat.locator(".jv-suggestions button")).toHaveCount(3);
  await expect(chat.locator("#jv-input")).toBeFocused();
  await expect(chat.getByRole("button", { name: "Mudar para conversa por voz" })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(chat).toHaveCount(0);
  await expect(jarvis).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(jarvis).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/jarvis-active/);
});

test("JARVIS presents published project links and live artwork instead of the old four static covers", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("ek:jarvis-open")));
  await expect(page.locator(".jv-root")).toBeVisible();
  await page.getByRole("button", { name: "Abrir conversa escrita" }).click();
  const chat = page.locator(".jv-chat-card");
  await chat.getByRole("button", { name: "Explorar os meus projectos." }).click();

  // Opening the gallery must position its heading at the start, not the
  // conversation's old bottom scroll position.
  const gallery = chat.getByRole("region", { name: "Galeria de projectos" });
  await expect(gallery).toHaveAttribute("data-lenis-prevent", "");
  await expect(gallery).toHaveCSS("overflow-y", "auto");
  await expect(gallery).toHaveCSS("touch-action", "pan-y");
  await expect(gallery).toBeFocused();
  const heading = gallery.locator(".jv-works__top");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("position", "sticky");

  const cards = chat.locator(".jv-hologram");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const initial = await gallery.evaluate((node) => {
    const title = node.querySelector(".jv-works__top");
    const area = node.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    return {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      titleTop: titleRect?.top ?? -999,
      areaTop: area.top,
    };
  });
  expect(initial.scrollTop).toBe(0);
  expect(initial.titleTop).toBeGreaterThanOrEqual(initial.areaTop - 2);
  expect(initial.titleTop).toBeLessThan(initial.areaTop + 65);
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight + 150);

  // Exercise actual input instead of changing scrollTop in test code.
  const bounds = await gallery.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.6);
  await page.mouse.wheel(0, 640);
  await expect.poll(() => gallery.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  await expect(heading).toBeInViewport();
  await page.mouse.wheel(0, -1000);
  await expect.poll(() => gallery.evaluate((node) => node.scrollTop)).toBeLessThan(4);

  await gallery.focus();
  await page.keyboard.press("End");
  await expect.poll(() => gallery.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  await page.keyboard.press("Home");
  await expect.poll(() => gallery.evaluate((node) => node.scrollTop)).toBeLessThan(4);
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await expect(cards.first()).toHaveAttribute("href", /\/work\/[^/]+/);
  const images = cards.locator("img");
  expect(await images.count()).toBeGreaterThan(0);
  await expect.poll(async () => {
    return images.first().evaluate((image) => image.complete && image.naturalWidth > 0);
  }, { timeout: 20_000 }).toBe(true);
  // Original image proportions must survive the hologram frame, on any orientation.
  const proportions = await images.first().evaluate((image) => {
    const frame = image.closest(".jv-hologram__art");
    const imageRect = image.getBoundingClientRect();
    const frameRect = frame?.getBoundingClientRect();
    return {
      intrinsic: image.naturalWidth / image.naturalHeight,
      visible: imageRect.width / imageRect.height,
      frame: frameRect ? frameRect.width / frameRect.height : 0,
    };
  });
  expect(Math.abs(proportions.intrinsic - proportions.visible)).toBeLessThan(0.025);
  expect(Math.abs(proportions.intrinsic - proportions.frame)).toBeLessThan(0.04);
  const href = await cards.first().getAttribute("href");
  expect(href).not.toBeNull();
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
});

test("mobile JARVIS chat does not scroll sideways and keeps a usable composer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("ek:jarvis-open")));
  const panel = page.locator(".jv-root");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Abrir conversa escrita" }).click();
  await expect(page.locator(".jv-chat-card")).toBeVisible();
  const composer = page.locator("#jv-input");
  await expect(composer).toBeVisible();
  await composer.fill("Olá, Kutuzov!");
  await expect(page.locator(".jv-chat-send")).toBeEnabled();
  const overflow = await page.evaluate(() => ({
    window: window.innerWidth,
    card: document.querySelector(".jv-chat-card")?.getBoundingClientRect().right,
    viewport: document.documentElement.clientWidth,
  }));
  expect(overflow.card).toBeLessThanOrEqual(overflow.window + 1);
  expect(overflow.viewport).toBe(390);
});


test("mobile project gallery starts at the heading and scrolls both directions", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("ek:jarvis-open")));
  await page.getByRole("button", { name: "Abrir conversa escrita" }).click();
  await page.getByRole("button", { name: "Explorar os meus projectos." }).click();

  const area = page.getByRole("region", { name: "Galeria de projectos" });
  await expect(area.locator(".jv-hologram").first()).toBeVisible({ timeout: 30_000 });
  await expect(area).toHaveCSS("touch-action", "pan-y");
  await expect(area.locator(".jv-works__top")).toBeInViewport();
  expect(await area.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await area.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(150);

  const rect = await area.boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, 520);
  await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeGreaterThan(50);
  await page.mouse.wheel(0, -780);
  await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeLessThan(4);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
