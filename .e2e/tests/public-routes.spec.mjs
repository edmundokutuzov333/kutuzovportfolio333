import { test, expect } from "@playwright/test";

const publicRoutes = [
  "/",
  "/work",
  "/work/diga-yes",
  "/about",
  "/services",
  "/process",
  "/clients",
  "/contact",
];

for (const route of publicRoutes) {
  test(`public route ${route} renders without a server error`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response, `no HTTP response for ${route}`).not.toBeNull();
    expect(response.status(), `unexpected HTTP status at ${route}`).toBe(200);
    await expect(page.locator("body")).not.toContainText(/internal server error|application has encountered an error/i);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(pageErrors, `unhandled browser errors at ${route}: ${pageErrors.join("; ")}`).toEqual([]);
  });
}

test("contact page keeps the real submission action behind its form flow", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator("form").first()).toBeVisible();
  await expect(page.getByText(/the database confirmed your request/i)).toHaveCount(0);
});

test("newsletter requires consent and does not claim success before a real request", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const form = page.locator('form[data-client-ready="true"]');
  await expect(form).toBeVisible();
  const email = page.getByRole("textbox", { name: /email para newsletter/i });
  await email.scrollIntoViewIfNeeded();
  const validEmail = "phase5-newsletter@example.com";
  await email.fill(validEmail);
  await expect(email).toHaveValue(validEmail);

  const submit = page.getByRole("button", { name: /entrar na lista/i });
  await expect(submit).toBeDisabled();

  const consent = page.getByRole("checkbox", {
    name: /Consinto receber actualizações ocasionais por email/i,
  });
  await consent.check();
  await expect(consent).toBeChecked();
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("Admin route is discoverable and serves the access gate", async ({ page }) => {
  const response = await page.goto("/about", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator('a[href="/admin"][data-lovable-route="/admin"]')).toHaveCount(1);
  const adminResponse = await page.request.get("/admin");
  expect(adminResponse.status()).toBe(200);
});

test("fresh and invalid Admin access never renders the protected workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/admin", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Acesso administrativo." })).toBeVisible();
  await expect(page.getByLabel("Código de acesso")).toBeVisible();
  await expect(page.getByLabel("Email autorizado")).toHaveCount(0);
  await expect(page.getByLabel("Palavra-passe Supabase Auth")).toHaveCount(0);
  await page.getByLabel("Código de acesso").fill("111");
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesso administrativo." })).toBeVisible();
  await expect(page.getByText(/Visão geral|Biblioteca multimédia|Caixa de entrada/)).toHaveCount(0);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(391);
});

test("the valid PIN opens the Admin workspace without browser JWT credentials", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Código de acesso")).toBeVisible();
  await page.getByLabel("Código de acesso").fill("333");
  await page.getByRole("button", { name: "Entrar no Admin" }).click();

  await expect(page.getByText("Kutuzov Admin", { exact: true })).toBeVisible();
  await expect(page.getByText("Sessão autenticada", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Código de acesso")).toHaveCount(0);
});

test("Admin uses the dark site palette without effects and restores a native cursor only inside Admin", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-admin-root]")).toBeVisible();

  const adminStyles = await page.evaluate(() => ({
    cursor: getComputedStyle(document.body).cursor,
    pageBackgroundImage: getComputedStyle(document.documentElement).backgroundImage,
    adminBackground: getComputedStyle(document.querySelector("[data-admin-root]")).backgroundColor,
    animation: getComputedStyle(document.querySelector("[data-admin-root]")).animationName,
    transitionDuration: getComputedStyle(document.querySelector("[data-admin-root]")).transitionDuration,
  }));
  expect(adminStyles.cursor).toBe("auto");
  expect(adminStyles.pageBackgroundImage).toBe("none");
  expect(adminStyles.adminBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(adminStyles.animation).toBe("none");
  expect(adminStyles.transitionDuration).toBe("0s");

  await page.goto("/about", { waitUntil: "domcontentloaded" });
  const publicStyles = await page.evaluate(() => ({
    cursor: getComputedStyle(document.body).cursor,
    pageBackgroundImage: getComputedStyle(document.documentElement).backgroundImage,
  }));
  expect(publicStyles.cursor).toBe("none");
  expect(publicStyles.pageBackgroundImage).not.toBe("none");
});


test("homepage renders two separated 1:2 artwork rows with opposite viewpoints and no cross-row duplicates", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1000 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const ribbons = page.locator("[data-project-ribbon]");
  await expect(ribbons).toHaveCount(2);
  await expect(ribbons.nth(0)).toHaveAttribute("data-project-artwork-count", "11");
  await expect(ribbons.nth(1)).toHaveAttribute("data-project-artwork-count", "11");
  await expect(ribbons.nth(0)).toHaveAttribute("data-project-ribbon-viewpoint", "below");
  await expect(ribbons.nth(1)).toHaveAttribute("data-project-ribbon-viewpoint", "above");

  const boxes = await ribbons.evaluateAll((rows) =>
    rows.map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    }),
  );
  expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(40);

  const rowSources = [];
  for (const ribbon of await ribbons.all()) {
    await expect(ribbon).toBeVisible();
    const row = await ribbon.locator("[data-project-ribbon-static]").evaluate((element) => ({
      hiddenByDefault: getComputedStyle(element).display === "none",
      sources: Array.from(
        element.querySelectorAll("[data-project-artwork-src]"),
        (tile) => tile.getAttribute("data-project-artwork-src"),
      ),
      ratios: Array.from(element.querySelectorAll("[data-project-artwork-src]"), (tile) => {
        const box = tile.getBoundingClientRect();
        return box.width / box.height;
      }),
    }));
    expect(row.hiddenByDefault).toBe(true);
    expect(row.sources).toHaveLength(11);
    expect(row.ratios.every((ratio) => ratio > 0.45 && ratio < 0.55)).toBe(true);
    rowSources.push(...row.sources);

    const animatedTiles = ribbon.locator("[data-project-ribbon-animated] [data-project-ribbon-tile]");
    const links = await animatedTiles.evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        href: anchor.getAttribute("href"),
        label: anchor.getAttribute("aria-label"),
        imageCount: anchor.querySelectorAll("img").length,
        visibleText: anchor.textContent?.trim() ?? "",
      })),
    );
    expect(links.length).toBeGreaterThanOrEqual(8);
    expect(links.length).toBeLessThanOrEqual(11);
    expect(links.every((link) => link.href?.startsWith("/work/"))).toBe(true);
    expect(links.every((link) => Boolean(link.label))).toBe(true);
    expect(links.every((link) => link.imageCount === 16)).toBe(true);
    expect(links.every((link) => link.visibleText === "")).toBe(true);
  }

  expect(rowSources).toHaveLength(22);
  expect(new Set(rowSources).size).toBe(22);

  const firstImage = page.locator("[data-project-ribbon-animated] [data-project-ribbon-tile] img").first();
  await expect.poll(() => firstImage.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(1537);

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const ribbon of await ribbons.all()) {
    const animated = ribbon.locator("[data-project-ribbon-animated]");
    const staticGallery = ribbon.locator("[data-project-ribbon-static]");
    await expect(animated).toBeHidden();
    await expect(staticGallery).toBeVisible();
    await expect(staticGallery.locator("[data-project-ribbon-tile]")).toHaveCount(11);
    await expect(staticGallery.locator("[data-project-ribbon-tile]").first()).toBeVisible();
  }

  const mobile = await page.context().newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto("/", { waitUntil: "domcontentloaded" });
  await expect(mobile.locator("[data-project-ribbon]")).toHaveCount(2);
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await mobile.close();
});
