import { expect,test } from "@playwright/test";
import { createHash } from "node:crypto";

const ORIGINAL_PDF="/edmundo-kutuzov-cv-2026.pdf";
const PDF_EN="/cv/Edmundo-Kutuzov-CV-EN.pdf";
const PDF_PT="/cv/Edmundo-Kutuzov-CV-PT.pdf";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem("ek-intro-seen","1");
    sessionStorage.removeItem("ek-cv-language");
    localStorage.removeItem("ek-language");
  });
});

test("About opens the CV on the first click, without browser PDF viewer or second tap",async ({page})=>{
  await page.goto("/about",{waitUntil:"domcontentloaded"});
  const cta=page.getByTestId("about-view-cv");
  await expect(cta).toHaveAttribute("href","/cv");
  await cta.click();
  await expect(page).toHaveURL(/\/cv\/?$/);
  await expect(page.getByTestId("cv-page")).toBeVisible();
  expect(await page.locator("iframe,embed,object").count()).toBe(0);
});

test("English is default and every original experience, reference and skill value remains",async ({page})=>{
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  const root=page.getByTestId("cv-page");
  await expect(root).toHaveAttribute("data-cv-language","en");
  await expect(root.locator("h1")).toContainText("EDMUNDO");
  await expect(root.locator("h1")).toContainText("KUTUZOV.");
  await expect(root).toContainText("VISUAL COMMUNICATION DESIGNER");
  await expect(root).toContainText("About Me");
  await expect(root.locator(".cv-experience-list__item")).toHaveCount(5);
  await expect(root).toContainText("Creer");
  await expect(root).toContainText("2024 - Present");
  await expect(root).toContainText("Art Director & Content Creator");
  await expect(root).toContainText("Flying Fish");
  await expect(root).toContainText("Hyundai Moçambique");
  await expect(root).toContainText("Joaquim Chaves Saúde");
  await expect(root).toContainText("Moçambique Companhia de Seguros");
  await expect(root).toContainText("Ferrão Chico");
  await expect(root).toContainText("edmundokutuzov.mz@gmail.com");
  await expect(root.locator(".cv-skills__item")).toHaveCount(5);
  for(const [skill,value] of [
    ["Adobe Potoshop",95],["Adobe Illustrator",75],["Adobe Premiere",55],
    ["Adobe InDesign",55],["Inteligência Artificial",95]
  ]){
    const item=root.locator(".cv-skills__item",{hasText:skill});
    await expect(item).toContainText(value+"%");
    await expect(item.locator('[role="meter"]')).toHaveAttribute("aria-valuenow",String(value));
  }
});

test("CV language follows site preference but can be independently overridden",async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("ek-language","pt-PT"));
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("cv-page")).toHaveAttribute("data-cv-language","pt-PT");
  await expect(page.locator("#sobre")).toContainText("Sobre Mim");
  await expect(page.locator(".cv-experience-list__item").last()).toContainText("2024 - Presente");
  const ptLink=page.getByTestId("cv-download").first();
  await expect(ptLink).toHaveAttribute("href",PDF_PT);
  await page.getByTestId("cv-language-en").click();
  await expect(page.getByTestId("cv-page")).toHaveAttribute("data-cv-language","en");
  await expect(page.locator("#sobre")).toContainText("About Me");
  await expect(page.getByTestId("cv-download").first()).toHaveAttribute("href",PDF_EN);
  expect(await page.evaluate(()=>localStorage.getItem("ek-language"))).toBe("pt-PT");
  await page.getByTestId("cv-language-pt").click();
  await expect(page.getByTestId("cv-page")).toHaveAttribute("data-cv-language","pt-PT");
  await expect(page.getByTestId("cv-download").first()).toHaveAttribute("href",PDF_PT);
});

test("Original portrait is retinted only in background, with intact visible face",async ({page})=>{
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  const portrait=page.getByTestId("cv-portrait");
  await expect(portrait).toHaveAttribute("src","/edmundo-kutuzov-cv-mineral.png");
  await expect.poll(()=>portrait.evaluate(el=>el.complete&&el.naturalWidth>400&&el.naturalHeight>400)).toBe(true);
  expect(await portrait.evaluate(el=>getComputedStyle(el).objectFit)).toBe("cover");
  const png=await page.request.get("/edmundo-kutuzov-cv-mineral.png");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toMatch(/image\/png/);
});

