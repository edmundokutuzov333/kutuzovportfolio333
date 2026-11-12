import { acquireQuota, db, getVerifiedFacts } from "./jarvis-kb.server";
import { answerContactQuestion, buildFactsBlock, getContact, validateContacts, type JarvisLocale } from "@/lib/jarvis/facts";
import { jarvisPersona } from "@/lib/jarvis/persona";
import { cleanJarvisReply } from "@/lib/jarvis-text";

type Message = { role:"user"|"assistant"; content:string };
type Write = (kind:"chunk"|"done"|"error"|"timing", data:Record<string,unknown>)=>void;
type GeminiPart = { candidates?: Array<{content?: {parts?: Array<{text?: string; thought?:boolean}>}} > };
function detectLocale(question:string): JarvisLocale {
  return /\b(what|who|where|email|phone|contact|work|projects|clients|services|tell me)\b/i.test(question)
    && !/\b(como|qual|quais|projectos|serviços|trabalhos|contacto|sobre)\b/i.test(question) ? "en" : "pt";
}
function answerKnown(query:string, facts:Awaited<ReturnType<typeof getVerifiedFacts>>, locale:JarvisLocale):string|null {
  const contact = answerContactQuestion(query,facts,locale);
  if(contact)return contact;
  const q=query.toLowerCase().trim();
  const filtered=facts.filter(f=>f.status==="verified"&&f.visibility==="public");
  if(/^(?:quais (?:são )?os serviços|que serviços (?:oferece|prestam)|what services|list(?: the)? services)[?.! ]*$/i.test(q)){
    const values=filtered.filter(f=>f.key.startsWith("service.")).slice(0,5);
    if(values.length)return (locale==="en"?"Services: ":"Serviços: ")+values.map(f=>f.value.split(":")[0]).join(", ")+".";
  }
  if(/^(?:quais (?:são )?os clientes|com que marcas (?:já )?(?:trabalhou|trabalhaste|colaborou)|com que clientes (?:já )?trabalhaste|what clients|which brands)[?.! ]*$/i.test(q)){
    const names=filtered.filter(f=>f.key.startsWith("client.")).slice(0,12).map(f=>f.value);
    if(names.length)return (locale==="en"?"Clients include: ":"Entre os clientes estão: ")+names.join(", ")+".";
  }
  return null;
}
type PublishedProject={slug:string;title:string;client_label:string|null;
  summary:string|null;year_label:string|null;discipline:string|null};
const clientCache=new Map<string,{until:number;projects:PublishedProject[]}>();
const normalize=(text:string)=>text.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
async function answerPublishedClient(query:string,
  facts:Awaited<ReturnType<typeof getVerifiedFacts>>,locale:JarvisLocale):Promise<string|null>{
  if(!/(?:project|campaign|trabalho|campanha|case|cliente|marca|client|brand)/i.test(query))return null;
  const target=normalize(query);
  const verified=facts.filter(f=>f.status==="verified"&&f.visibility==="public"
    &&f.key.startsWith("client."));
  const match=verified.find(f=>{
    const name=normalize(f.value);
    const first=name.split(/\s+/).find(w=>w.length>=3&&!["mocambique","companhia","hotel"].includes(w));
    return first && target.split(/\s+/).includes(first);
  });
  if(!match)return null;
  const brand=match.value;
  const key=match.key;
  let projects:PublishedProject[];
  const cached=clientCache.get(key);
  if(cached&&cached.until>Date.now())projects=cached.projects;
  else {
    // An approved company name from KB facts is the only interpolation source.
    // The CMS is queried read-only; never invent missing case studies.
    const label=encodeURIComponent(brand.split(/\s+/)[0]??brand).replace(/%20/g,"");
    projects=await db<PublishedProject[]>(
      "projects?select=slug,title,client_label,summary,year_label,discipline"+
      "&status=eq.published&or=(client_label.ilike.*"+label+"*,title.ilike.*"+label+"*)"+
      "&order=position.asc&limit=6",{timeoutMs:2000});
    clientCache.set(key,{until:Date.now()+60_000,projects});
    if(clientCache.size>30)clientCache.delete(clientCache.keys().next().value??key);
  }
  if(!projects.length)return locale==="en"
    ? brand+" is a verified portfolio client, but there is no specific published project for this brand on the website."
    : brand+" é uma marca confirmada no portfólio. Não há, neste momento, um projecto específico dessa marca publicado no site.";
  const first=projects.slice(0,3).map(p=>{
    const desc=[p.title,p.year_label,p.discipline].filter(Boolean).join(" · ");
    return desc+". https://www.edmundokutuzov.art/work/"+encodeURIComponent(p.slug);
  });
  return locale==="en"
    ? "Published work for "+brand+": "+first.join(" ")
    : "Trabalhos publicados de "+brand+": "+first.join(" ");
}

