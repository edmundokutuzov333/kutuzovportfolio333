import { test, expect } from "@playwright/test";

test("production Home, Work and PIN-only Admin survive the Supabase quota incident", async ({ page }) => {
  test.setTimeout(120_000);
  let response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-project-fan]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-project-fan]")).toHaveAttribute("data-project-fan-count", "155");
  await expect(page.getByText("This page didn't load")).toHaveCount(0);

  response = await page.goto("/work", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator('a[href^="/work/"]').first()).toBeVisible();
  await expect(page.getByText("This page didn't load")).toHaveCount(0);

  response = await page.goto("/admin", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Acesso administrativo." })).toBeVisible();
  await expect(page.locator("[data-admin-workspace]")).toHaveCount(0);
  await page.getByLabel("Código de acesso").fill("333");
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page.getByText("Kutuzov Admin", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-admin-workspace]")).toBeVisible();

  const organize = page.getByRole("button", { name: "Organizar ordem" });
  await expect(organize).toBeVisible();
  const quotaBanner = page.getByRole("alert").filter({ hasText: "CMS temporariamente indisponível" });
  const isQuotaBlocked = await quotaBanner.isVisible().catch(() => false);
  if (isQuotaBlocked) {
    await expect(quotaBanner).toContainText("Supabase");
    await expect(quotaBanner).toContainText("apenas de leitura");
    await expect(organize).toBeDisabled();
    await expect(page.locator("article")).toHaveCount(155, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Editar / preview" }).first()).toBeDisabled();
  } else {
    await expect(organize).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator("article")).toHaveCount(155);
  }
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
