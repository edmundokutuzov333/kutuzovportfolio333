import { createRequire } from "node:module";
import { join } from "node:path";
const require = createRequire(join(process.env.TOOL_ROOT, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto("http://127.0.0.1:4178/#/design-audit");
  await page.getByLabel("Endereço do site").fill("bad url");
  await page.getByRole("button",{name:"Iniciar auditoria"}).click();
  await page.getByRole("alert").filter({hasText:"espaços"}).waitFor();
  await page.getByLabel("Endereço do site").fill("example.com");
  await page.getByRole("button",{name:"Iniciar auditoria"}).click();
  await page.locator('[data-state="success"]').waitFor();
  if(await page.locator(".score strong").innerText()!=="42")throw new Error("Unexpected score");
  await page.getByRole("button",{name:"Menu",exact:true}).click();
  await page.getByRole("dialog",{name:"Navegação principal"}).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog",{name:"Navegação principal"}).waitFor({state:"hidden"});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  if(overflow)throw new Error("Mobile horizontal overflow");
  if(errors.length)throw new Error(errors.join("\n"));
  console.log(JSON.stringify({auditValidation:true,auditMock42:true,menuEscape:true,mobileOverflow:false,pageErrors:errors}));
}finally{await browser.close();}
