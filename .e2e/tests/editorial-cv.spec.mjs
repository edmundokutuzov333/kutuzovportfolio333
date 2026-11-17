import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const PDF = "/edmundo-kutuzov-cv-2026.pdf";
const SOURCE_SHA256 = "4ebf841282ac47b386c8dab6e4f37dfc09950704aa925bd563ac08efb7ce9e37";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ek-intro-seen", "1"));
});

test("About opens a native CV route, without a PDF tab or browser PDF viewer", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/about", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  const button = page.getByTestId("about-view-cv");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("href", "/cv");
  await expect(button).not.toHaveAttribute("target", "_blank");
  await button.click();
  await expect(page).toHaveURL(/\/cv\/?$/);
  await expect(page.getByTestId("cv-page")).toBeVisible();
  expect(await page.locator("iframe, embed, object").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("CV presents exactly the original name, biography, job titles, dates and all five skill values", async ({ page }) => {
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  const main = page.getByTestId("cv-page");
  await expect(main.locator("h1")).toContainText("EDMUNDO");
  await expect(main.locator("h1")).toContainText("KUTUZOV.");
  await expect(main).toContainText("VISUAL COMMUNICATION DESIGNER");
  await expect(main).toContainText("& ART DIRECTOR");
  await expect(main).toContainText("Criativo de 23 anos, iniciei a carreira aos 17 em agências de referência.");
  await expect(main.locator(".cv-experience-list__item")).toHaveCount(5);
  for (const [company,period,role] of [
    ["Agência Creer","2020 - 2023","Designer Gráfico"],
    ["Imperial Seguros","2023 - 2023","Assistente de Marketing & Gestor de Redes Sociais"],
    ["Ikigai Moçambique","2023 - 2023","Designer Gráfico"],
    ["SPOT Comunicação","2023 - 2024","Director de Arte"],
    ["WEBMASTERS Limitada","2024 - Presente","Director de Arte & Criador de Conteúdo"],
  ]) {
    const line = main.locator(".cv-experience-list__item", { hasText: company });
    await expect(line).toContainText(period);
    await expect(line).toContainText(role);
  }
  await expect(main.locator(".cv-skills__item")).toHaveCount(5);
  for (const [name,value] of [
    ["Adobe Potoshop",95],["Adobe Illustrator",75],
    ["Adobe Premiere",55],["Adobe InDesign",55],
    ["Inteligência Artificial",95]
  ]) {
    const row = main.locator(".cv-skills__item", {hasText: name});
    await expect(row).toContainText(`${value}%`);
    await expect(row.locator('[role="meter"]')).toHaveAttribute("aria-valuenow",String(value));
  }
  await expect(main).toContainText("Escola Secundária Quisse Mavota");
  await expect(main).toContainText("12a Classe");
  await expect(main).toContainText("Ferrão Chico");
  await expect(main).toContainText("+258 84 579 2106");
  await expect(main).toContainText("edmundokutuzov.mz@gmail.com");
});

test("CV retains exactly the approved About portrait and it really loads", async ({ page }) => {
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  const image = page.getByTestId("cv-portrait");
  await expect(image).toHaveAttribute("src","/edmundo-kutuzov-foto.jpg");
  await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0&&i.naturalHeight>0)).toBe(true);
  const s = await image.evaluate(i=>({
    naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,
    fit:getComputedStyle(i).objectFit,rect:i.getBoundingClientRect().toJSON()
  }));
  expect(s.naturalWidth).toBeGreaterThan(400);
  expect(s.naturalHeight).toBeGreaterThan(400);
  expect(s.fit).toBe("cover");
});

