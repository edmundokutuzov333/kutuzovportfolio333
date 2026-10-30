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



test("homepage renders the seven-card fan carousel with strict 4:5 artwork at all breakpoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1536, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status(), `homepage response at ${viewport.width}px`).toBe(200);

    const menuButton = page.locator("header button[aria-expanded]");
    await expect(menuButton).toHaveClass(/liquid-glass-button/);
    const glassMaterial = await menuButton.evaluate((button) => ({
      backdropFilter: getComputedStyle(button).backdropFilter,
      borderTopColor: getComputedStyle(button).borderTopColor,
    }));
    expect(glassMaterial.backdropFilter).toContain("blur");
    expect(glassMaterial.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");

    const fan = page.locator("[data-project-fan]");
    await expect(fan).toBeVisible();
    await expect(fan).toHaveAttribute("data-project-fan-count", "22");
    await expect(fan).toHaveAttribute("data-project-fan-visible", "7");
    await expect(fan).toHaveAttribute("data-project-fan-ratio", "4:5");

    const cards = fan.locator("[data-project-fan-card]");
    await expect(cards).toHaveCount(7);
    await expect.poll(() => fan.locator('[data-project-card-slot="3"] img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

    const cardMetrics = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const image = card.querySelector("img");
        const link = card.querySelector("a");
        return {
          ratio: card.offsetWidth / card.offsetHeight,
          declaredRatio: Number(card.getAttribute("data-card-aspect-ratio")),
          source: card.getAttribute("data-project-artwork-src"),
          href: link?.getAttribute("href"),
          imageLoaded: Boolean(image && image.complete && image.naturalWidth > 0),
          slot: Number(card.getAttribute("data-project-card-slot")),
        };
      }),
    );

    expect(cardMetrics.map((card) => card.slot)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(cardMetrics.every((card) => Math.abs(card.ratio - 0.8) < 0.02)).toBe(true);
    expect(cardMetrics.every((card) => card.declaredRatio === 0.8)).toBe(true);
    expect(new Set(cardMetrics.map((card) => card.source)).size).toBe(7);
    expect(cardMetrics.every((card) => card.href?.startsWith("/work/"))).toBe(true);

    await expect.poll(() => fan.evaluate((element) => {
      const card = element.querySelector('[data-project-card-slot="3"]');
      if (!card) return Number.POSITIVE_INFINITY;
      const stage = element.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const offsetX = Math.abs(box.left + box.width / 2 - (stage.left + stage.width / 2));
      const offsetY = Math.abs(box.top + box.height / 2 - (stage.top + stage.height / 2));
      return Math.max(offsetX, offsetY);
    })).toBeLessThan(2);

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);
  }

  await page.setViewportSize({ width: 1536, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const fan = page.locator("[data-project-fan]");
  const centerCard = fan.locator('[data-project-card-slot="3"]');
  await expect(centerCard).toHaveAttribute("data-project-card-index", "3");

  await fan.getByRole("button", { name: "Next project" }).click();
  await expect.poll(() => fan.locator('[data-project-card-slot="3"]').getAttribute("data-project-card-index")).toBe("4");
  await fan.getByRole("button", { name: "Previous project" }).click();
  await expect.poll(() => fan.locator('[data-project-card-slot="3"]').getAttribute("data-project-card-index")).toBe("3");

  await expect(fan.locator("[data-project-fan-card]")).toHaveCount(7);
});

test("desktop fan carousel lifts the hovered card and fans its neighbours away", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const centerCard = page.locator('[data-project-fan-card][data-project-card-slot="3"]');
  const leftCard = page.locator('[data-project-fan-card][data-project-card-slot="2"]');
  const rightCard = page.locator('[data-project-fan-card][data-project-card-slot="4"]');
  await expect(centerCard).toBeVisible();
  await page.waitForTimeout(2100);

  const beforeCenter = await centerCard.boundingBox();
  const beforeLeft = await leftCard.boundingBox();
  const beforeRight = await rightCard.boundingBox();
  await centerCard.hover();

  await expect.poll(async () => {
    const afterCenter = await centerCard.boundingBox();
    const afterLeft = await leftCard.boundingBox();
    const afterRight = await rightCard.boundingBox();
    return Boolean(
      beforeCenter && beforeLeft && beforeRight &&
      afterCenter && afterLeft && afterRight &&
      afterCenter.width > beforeCenter.width * 1.04 &&
      afterCenter.y < beforeCenter.y &&
      afterLeft.x < beforeLeft.x - 10 &&
      afterRight.x > beforeRight.x + 10
    );
  }).toBe(true);
});
