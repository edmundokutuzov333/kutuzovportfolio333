import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(join(ROOT, ".e2e/node_modules/@playwright/test"));
const URL = "http://127.0.0.1:5173";
const OUT = join(ROOT, "public/cv");
mkdirSync(OUT,{recursive:true});

const server=spawn("bun",["run","dev","--host","127.0.0.1","--port","5173","--strictPort"],{
  cwd:ROOT,env:{...process.env,CI:"true"},stdio:["ignore","pipe","pipe"]
});
let logs="";
server.stdout?.on("data",data=>{logs+=data.toString();logs=logs.slice(-5000)});
server.stderr?.on("data",data=>{logs+=data.toString();logs=logs.slice(-5000)});

async function health(){
  for(let n=0;n<130;n++){
    if(server.exitCode!==null)throw new Error("Site dev server exited: "+logs);
    try{
      const response=await fetch(URL+"/cv");
      if(response.status===200)return;
    }catch{/* Not listening yet. */}
    await new Promise(resolve=>setTimeout(resolve,900));
  }
  throw new Error("CV server did not start: "+logs);
}

let browser;
try{
  await health();
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const [locale,code] of [["en","EN"],["pt-PT","PT"]]){
    const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    const response=await page.goto(URL+"/cv?cvLang="+encodeURIComponent(locale),{waitUntil:"domcontentloaded"});
    if(response?.status()!==200)throw Error("CV URL failed in "+locale);
    await page.locator('[data-testid="cv-page"][data-cv-language="'+locale+'"]').waitFor();
    if(await page.locator('[aria-label="Intro — click to enter"]').count()){
      throw new Error("The Home intro is covering the CV: refusing to export an obscured PDF");
    }
    await page.evaluate(async()=>{
      await document.fonts.ready;
      const portrait=document.querySelector('[data-testid="cv-portrait"]');
      if(portrait&&!portrait.complete)await new Promise(resolve=>{portrait.onload=resolve;portrait.onerror=resolve;});
    });
    const name=await page.locator("#cv-name").innerText();
    if(!name.includes("EDMUNDO")||!name.includes("KUTUZOV."))throw Error("Missing name in "+locale);
    // Print CSS uses the same semantic document, colors, portrait and typography;
    // only navigation/actions are hidden.
    await page.emulateMedia({media:"print",reducedMotion:"reduce"});
    const removed=await page.locator("[data-cv-controls]").first().evaluate(el=>getComputedStyle(el).display);
    if(removed!=="none")throw Error("PDF would print download/print controls: "+locale);
    const output=join(OUT,"Edmundo-Kutuzov-CV-"+code+".pdf");
    const bytes=await page.pdf({
      path:output,printBackground:true,preferCSSPageSize:true,
      displayHeaderFooter:false,scale:1
    });
    if(bytes.length<17000)throw Error("Suspiciously small CV PDF "+locale);
    await page.close();
    console.log(JSON.stringify({locale,output,bytes:bytes.length,htmlSource:"/cv",
      noControls:true,photo:"/edmundo-kutuzov-cv-mineral.png"}));
  }
}finally{
  await browser?.close();
  server.kill("SIGTERM");
}