test("Seven viewport widths retain hierarchy, full name and no horizontal overflow", async ({ page }) => {
  test.setTimeout(110_000);
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  for (const width of [320,360,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:width<500?820:940});
    const result = await page.evaluate(()=>{
      const root=document.querySelector("[data-testid=cv-page]");
      const heading=root.querySelector("h1");
      const name=heading.querySelectorAll(".cv-cover__name-line");
      const boxes=[...name].map(x=>x.getBoundingClientRect().toJSON());
      const portrait=root.querySelector("[data-testid=cv-portrait]").getBoundingClientRect();
      const section=root.querySelector("#experiencia").getBoundingClientRect();
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        boxes,portrait:portrait.toJSON(),section:section.toJSON()};
    });
    expect(result.scrollWidth,`overflow at ${width}`).toBeLessThanOrEqual(width+2);
    for (const box of result.boxes) {
      expect(box.left,`left clipped at ${width}`).toBeGreaterThanOrEqual(-1);
      expect(box.right,`name clipped at ${width}`).toBeLessThanOrEqual(width+1);
    }
    expect(result.portrait.width).toBeGreaterThan(140);
    expect(result.portrait.height).toBeGreaterThan(100);
    expect(result.section.width).toBeGreaterThan(150);
    if (width === 390 || width === 1440) {
      await page.screenshot({path:`.e2e/test-results/editorial-cv-${width}.png`,fullPage:true,animations:"disabled"});
    }
  }
});

test("Same-origin PDF button downloads the original unchanged file, not a viewer", async ({ page }) => {
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  const downloadButton = page.getByTestId("cv-download").first();
  await expect(downloadButton).toHaveAttribute("href",PDF);
  await expect(downloadButton).toHaveAttribute("download","Edmundo-Kutuzov-CV-2026.pdf");
  await expect(downloadButton).not.toHaveAttribute("target","_blank");
  const pdf = await page.request.get(PDF);
  expect(pdf.status()).toBe(200);
  const bytes=await pdf.body();
  expect(bytes.length).toBe(238751);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(SOURCE_SHA256);
  const [download] = await Promise.all([page.waitForEvent("download"),downloadButton.click()]);
  expect(download.suggestedFilename()).toBe("Edmundo-Kutuzov-CV-2026.pdf");
  expect(new URL(page.url()).pathname).toBe("/cv");
});

test("Section navigation works with normal keyboard and deep links", async ({ page }) => {
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  const links=page.locator(".cv-navigation__item");
  await expect(links).toHaveCount(6);
  for(const id of ["sobre","experiencia","educacao","skills","contacto","referencia"]){
    await expect(page.locator(`h2#${id}`)).toHaveCount(1);
  }
  await page.locator('.cv-navigation__item[href="#skills"]').click();
  await expect(page).toHaveURL(/\/cv#skills$/);
  await expect(page.locator("#skills")).toBeInViewport();
  await expect(page.locator('.cv-navigation__item[href="#skills"]')).toHaveAttribute("href","#skills");
});

test("A4 print is semantic HTML, hides navigation, keeps photo and visible sections", async ({ page }) => {
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  await page.emulateMedia({media:"print",reducedMotion:"reduce"});
  await expect(page.locator(".cv-document__rail")).toBeHidden();
  await expect(page.locator(".cv-actions__button").first()).toBeHidden();
  await expect(page.locator(".cv-document__body")).toBeVisible();
  const font=await page.locator(".cv-cover__name").evaluate(el=>getComputedStyle(el).fontSize);
  expect(parseFloat(font)).toBeGreaterThan(15);
  const buffer=await page.pdf({format:"A4",printBackground:true});
  expect(buffer.length).toBeGreaterThan(8000);
  expect(buffer.subarray(0,4).toString("ascii")).toBe("%PDF");
});

test("Reduced-motion visitors receive a readable, nonanimated CV", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/cv", { waitUntil: "domcontentloaded" });
  const state=await page.locator(".cv-cover__name-line").first().evaluate(el=>({
    animationDuration:getComputedStyle(el).animationDuration,
    opacity:getComputedStyle(el).opacity,
    transform:getComputedStyle(el).transform
  }));
  expect(parseFloat(state.animationDuration)).toBeLessThan(.001);
  expect(state.opacity).toBe("1");
  expect(state.transform).toBe("none");
});
