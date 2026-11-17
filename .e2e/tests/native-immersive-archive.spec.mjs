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

test("DISCOVER uses sharp native-ratio previews, not stretched atlas backgrounds",async ({page})=>{
  test.setTimeout(85_000);
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator('[data-testid="explore-overlay"]')).toBeVisible({timeout:45_000});
  let opened=false;
  // Locate a real, visible 3D item, exactly as a visitor would.
  for(let y=190;y<=740&&!opened;y+=82){
    for(let x=235;x<=1170&&!opened;x+=90){
      await page.mouse.move(x,y);
      await page.waitForTimeout(65);
      if(await page.locator('[data-testid="explore-hover-label"]').isVisible()){
        await page.mouse.click(x,y);
        opened=await page.locator('[data-testid="explore-selected-panel"]').isVisible();
      }
    }
  }
  expect(opened,"A visible artwork must be selectable to inspect DISCOVER").toBe(true);
  const tiles=page.locator('[data-testid^="related-work-"]');
  await expect(tiles).toHaveCount(4);
  const images=tiles.locator("img.archive-related__image");
  await expect(images).toHaveCount(4);
  for(const image of await images.all()){
    await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0&&el.naturalHeight>0)).toBe(true);
    const meta=await image.evaluate(el=>{
      const css=getComputedStyle(el),rect=el.getBoundingClientRect();
      return {src:new URL(el.currentSrc).pathname,fit:css.objectFit,
        naturalRatio:el.naturalWidth/el.naturalHeight,
        boxRatio:rect.width/rect.height,width:rect.width,height:rect.height,
        alt:el.alt};
    });
    expect(meta.src).toMatch(/\/work\/immersive\/reel\/thumbs\/\d{3}\.webp$/);
    expect(meta.fit).toBe("contain");
    expect(meta.alt).toBe("");
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    // This tests the image element itself, not only its container's size.
    expect(Math.abs(meta.boxRatio/meta.naturalRatio-1)).toBeLessThan(0.03);
  }
  const nextTitle=await tiles.first().getAttribute("title");
  await tiles.first().click();
  await expect(page.locator('[data-testid="explore-selected-panel"]')).toBeVisible();
  if(nextTitle==="CAMPAIGN"){
    await expect(page.locator(".archive-metadata h2")).toHaveCount(1);
  }else if(nextTitle!=="CAMPAIGN"){
    // Individual artwork titles are deliberately hidden; campaign titles remain.
    const headings=page.locator(".archive-metadata h2");
    const count=await headings.count();
    if(count)await expect(headings).toHaveText(nextTitle);
  }
});

test("the seven video items also have true-proportion local posters",async ({page})=>{
  const response=await page.request.get("/work/immersive/reel/thumbs/manifest.json");
  expect(response?.status()).toBe(200);
  const manifest=await response.json();
  expect(manifest.count).toBe(155);
  expect(manifest.totalBytes).toBeLessThan(5_000_000);
  for(const entry of manifest.items){
    const [sw,sh]=entry.original,[tw,th]=entry.thumbnail;
    expect(tw).toBeGreaterThan(0);
    expect(th).toBeGreaterThan(0);
    expect(Math.abs((tw/th)/(sw/sh)-1)).toBeLessThanOrEqual(0.025);
  }
  expect(manifest.items.filter(item=>item.type==="video")).toHaveLength(7);
  for(const id of [148,150,154]){
    const preview=await page.request.get(`/work/immersive/reel/thumbs/${String(id).padStart(3,"0")}.webp`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-type"]).toContain("image/webp");
  }
});
