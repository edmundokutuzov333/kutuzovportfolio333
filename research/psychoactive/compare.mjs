import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const output=process.env.OUTPUT_DIR;
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const results=[];
for(const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]) {
 for(const [name,url] of [["source","https://www.psychoactive.co.nz/"],["reference","https://edmundokutuzov333.github.io/kutuzovportfolio333/"]]) {
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:"reduce"});
  const page=await context.newPage();
  try {
   const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
   await page.locator("h1").first().waitFor({state:"attached"});
   await page.waitForTimeout(5000);
   await page.screenshot({path:output+"/"+name+"-"+viewport.width+".png",animations:"disabled"});
   const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
   results.push({name,url,viewport,status:response.status(),metrics});
  } catch(error){results.push({name,url,viewport,error:String(error)});}
  await context.close();
 }
}
await browser.close();
await writeFile(output+"/comparison.json",JSON.stringify({capturedAt:new Date().toISOString(),note:"Same Chromium, viewport, DPR and reduced motion. Dynamic media and different content prevent a pixel-equivalence claim.",results},null,2));
console.log(JSON.stringify(results));
if(results.some(r=>r.error)) process.exitCode=1;
