import { test, expect } from "@playwright/test";

test("footer SVG links and contact columns remain readable at phone, tablet and desktop widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.locator("footer .footer-details-grid")).toBeVisible({ timeout: 30_000 });
  const footer = page.locator("footer");
  const grid = footer.locator(".footer-details-grid");
  const email = grid.locator('a[href^="mailto:"]').first();
  await expect(email).toBeVisible();
  const social = grid.locator(":scope > div").nth(1);
  const socialLinks = social.locator("a[target='_blank']");
  expect(await socialLinks.count()).toBeGreaterThan(0);

  for (const width of [320, 360, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await grid.evaluate((root) => {
      const contact = root.children[0];
      const social = root.children[1];
      const email = contact.querySelector('a[href^="mailto:"]');
      const a = contact.getBoundingClientRect();
      const b = social.getBoundingClientRect();
      const c = email.getBoundingClientRect();
      return {
        contact: { left: a.left, right: a.right, top: a.top, bottom: a.bottom },
        social: { left: b.left, right: b.right, top: b.top },
        email: { left: c.left, right: c.right },
        footerWidth: root.getBoundingClientRect().width,
        windowWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(dimensions.email.left, `email left at ${width}px`).toBeGreaterThanOrEqual(dimensions.contact.left - 1);
    expect(dimensions.email.right, `email right at ${width}px`).toBeLessThanOrEqual(dimensions.contact.right + 1);
    const separateRows = dimensions.social.top >= dimensions.contact.bottom - 1;
    const separateColumns = dimensions.social.left >= dimensions.contact.right - 1;
    expect(separateRows || separateColumns, `contact/social collision at ${width}px: ${JSON.stringify(dimensions)}`).toBe(true);
    expect(dimensions.scrollWidth, `horizontal document overflow at ${width}px`).toBeLessThanOrEqual(width + 1);

    const glyphs = await socialLinks.evaluateAll((links) => links.map((a) => ({
      text: a.textContent || "",
      icons: [...a.querySelectorAll('svg[data-site-icon="external"]')].map((svg) => ({
        width: Math.round(svg.getBoundingClientRect().width),
        height: Math.round(svg.getBoundingClientRect().height),
        hidden: svg.getAttribute("aria-hidden"),
      })),
    })));
    for (const link of glyphs) {
      expect(link.text).not.toMatch(/[↗→←]/);
      expect(link.icons).toHaveLength(1);
      expect(link.icons[0].width).toBeGreaterThanOrEqual(13);
      expect(link.icons[0].height).toBeGreaterThanOrEqual(13);
      expect(link.icons[0].hidden).toBe("true");
    }
  }
});

test("footer newsletter and Jarvis action follow EN/PT while icon SVGs remain stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  const footer = page.locator("footer");
  const jarvis = footer.locator('button[aria-haspopup="dialog"]');
  const email = footer.locator('input[name="newsletter-email"]');

  await expect(jarvis).toContainText("TALK TO JARVIS (AI)");
  await expect(jarvis.locator('svg[data-site-icon="forward"]')).toHaveCount(1);
  await expect(footer).toContainText("Receive occasional updates");
  await expect(email).toHaveAttribute("placeholder", "Your email");

  await page.getByRole("button", { name: "PT", exact: true }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await expect(jarvis).toContainText("FALAR COM JARVIS (IA)");
  await expect(footer).toContainText("Receba uma selecção ocasional");
  await expect(email).toHaveAttribute("placeholder", "O seu email");
  await expect(jarvis.locator('svg[data-site-icon="forward"]')).toHaveCount(1);

  await page.getByRole("button", { name: "EN", exact: true }).first().click();
  await expect(footer).toContainText("Receive occasional updates");
  await expect(jarvis).toContainText("TALK TO JARVIS (AI)");
});

test("Jarvis modal uses SVG arrows for all contact actions, not platform emoji glyphs", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  await page.locator("footer").locator('button[aria-haspopup="dialog"]').click();
  const modal = page.locator(".jv-root");
  await expect(modal).toBeVisible();
  const links = modal.locator(".jv-footer__links a");
  expect(await links.count()).toBeGreaterThan(0);
  const evidence = await links.evaluateAll((items) => items.map((a) => ({
    text: a.textContent || "",
    svg: !!a.querySelector("svg[data-site-icon]"),
  })));
  for (const link of evidence) {
    expect(link.text).not.toMatch(/[↗→←]/);
    expect(link.svg).toBe(true);
  }
});