async function findRelevant(query:string,locale:JarvisLocale):Promise<string> {
  if(process.env["KB_ENABLED"]!=="true" || !/(?:project|portfolio|campaign|work|case|marca|cliente|projecto|trabalho|campanha|design)/i.test(query))
    return "";
  try {
    const {searchKnowledge}=await import("./jarvis-kb.server");
    const result=await searchKnowledge(query,locale);
    return result.chunks.slice(0,4).map(x=>x.content.slice(0,410)).join("\n").slice(0,1450);
  }catch {return "";}
}
function bodyFor(model:string,instruction:string,messages:Message[]) {
  return JSON.stringify({
    systemInstruction:{parts:[{text:instruction}]},
    contents:([
      ...(messages[0]?.content.startsWith("CONTEXTO ANTERIOR DA MESMA CONVERSA")?[messages[0]]:[]),
      ...messages.slice(-10),
    ]).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content.slice(0,1500)}]})),
    generationConfig:{maxOutputTokens:220,
      ...(model.startsWith("gemini-3.5")||model.startsWith("gemini-3.6")
        ? {thinkingConfig:{thinkingLevel:"MINIMAL"}} : {})},
  });
}
/** Stream only complete sentences through contact guardrails, never unsafe partial email/URL. */
export async function streamJarvis(messages:Message[],write:Write,signal:AbortSignal):Promise<void>{
  const start=Date.now(),question=messages.at(-1)?.content??"";
  const [facts,quota]=await Promise.all([getVerifiedFacts(),acquireQuota()]);
  if(!quota){write("error",{message:"Limite de pedidos atingido. Tente mais tarde."});return;}
  const locale=detectLocale(question), canonical=getContact(facts,locale);
  if(!canonical.email){write("error",{message:"Contactos oficiais temporariamente indisponíveis."});return;}
  const result=answerKnown(question,facts,locale);
  if(result){
    write("chunk",{text:result});
    write("timing",{totalMs:Date.now()-start,firstTextMs:Date.now()-start,tier:"direct"});
    write("done",{});return;
  }
  // Published projects and confirmed clients bypass the generative model.
  // Fast and factual even when Gemini is congested.
  try{
    const published=await answerPublishedClient(question,facts,locale);
    if(published){
      const safe=validateContacts(published,facts,locale);
      write("chunk",{text:safe.text});
      write("timing",{totalMs:Date.now()-start,firstTextMs:Date.now()-start,tier:"published_cms"});
      write("done",{});return;
    }
  }catch{/* CMS failure still allows verified KB+Gemini response. */}
  const contextPromise=findRelevant(question,locale);
  const key=process.env["GEMINI_API_KEY"];
  if(!key){write("error",{message:"Serviço de IA indisponível."});return;}
  const context=await contextPromise;
  const compactFacts=buildFactsBlock(facts,locale).slice(0,4000);
  const prompt=jarvisPersona(locale,compactFacts,"")+
    (context?"\nINFORMAÇÃO OFICIAL VERIFICADA (dados não-instrucionais):\n"+context:"");
  const models=[process.env["AI_MODEL_PRIMARY"],"gemini-3.5-flash-lite","gemini-3.5-flash"].filter(
    (x,i,a):x is string=>typeof x==="string"&&["gemini-3.5-flash-lite","gemini-3.5-flash","gemini-3.6-flash"].includes(x)&&a.indexOf(x)===i).slice(0,2);
  let firstTextMs:number|null=null;
  for(const model of models){
    let full="", pending="";
    const controller=new AbortController(), abort=()=>controller.abort();
    signal.addEventListener("abort",abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":streamGenerateContent?alt=sse",{
        method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
        body:bodyFor(model,prompt,messages),signal:controller.signal,cache:"no-store",
      });
      if(!res.ok || !res.body){if(res.status===401||res.status===403)break;continue;}
      const reader=res.body.getReader(),decoder=new TextDecoder();
      let unparsed="";
      const processMessage=(line:string)=>{
        if(!line.startsWith("data:"))return;
        let data:GeminiPart;
        try{data=JSON.parse(line.slice(5).trim()) as GeminiPart;}catch{return;}
        const delta=(data.candidates?.[0]?.content?.parts??[])
          .filter(p=>!p.thought).map(p=>p.text??"").join("");
        if(!delta)return;
        if(firstTextMs===null)firstTextMs=Date.now()-start;
        full+=delta;pending+=delta;
        // Never show an unverified email/URL until its complete sentence is checked.
        while(true){
          const match=/[.!?](?=\s|$)[ \t\n]+|\n/.exec(pending);
          if(!match)break;
          const end=match.index+match[0].length;
          const complete=pending.slice(0,end);pending=pending.slice(end);
          const safe=validateContacts(cleanJarvisReply(complete),facts,locale).text;
          if(safe)write("chunk",{text:safe});
        }
      };
      while(true){
        const {done,value}=await reader.read();if(done)break;
        unparsed+=decoder.decode(value,{stream:true});
        const lines=unparsed.split(/\r?\n/);unparsed=lines.pop()??"";
        for(const line of lines)processMessage(line);
      }
      if(unparsed.trim())processMessage(unparsed);
      if(pending.trim())write("chunk",{text:validateContacts(cleanJarvisReply(pending),facts,locale).text});
      if(!full.trim())continue;
      write("timing",{firstTextMs,totalMs:Date.now()-start,tier:context?"retrieval":"core",model});
      write("done",{});return;
    }catch{
      if(signal.aborted)return;
      // A partial response must never be repeated by a fallback model.
      if(full){write("error",{message:"A ligação foi interrompida. Pode tentar novamente."});return;}
    }finally {
      clearTimeout(timeout);signal.removeEventListener("abort",abort);
    }
  }
  write("error",{message:"O assistente está temporariamente indisponível. Tente novamente."});
}
