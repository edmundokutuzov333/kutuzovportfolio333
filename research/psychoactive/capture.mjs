import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const require = createRequire(join(process.env.TOOL_ROOT, "package.json"));
const { chromium } = require("playwright");
const run = promisify(execFile);
const output = "research/psychoactive/evidence";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--remote-debugging-port=9222"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
const requests = [];
page.on("response", response => {
  const url = new URL(response.url());
  requests.push({ method: response.request().method(), origin: url.origin, path: url.pathname, queryKeys: [...url.searchParams.keys()], status: response.status(), contentType: response.headers()["content-type"] });
});
const report = { capturedAt: new Date().toISOString(), tool: "rea-agents@6.8.0", pages: [], requests };
const paths = ["/", "/work", "/about", "/services", "/clients", "/content-hub", "/contact", "/work/super-ai"];
try {
  for (const path of paths) {
    await page.goto("https://www.psychoactive.co.nz" + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const observation = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      headings: [...document.querySelectorAll("h1,h2,h3")].filter(e => e.getBoundingClientRect().width > 1).map(e => ({ text: e.textContent.trim(), tag: e.tagName })),
      links: [...document.querySelectorAll("a[href]")].map(e => ({ text: e.textContent.trim().slice(0,100), href: e.getAttribute("href") })),
      forms: [...document.querySelectorAll("input,textarea,select,button")].filter(e=>e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,type:e.type,name:e.name,id:e.id,text:e.textContent.trim().slice(0,100),placeholder:e.placeholder,required:e.required})),
      tokens: [...document.querySelectorAll("body,h1,h2,h3,header,footer,input")].filter(e=>e.getBoundingClientRect().width>1).slice(0,35).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:e.textContent.trim().slice(0,60),font:s.fontFamily,size:s.fontSize,line:s.lineHeight,weight:s.fontWeight,color:s.color,background:s.backgroundColor,padding:s.padding,gap:s.gap,radius:s.borderRadius,letterSpacing:s.letterSpacing,width:r.width};}),
      images: [...document.images].map(e=>({alt:e.alt,url:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight})),
      media: [...document.querySelectorAll("video,source")].map(e=>({tag:e.tagName,src:e.getAttribute("src"),type:e.getAttribute("type")})),
      scripts: [...document.scripts].filter(e=>e.src).map(e=>e.src),
      storageKeys: { local: Object.keys(localStorage), session: Object.keys(sessionStorage) }
    }));
    report.pages.push(observation);
    if (path === "/") {
      const targets = await fetch("http://127.0.0.1:9222/json/list").then(r=>r.json());
      const target = targets.find(t=>t.type==="page" && t.url.startsWith("https://www.psychoactive.co.nz"));
      if (!target) throw new Error("REA target was not discovered");
      const args = [join(process.env.TOOL_ROOT,"node_modules/rea-agents/scripts/rea.mjs"), "inspect-web-page", "http://127.0.0.1:9222", target.id, "--observation-ms", "1000", "--include-accessibility-text", "--include-storage-keys", "--json"];
      try {
        const result = await run(process.execPath,args,{timeout:90000,maxBuffer:16*1024*1024});
        await writeFile(join(output,"rea-inspect.json"),result.stdout);
        report.rea = {exit:0,bytes:result.stdout.length};
        console.log("REA_RESULT " + result.stdout.slice(0,7000));
      } catch(error) {
        report.rea = {exit:error.code,message:error.message};
        await writeFile(join(output,"rea-error.txt"),String(error.stderr || error.message));
      }
    }
  }
} finally {
  await writeFile(join(output,"observations.json"),JSON.stringify(report,null,2));
  console.log("OBSERVATIONS " + JSON.stringify(report));
  await browser.close();
}
if (report.rea?.exit !== 0) process.exitCode = 1;
