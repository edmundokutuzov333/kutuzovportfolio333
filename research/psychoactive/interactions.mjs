import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
const require = createRequire(join(process.env.TOOL_ROOT, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const output = "research/psychoactive/evidence";
await mkdir(output,{recursive:true});
const report = { capturedAt:new Date().toISOString(), states:[], api:[], protocols:[] };
function shape(value) {
  if(value===null)return "null";
  if(Array.isArray(value))return {type:"array",length:value.length,item:value.length?shape(value[0]):null};
  if(typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shape(item)]));
  return typeof value;
}
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
cdp.on("Network.responseReceived",({response})=>{if(response.url.startsWith("https://www.psychoactive.co.nz")) report.protocols.push({path:new URL(response.url).pathname,protocol:response.protocol,status:response.status,mime:response.mimeType});});
page.on("response",async response=>{
  if(!response.url().includes("/api/"))return;
  let requestShape=null,responseShape=null;
  try{requestShape=shape(response.request().postDataJSON());}catch{}
  try{responseShape=shape(await response.json());}catch{}
  report.api.push({url:response.url(),method:response.request().method(),status:response.status(),requestShape,responseShape,contentType:response.headers()["content-type"]});
});
async function state(name) {
  report.states.push({name,url:page.url(),data:await page.evaluate(()=>({
    text:document.querySelector("main")?.innerText.slice(0,14000),
    controls:[...document.querySelectorAll("input,button,[role=tab],details")].filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=="hidden").map(e=>({tag:e.tagName,id:e.id,text:e.textContent.trim().slice(0,100),type:e.type,disabled:e.disabled,expanded:e.getAttribute("aria-expanded"),selected:e.getAttribute("aria-selected")})),
    localKeys:Object.keys(localStorage),sessionKeys:Object.keys(sessionStorage)
  }))});
}
try {
  await page.goto("https://www.psychoactive.co.nz/");
  await page.waitForTimeout(2000);
  report.rootTokens = await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries([...s].filter(k=>k.startsWith("--")).map(k=>[k,s.getPropertyValue(k)]));});
  const title = page.locator('h3 a[href="/work/super-ai"]');
  report.card = await title.evaluate(e=>{const nodes=[];for(let n=e.parentElement;n&&nodes.length<5;n=n.parentElement){const s=getComputedStyle(n),r=n.getBoundingClientRect();nodes.push({tag:n.tagName,class:n.className,width:r.width,height:r.height,gap:s.gap,padding:s.padding,radius:s.borderRadius,columns:s.gridTemplateColumns});}return nodes;});
  const sample = async()=>page.locator('h3 a[href="/work/super-ai"]').evaluate(e=>{const n=e.closest("article")||e.parentElement.parentElement;return [...n.querySelectorAll("*")].slice(0,35).map(x=>{const s=getComputedStyle(x);return {tag:x.tagName,class:x.className,transform:s.transform,transition:s.transition,opacity:s.opacity,filter:s.filter};});});
  report.hoverBefore = await sample();
  await title.hover();
  await page.waitForTimeout(900);
  report.hoverAfter = await sample();
  await page.screenshot({path:join(output,"desktop-home.png")});
  await page.getByRole("tab",{name:/Awwwards/}).click();
  await state("awwwards-tab");
  await page.getByRole("button",{name:/Next awards/}).click();
  await state("awwwards-next");
  for(const width of [390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    report.states.push({name:"viewport-"+width,data:await page.evaluate(()=>({
      nav:[...document.querySelectorAll("header button")].filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.textContent.trim(),label:e.getAttribute("aria-label"),rect:e.getBoundingClientRect().toJSON()})),
      audit:document.querySelector("#promo-audit-url")?.getBoundingClientRect().toJSON()
    }))});
  }
  await page.goto("https://www.psychoactive.co.nz/design-audit");
  await page.waitForTimeout(1500);
  await state("audit-empty");
  await page.locator("#audit-url").fill("not a url");
  await page.getByRole("button",{name:/Audit my site/i}).click();
  await page.waitForTimeout(2000);
  await state("audit-invalid");
  await page.locator("#audit-url").fill("example.com");
  await page.getByRole("button",{name:/Audit my site/i}).click();
  await state("audit-processing");
  await page.getByRole("button",{name:/Copy link/i}).waitFor({state:"visible",timeout:90000});
  await state("audit-result");
  await page.screenshot({path:join(output,"audit-result.png"),fullPage:true});
  await page.goto("https://www.psychoactive.co.nz/content-hub");
  await page.getByRole("button",{name:"Resources",exact:true}).click();
  await state("feed-resources");
  await page.goto("https://www.psychoactive.co.nz/about");
  await page.getByRole("button",{name:/Where is Psychoactive based/}).click();
  await state("about-faq-open");
} catch(error) {
  report.error={message:error.message,stack:error.stack};
} finally {
  report.protocols=[...new Map(report.protocols.map(x=>[JSON.stringify(x),x])).values()];
  await writeFile(join(output,"interactions.json"),JSON.stringify(report,null,2));
  console.log("INTERACTIONS "+JSON.stringify(report));
  await browser.close();
}