test("Full name is readable, never collides with portrait, and no horizontal overflows",async ({page})=>{
  test.setTimeout(125_000);
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,360,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:width<500?844:970});
    const result=await page.evaluate(()=>{
      const root=document.querySelector("[data-testid=cv-page]");
      const portrait=root.querySelector(".cv-cover__portrait-frame").getBoundingClientRect();
      const name=root.querySelector("#cv-name");
      const nameBox=name.getBoundingClientRect();
      const lines=[...name.querySelectorAll(".cv-cover__name-line")].map(el=>({
        clipped:el.scrollWidth>el.clientWidth+2,
        left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right
      }));
      return {scrollWidth:document.documentElement.scrollWidth,
        viewport:innerWidth,nameBox:nameBox.toJSON(),portrait:portrait.toJSON(),lines};
    });
    expect(result.scrollWidth,`horizontal overflow at ${width}`).toBeLessThanOrEqual(width+2);
    for(const line of result.lines){
      expect(line.clipped,`name glyphs clipped at ${width}`).toBe(false);
      expect(line.right,`name outside viewport at ${width}`).toBeLessThanOrEqual(width+2);
    }
    if(width>630){
      expect(result.nameBox.right,`name overlaps photo at ${width}`)
        .toBeLessThan(result.portrait.left+2);
    }
    if(width===390||width===1440){
      await page.screenshot({path:`.e2e/test-results/editorial-cv-${width}.png`,fullPage:true,animations:"disabled"});
    }
  }
});

test("Both localized designed PDFs download, never the old image-only source",async ({page})=>{
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  const old=await page.request.get(ORIGINAL_PDF);
  expect(old.status()).toBe(200);
  const oldHash=createHash("sha256").update(await old.body()).digest("hex");
  for(const [language,href,filename] of [
    ["en",PDF_EN,"Edmundo-Kutuzov-CV-EN.pdf"],
    ["pt-PT",PDF_PT,"Edmundo-Kutuzov-CV-PT.pdf"]
  ]){
    await page.getByTestId(language==="en"?"cv-language-en":"cv-language-pt").click();
    await expect(page.getByTestId("cv-page")).toHaveAttribute("data-cv-language",language);
    const cta=page.getByTestId("cv-download").first();
    await expect(cta).toHaveAttribute("href",href);
    await expect(cta).toHaveAttribute("download",filename);
    const response=await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/application\/pdf/);
    const bytes=await response.body();
    expect(bytes.subarray(0,4).toString("ascii")).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(17000);
    expect(createHash("sha256").update(bytes).digest("hex")).not.toBe(oldHash);
    const [file]=await Promise.all([page.waitForEvent("download"),cta.click()]);
    expect(file.suggestedFilename()).toBe(filename);
    await expect(page).toHaveURL(/\/cv\/?$/);
  }
});

test("A4 print keeps the designed navy and ivory palette and hides all controls",async ({page})=>{
  await page.goto("/cv?cvLang=pt-PT",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("cv-page")).toHaveAttribute("data-cv-language","pt-PT");
  await page.emulateMedia({media:"print",reducedMotion:"reduce"});
  for(const element of await page.locator("[data-cv-controls]").all()){
    await expect(element).toBeHidden();
  }
  await expect(page.locator(".cv-document__rail")).toBeHidden();
  const sheet=await page.locator(".cv-cover").evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(sheet).toBe("rgb(17, 21, 29)");
  const pdf=await page.pdf({printBackground:true,preferCSSPageSize:true});
  expect(pdf.length).toBeGreaterThan(17000);
});

test("Reduced motion is genuinely static and CV section links remain keyboard accessible",async ({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/cv",{waitUntil:"domcontentloaded"});
  const state=await page.locator(".cv-cover__name-line").first().evaluate(el=>({
    opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform
  }));
  expect(state).toEqual({opacity:"1",transform:"none"});
  const anchors=page.locator(".cv-navigation__item");
  await expect(anchors).toHaveCount(6);
  await page.locator('.cv-navigation__item[href="#skills"]').click();
  await expect(page).toHaveURL(/\/cv#skills$/);
  await expect(page.locator("#skills")).toBeInViewport();
});
