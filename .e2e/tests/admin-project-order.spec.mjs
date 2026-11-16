import { test, expect } from "@playwright/test";

async function signIn(page) {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Acesso administrativo." })).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Código de acesso").fill("333");
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page.getByText("Kutuzov Admin", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Organizar ordem" })).toBeVisible({ timeout: 30000 });
}

test("PIN-only Admin access remains intact and the complete published order can be staged safely", async ({ page }) => {
  test.skip(!process.env["ADMIN_E2E_WITH_BACKEND"], "Full editor test requires a provisioned server-side Supabase Admin backend; no fake login.");
  test.setTimeout(90000);
  await signIn(page);
  await page.getByRole("button", { name: "Organizar ordem" }).click();
  const editor = page.locator("[data-project-order-editor]");
  await expect(editor).toBeVisible();
  const rows = editor.locator("[data-project-sort-id]");
  const count = await rows.count();
  expect(count).toBeGreaterThan(2);
  await expect(rows.first()).toHaveAttribute("data-order-position", "1");
  const original = await rows.first().getAttribute("data-project-sort-id");
  const second = await rows.nth(1).getAttribute("data-project-sort-id");

  // Move work #2 to #1 with the direct-position input; do not publish.
  await rows.nth(1).getByRole("spinbutton", { name: /Posição de/ }).fill("1");
  await rows.nth(1).getByRole("spinbutton", { name: /Posição de/ }).press("Enter");
  await expect(rows.first()).toHaveAttribute("data-project-sort-id", second);
  await expect(editor.getByRole("button", { name: "Guardar e publicar ordem" })).toBeEnabled();
  await editor.getByRole("button", { name: "Desfazer movimento" }).click();
  await expect(rows.first()).toHaveAttribute("data-project-sort-id", original);

  // Search preserves the global ordinal, not the filtered result index.
  const firstTitle = await rows.first().locator("p").first().textContent();
  await editor.getByRole("textbox", { name: "Pesquisar trabalhos para organizar" }).fill((firstTitle || "").trim());
  await expect(rows.first()).toHaveAttribute("data-project-sort-id", original);
  await editor.getByRole("textbox", { name: "Pesquisar trabalhos para organizar" }).fill("");

  // Staging must not mutate the database until the explicit publication confirmation.
  await rows.nth(1).getByRole("button", { name: /^Colocar .* no início$/ }).click();
  await expect(editor.getByText(/por publicar/)).toBeVisible();
  await editor.getByRole("button", { name: "Guardar e publicar ordem" }).click();
  await expect(editor.getByRole("group", { name: "Confirmar publicação da ordem" })).toBeVisible();

  page.once("dialog", dialog => dialog.accept());
  await editor.getByRole("button", { name: "Voltar à galeria" }).click();
  await expect(page.getByRole("button", { name: "Organizar ordem" })).toBeVisible();
  await page.getByRole("button", { name: "Organizar ordem" }).click();
  await expect(page.locator("[data-project-order-editor] [data-project-sort-id]").first())
    .toHaveAttribute("data-project-sort-id", original);
});

test("the original PIN gate still protects the new editor from unauthenticated visitors", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Acesso administrativo." })).toBeVisible();
  await expect(page.locator("[data-project-order-editor]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Organizar ordem" })).toHaveCount(0);
});
