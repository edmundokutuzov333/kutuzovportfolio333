/* Live Chromium smoke test for the built immersive archive. No test mocks. */
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");

const ROOT=path.resolve(__dirname,"../build");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",
  ".css":"text/css",".json":"application/json",".webp":"image/webp",
  ".mp4":"video/mp4",".svg":"image/svg+xml",".woff2":"font/woff2",
  ".png":"image/png",".ico":"image/x-icon"};

function serve(req,res){
  let resource;
  try{resource=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}
  catch{res.writeHead(400).end();return;}
  if(resource.includes("..")){res.writeHead(403).end();return;}
  let file=path.resolve(ROOT,"."+resource);
  if(!file.startsWith(ROOT)){res.writeHead(403).end();return;}
  if(!path.extname(file))file=path.join(file,"index.html");
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile())file=path.join(ROOT,"index.html");
    fs.readFile(file,(error,body)=>{
      if(error){res.writeHead(404).end("Missing asset");return;}
      res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream",
        "Cache-Control":"no-store"});
      res.end(body);
    });
  });
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function exercise(browser,opts){
  const context=await browser.newContext({
    viewport:opts.mobile?{width:390,height:844}:{width:1440,height:900},
    deviceScaleFactor:1,isMobile:opts.mobile,hasTouch:opts.mobile
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",response=>{
    const url=response.url();
    if(url.startsWith("http://127.0.0.1:4173/")&&response.status()>=400)
      errors.push(`HTTP ${response.status()} ${url}`);
  });
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator('[data-testid="reel-canvas"]').waitFor({timeout:15000});
  assert.equal(await page.locator('[data-testid="skip-intro"]').count(),0,
    "Skip-intro must not exist");
  await page.locator('[data-testid="explore-overlay"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-testid^="explore-filter-"]').count(),6);
  const catalog=await page.evaluate(async()=>(
    await(await fetch("/reel/catalog.json")).json()).items.length);
  assert.equal(catalog,155,"All original works must remain available");

  const videoFilter=page.locator('[data-testid="explore-filter-video"]');
  await videoFilter.click();
  assert.equal(await videoFilter.getAttribute("aria-pressed"),"true");
  await page.locator('[data-testid="explore-filter-all"]').click();

  if(!opts.mobile){
    let clicked=false;
    for(let y=210;y<=660&&!clicked;y+=90){
      for(let x=300;x<=1150&&!clicked;x+=95){
        await page.mouse.move(x,y);
        await sleep(65);
        if(await page.locator('[data-testid="explore-hover-label"]').isVisible()){
          await page.mouse.click(x,y);
          clicked=await page.locator('[data-testid="explore-selected-panel"]').isVisible();
        }
      }
    }
    assert.equal(clicked,true,"Raycast click should open a visible 3D work");
    assert.equal(await page.locator('[data-testid^="related-work-"]').count(),4);
    await page.locator('[data-testid="work-next"]').click();
    assert.equal(await page.locator('[data-testid="explore-selected-panel"]').isVisible(),true);
    await page.locator('[data-testid="explore-close-selected"]').click();
    assert.equal(await page.locator('[data-testid="explore-selected-panel"]').count(),0);
  }
  await page.screenshot({path:`/tmp/archive-${opts.mobile?"mobile":"desktop"}.png`,fullPage:true});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator('[data-testid="explore-overlay"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-testid="skip-intro"]').count(),0);
  assert.deepEqual(errors,[],`No runtime or asset errors on ${opts.mobile?"mobile":"desktop"}`);
  console.log(`PASS browser smoke ${opts.mobile?"mobile":"desktop"}: intro, 155 works, filters, navigation, return visit`);
  await context.close();
}

(async()=>{
  if(!fs.existsSync(path.join(ROOT,"index.html")))throw new Error("Run yarn build first");
  const server=http.createServer(serve);
  await new Promise(resolve=>server.listen(4173,"127.0.0.1",resolve));
  const browser=await chromium.launch({headless:true,args:[
    "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
    "--enable-unsafe-swiftshader","--disable-dev-shm-usage"
  ]});
  try{
    await exercise(browser,{mobile:false});
    await exercise(browser,{mobile:true});
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
