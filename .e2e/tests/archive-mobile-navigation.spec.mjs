import {test,expect} from "@playwright/test";

test.use({
  hasTouch:true,
  launchOptions:{
    args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
      "--enable-unsafe-swiftshader","--disable-dev-shm-usage"]
  }
});

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("kutuzov-immersive-archive-entered-v2","1");
    sessionStorage.setItem("ek-intro-seen","1");
  });
});

const intersects=(a,b)=>!(a.x+a.width<=b.x||b.x+b.width<=a.x||
  a.y+a.height<=b.y||b.y+b.height<=a.y);

test("No control collisions on the native archive at five responsive widths",async({page})=>{
  test.setTimeout(135_000);
  for(const width of [320,360,390,428,650]){
    await page.setViewportSize({width,height:820});
    await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
    const filters=page.locator(".archive-filters");
    await expect(filters).toBeVisible({timeout:45_000});
    const back=await page.locator("#ek-archive-back").boundingBox();
    const toolbar=await page.locator(".cinema-toolbar").boundingBox();
    const filterBox=await filters.boundingBox();
    expect(back).not.toBeNull();expect(toolbar).not.toBeNull();expect(filterBox).not.toBeNull();
    expect(intersects(back,toolbar),`back overlaps toolbar at ${width}`).toBe(false);
    expect(intersects(back,filterBox),`back overlaps filter icons at ${width}`).toBe(false);
    expect(intersects(toolbar,filterBox),`toolbar overlaps filters at ${width}`).toBe(false);
    const icons=await filters.locator("button").all();
    expect(icons.length).toBe(6);
    for(const icon of icons){
      const b=await icon.boundingBox();
      expect(b.width).toBeGreaterThanOrEqual(36);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x+b.width).toBeLessThanOrEqual(width+2);
    }
    await page.locator('[data-testid="explore-filter-video"]').click();
    await expect(page.locator('[data-testid="explore-filter-video"]')).toHaveAttribute("aria-pressed","true");
    await page.locator('[data-testid="explore-filter-all"]').click();
    await expect(page.locator(".cinema-gesture-guide")).toHaveCount(0);
  }
});

test("Selected artwork uses its own natural aspect, remains scrollable and can return",async({page})=>{
  test.setTimeout(115_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".archive-filters")).toBeVisible({timeout:45_000});
  let opened=false;
  for(let y=165;y<755&&!opened;y+=65){
    for(let x=35;x<365&&!opened;x+=48){
      await page.mouse.move(x,y);
      await page.waitForTimeout(80);
      if(await page.getByTestId("explore-hover-label").isVisible()){
        await page.mouse.click(x,y);
        opened=await page.getByTestId("explore-selected-panel").isVisible();
      }
    }
  }
  expect(opened,"A real gallery artwork should select with one tap").toBe(true);
  const panel=page.getByTestId("explore-selected-panel");
  await expect(panel).toBeVisible();
  const controls=panel.locator(".archive-selected__controls");
  await expect(controls.getByRole("button")).toHaveCount(2);
  const media=panel.locator(".archive-media");
  await expect(media).toHaveCount(1);
  await expect.poll(()=>media.evaluate(el=>el.tagName==="VIDEO"?
    el.readyState>=1:(el.complete&&el.naturalWidth>0))).toBe(true);
  const dimensions=await media.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const w=el.videoWidth||el.naturalWidth,h=el.videoHeight||el.naturalHeight;
    return {w,h,displayWidth:r.width,displayHeight:r.height,
      fit:getComputedStyle(el).objectFit,panelHeight:el.closest(".archive-selected").clientHeight,
      scrollHeight:el.closest(".archive-selected").scrollHeight,
      touchAction:getComputedStyle(el.closest(".archive-selected")).touchAction};
  });
  expect(dimensions.w).toBeGreaterThan(0);
  expect(dimensions.h).toBeGreaterThan(0);
  expect(dimensions.displayWidth).toBeGreaterThan(0);
  expect(Math.abs((dimensions.displayWidth/dimensions.displayHeight)/(dimensions.w/dimensions.h)-1))
    .toBeLessThan(.045);
  expect(dimensions.touchAction).toContain("pan-y");
  expect(dimensions.fit).toBe("contain");
  await panel.evaluate(el=>el.scrollTop=Math.max(0,el.scrollHeight-el.clientHeight));
  await expect(panel.getByTestId("explore-close-selected")).toBeVisible();
  await panel.getByTestId("explore-close-selected").click();
  await expect(panel).toHaveCount(0);
});

test("Pinch and one-finger orbit do not select an artwork or produce JS errors",async({page})=>{
  test.setTimeout(95_000);
  await page.setViewportSize({width:390,height:844});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/work/immersive/index.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".archive-filters")).toBeVisible({timeout:45_000});
  const cdp=await page.context().newCDPSession(page);
  const p=(x,y,id)=>({x,y,id});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p(132,420,1)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[p(182,458,1)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[p(218,477,1)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p(125,385,1),p(245,385,2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[p(97,385,1),p(278,385,2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[p(85,385,1),p(290,385,2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(page.getByTestId("explore-selected-panel")).toHaveCount(0);
  await expect(page.locator('[data-testid="reel-canvas"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("Work hides individual titles, keeps campaign titles and preserves project links",async({page})=>{
  await page.goto("/work",{waitUntil:"domcontentloaded"});
  const nonCampaign=page.locator('a[data-work-campaign="false"]');
  const campaign=page.locator('a[data-work-campaign="true"]');
  expect(await nonCampaign.count()).toBeGreaterThan(0);
  expect(await campaign.count()).toBeGreaterThan(0);
  await expect(nonCampaign.locator("h3")).toHaveCount(0);
  expect(await campaign.locator("h3").count()).toBeGreaterThan(0);
  const slug=await nonCampaign.first().getAttribute("href");
  await nonCampaign.first().click();
  await expect(page).toHaveURL(new RegExp(slug?.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$"));
  const heading=page.locator("h1");
  await expect(heading).toHaveClass(/sr-only/);
});

test("Menu navigates at the very first click on all public routes",async({page})=>{
  test.setTimeout(140_000);
  for(const route of ["/","/work","/about","/services","/process","/clients","/contact"]){
    await page.goto("/about",{waitUntil:"domcontentloaded"});
    const toggle=page.locator("header button[aria-expanded]");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded","true");
    const link=page.locator('.fixed.inset-0.z-40 nav a[href="'+route+'"]').first();
    await expect(link).toBeVisible();
    await link.click(); // Exactly one click: no retry or second interaction
    await expect(page).toHaveURL(new RegExp((route==="/"?"/":route)+"/?$"));
    await expect(page.locator("header button[aria-expanded]")).toHaveAttribute("aria-expanded","false");
  }
});
