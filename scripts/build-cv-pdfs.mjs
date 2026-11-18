import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(join(ROOT, ".e2e/node_modules/@playwright/test"));
const URL = "http://127.0.0.1:5173";
const OUT = join(ROOT, "public/cv");
mkdirSync(OUT,{recursive:true});
const TEMP=mkdtempSync(join(tmpdir(),"ek-cv-onepage-"));
const generated=[];

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

function validatePdf(file, locale) {
  const info=execFileSync("pdfinfo",[file],{encoding:"utf8"});
  const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
  if(pages!==1)throw new Error("CV "+locale+" must be exactly one A4 page (got "+pages+").");
  if(!/Page size:\s*59[45].*84[12].*A4/m.test(info))throw new Error("CV "+locale+" is not A4.");
  const text=execFileSync("pdftotext",["-layout",file,"-"],{encoding:"utf8"});
  for(const required of ["EDMUNDO","KUTUZOV.","WEBMASTERS","Flying Fish","Hyundai","Ferrão Chico","contact@edmundokutuzov.art"]) {
    if(!text.includes(required))throw new Error("CV "+locale+" missing PDF text: "+required);
  }
  if(text.includes("edmundokutuzov.mz@gmail.com"))throw new Error("CV "+locale+" contains an obsolete email");
  for(const forbidden of ["Download designed CV","Descarregar CV actual","Print CV","Imprimir CV"]) {
    if(text.includes(forbidden))throw new Error("CV "+locale+" leaked an on-screen control: "+forbidden);
  }
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
    const filename="Edmundo-Kutuzov-CV-"+code+".pdf";
    const output=join(TEMP,filename);
    const bytes=await page.pdf({
      path:output,printBackground:true,preferCSSPageSize:true,
      displayHeaderFooter:false,scale:1
    });
    if(bytes.length<17000)throw Error("Suspiciously small CV PDF "+locale);
    validatePdf(output,locale);
    generated.push({locale,filename,output,bytes:bytes.length});
    await page.close();
  }
  // Publish both PDFs only after both languages pass the same one-page gate.
  for(const item of generated){
    renameSync(item.output,join(OUT,item.filename));
    console.log(JSON.stringify({...item,output:join(OUT,item.filename),
      pages:1,htmlSource:"/cv",noControls:true,photo:"/edmundo-kutuzov-cv-mineral.png"}));
  }
}finally{
  await browser?.close();
  server.kill("SIGTERM");
  rmSync(TEMP,{recursive:true,force:true});
}
