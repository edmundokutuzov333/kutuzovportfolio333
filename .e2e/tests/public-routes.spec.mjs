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

  const submit = page.getByRole("button", { name: /pedir subscrição/i });
  await expect(submit).toBeDisabled();

  const consent = page.getByRole("checkbox", {
    name: /Consinto receber comunicações por email/i,
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
