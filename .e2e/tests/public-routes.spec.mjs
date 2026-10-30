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



test("homepage renders a five-card desktop fan and a three-position mobile fan with strict 4:5 artwork", async ({ page }) => {
  test.setTimeout(120_000);
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
      backgroundColor: getComputedStyle(button).backgroundColor,
    }));
    expect(glassMaterial.backdropFilter).toContain("blur");
    expect(glassMaterial.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(glassMaterial.backgroundColor).toBe("rgba(8, 11, 18, 0.68)");

    const clientMarquee = page.locator(".clients-marquee");
    await expect(clientMarquee).toHaveCSS("overflow-x", "clip");
    const marqueeWidth = await clientMarquee.evaluate((element) => element.getBoundingClientRect().width);
    expect(marqueeWidth).toBeLessThanOrEqual(viewport.width + 1);

    const fan = page.locator("[data-project-fan]");
    await expect(fan).toBeVisible();
    await expect(fan).toHaveAttribute("data-project-fan-count", "22");
    const visibleCount = viewport.width < 768 ? 3 : 5;
    const centerSlot = Math.floor(visibleCount / 2);
    await expect(fan).toHaveAttribute("data-project-fan-viewport-ready", "true");
    await expect(fan).toHaveAttribute("data-project-fan-mode", viewport.width < 768 ? "mobile" : "desktop");
    await expect(fan).toHaveAttribute("data-project-fan-visible", String(visibleCount));
    await expect(fan).toHaveAttribute("data-project-fan-center-slot", String(centerSlot));
    await expect(fan).toHaveAttribute("data-project-fan-ratio", "4:5");

    const cards = fan.locator("[data-project-fan-card]");
    await expect(cards).toHaveCount(visibleCount);
    const centerImage = fan.locator(`[data-project-card-slot="${centerSlot}"] img`);
    await expect.poll(() => centerImage.evaluate((image) => image.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);

    const cardMetrics = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const image = card.querySelector("img");
        const link = card.querySelector("a");
        const rect = card.getBoundingClientRect();
        return {
          width: card.offsetWidth,
          ratio: card.offsetWidth / card.offsetHeight,
          declaredRatio: Number(card.getAttribute("data-card-aspect-ratio")),
          source: card.getAttribute("data-project-artwork-src"),
          href: link?.getAttribute("href"),
          imageLoaded: Boolean(image && image.complete && image.naturalWidth > 0),
          slot: Number(card.getAttribute("data-project-card-slot")),
          left: rect.left,
          right: rect.right,
          zIndex: Number(getComputedStyle(card).zIndex),
        };
      }),
    );

    expect(cardMetrics.map((card) => card.slot)).toEqual(Array.from({ length: visibleCount }, (_, index) => index));
    expect(cardMetrics.every((card) => card.width >= 190)).toBe(true);
    if (viewport.width >= 1536) {
      expect(cardMetrics.find((card) => card.slot === centerSlot)?.width).toBeGreaterThan(350);
    }
    expect(cardMetrics.every((card) => Math.abs(card.ratio - 0.8) < 0.02)).toBe(true);
    expect(cardMetrics.every((card) => card.declaredRatio === 0.8)).toBe(true);
    expect(new Set(cardMetrics.map((card) => card.source)).size).toBe(visibleCount);
    expect(cardMetrics.every((card) => card.href?.startsWith("/work/"))).toBe(true);

    const centerCard = cardMetrics.find((card) => card.slot === centerSlot);
    expect(centerCard?.zIndex).toBeGreaterThan(Math.max(...cardMetrics.filter((card) => card.slot !== centerSlot).map((card) => card.zIndex)));

    const stageMetrics = await fan.evaluate((element, args) => {
      const stage = element.getBoundingClientRect();
      const left = element.querySelector('[data-project-card-slot="0"]').getBoundingClientRect();
      const right = element.querySelector(`[data-project-card-slot="${args.visibleCount - 1}"]`).getBoundingClientRect();
      const center = element.querySelector(`[data-project-card-slot="${args.centerSlot}"]`).getBoundingClientRect();
      const stageStyle = getComputedStyle(element);
      return {
        stageLeft: stage.left,
        stageRight: stage.right,
        stageOverflow: stageStyle.overflow,
        leftGap: left.left - stage.left,
        rightGap: stage.right - right.right,
        centerOffsetX: Math.abs(center.left + center.width / 2 - (stage.left + stage.width / 2)),
        centerOffsetY: Math.abs(center.top + center.height / 2 - (stage.top + stage.height / 2)),
      };
    }, { visibleCount, centerSlot });

    expect(stageMetrics.stageOverflow).toBe("visible");
    if (viewport.width >= 768) {
      expect(stageMetrics.leftGap).toBeGreaterThan(0);
      expect(stageMetrics.leftGap).toBeLessThan(45);
      expect(stageMetrics.rightGap).toBeGreaterThan(0);
      expect(stageMetrics.rightGap).toBeLessThan(45);
      expect(cardMetrics[0].zIndex).toBeGreaterThan(cardMetrics[1].zIndex);
      expect(cardMetrics[visibleCount - 1].zIndex).toBeGreaterThan(cardMetrics[visibleCount - 2].zIndex);
    } else {
      expect(cardMetrics[0].left).toBeGreaterThanOrEqual(-1);
      expect(cardMetrics[visibleCount - 1].right).toBeLessThanOrEqual(viewport.width + 1);
      expect(stageMetrics.leftGap).toBeLessThan(0);
      expect(stageMetrics.rightGap).toBeLessThan(0);
    }
    expect(stageMetrics.centerOffsetX).toBeLessThan(2);
    expect(stageMetrics.centerOffsetY).toBeLessThan(2);

    const overflowReport = await page.evaluate(() => ({
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(overflowReport.rootScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(overflowReport.bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  }
});

test("desktop fan carousel lifts the hovered card and gently separates its neighbours", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const centerCard = page.locator('[data-project-fan-card][data-project-card-slot="2"]');
  const leftCard = page.locator('[data-project-fan-card][data-project-card-slot="1"]');
  const rightCard = page.locator('[data-project-fan-card][data-project-card-slot="3"]');
  await expect(centerCard).toBeVisible();
  await page.waitForTimeout(1600);

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
      afterCenter.width > beforeCenter.width * 1.01 &&
      afterCenter.y < beforeCenter.y &&
      afterLeft.x < beforeLeft.x - 10 &&
      afterRight.x > beforeRight.x + 10
    );
  }).toBe(true);
});

test("fan carousel supports arrow keys and horizontal pointer dragging without following a card link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const fan = page.locator("[data-project-fan]");
  await expect(fan).toHaveAttribute("data-project-fan-mode", "mobile");
  await expect(fan).toHaveAttribute("data-project-fan-visible", "3");
  await expect(fan.locator('[data-project-card-slot="1"]')).toHaveAttribute("data-project-card-index", "3");

  await fan.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => fan.locator('[data-project-card-slot="1"]').getAttribute("data-project-card-index")).toBe("4");
  // Let the reduced-motion state update finish before the next real pointer gesture.
  await page.waitForTimeout(250);

  const box = await fan.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => fan.locator('[data-project-card-slot="1"]').getAttribute("data-project-card-index")).toBe("5");
  await expect(page).toHaveURL(/\/$/);
});
