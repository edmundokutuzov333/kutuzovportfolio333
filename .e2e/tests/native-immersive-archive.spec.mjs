import {expect,test} from "@playwright/test";

// This route is an independent static React/Three.js document hosted by the
// portfolio itself. No remote iframe, redirect or runtime showreel dependency.
test.use({
  launchOptions: {
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
  },
});

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem("ek-intro-seen","1"));
});

test("the local immersive archive boots 155 artworks and exits back to Work",async ({page})=>{
  test.setTimeout(90_000);
  const errors=[];
  const offDomain=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("request",request=>{
    if(request.url().includes("showreel-kutuzov-v2"))offDomain.push(request.url());
  });
  const response=await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-type"]).toMatch(/text\/html/);
  await expect(page.getByRole("link",{name:/back to work/i})).toBeVisible();
  await expect(page.locator('[data-testid="reel-canvas"]')).toBeVisible({timeout:30_000});
  await expect(page.locator('[data-testid="explore-overlay"]')).toBeVisible({timeout:45_000});
  const catalogue=await page.evaluate(async()=>{
    const response=await fetch("/work/immersive/reel/catalog.json");
    return {ok:response.ok,items:(await response.json()).items};
  });
  expect(catalogue.ok).toBe(true);
  expect(catalogue.items).toHaveLength(155);
  expect(catalogue.items.filter((x)=>x.video)).toHaveLength(7);
  await expect(page.locator('[data-testid="skip-intro"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="explore-filter-"]')).toHaveCount(6);
  await page.locator('[data-testid="explore-filter-video"]').click();
  await expect(page.locator('[data-testid="explore-filter-video"]')).toHaveAttribute("aria-pressed","true");
  await page.locator('[data-testid="explore-filter-all"]').click();
  expect(offDomain).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole("link",{name:/back to work/i}).click();
  await expect(page).toHaveURL(/\/work\/?$/);
  await expect(page.getByRole("heading",{level:1}).first()).toBeVisible();
});

test("the mobile archive stays interactive without importing the source domain",async ({page})=>{
  test.setTimeout(80_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator('[data-testid="reel-canvas"]')).toBeVisible({timeout:30_000});
  await expect(page.locator('[data-testid="explore-overlay"]')).toBeVisible({timeout:45_000});
  const back=page.getByRole("link",{name:/back to work/i});
  await expect(back).toBeVisible();
  const rect=await back.boundingBox();
  expect(rect?.x).toBeGreaterThanOrEqual(0);
  expect((rect?.x??0)+(rect?.width??0)).toBeLessThanOrEqual(390);
  await page.locator('[data-testid="explore-filter-video"]').click();
  await expect(page.locator('[data-testid="explore-filter-video"]')).toHaveAttribute("aria-pressed","true");
});

test("Work CTA is real same-origin navigation, not an intercepted SPA route",async ({page})=>{
  await page.goto("/work",{waitUntil:"domcontentloaded"});
  const button=page.locator('[data-testid="work-immersive-archive-link"]');
  await expect(button).toHaveAttribute("href","/work/immersive/index.html");
  await expect(button).toHaveAttribute("data-native-document","true");
  await button.click();
  await expect(page).toHaveURL(/\/work\/immersive\/index\.html$/);
  await expect(page.locator('[data-testid="reel-canvas"]')).toBeVisible({timeout:30_000});
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5173");
});
