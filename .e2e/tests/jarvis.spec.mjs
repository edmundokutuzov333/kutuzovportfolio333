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
  await page.locator('button[aria-haspopup="dialog"]').first().click({ force: true });
  await page.getByRole("button", { name: "Abrir conversa escrita" }).click();
  const chat = page.locator(".jv-chat-card");
  await chat.getByRole("button", { name: "Explorar os meus projectos." }).click();

  const cards = chat.locator(".jv-hologram");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await expect(cards.first()).toHaveAttribute("href", /\/work\/[^/]+/);
  const images = cards.locator("img");
  expect(await images.count()).toBeGreaterThan(0);
  await expect.poll(async () => {
    return images.first().evaluate((image) => image.complete && image.naturalWidth > 0);
  }, { timeout: 20_000 }).toBe(true);
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
