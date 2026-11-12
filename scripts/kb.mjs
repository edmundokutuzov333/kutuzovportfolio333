#!/usr/bin/env node
// JARVIS knowledge: safe, offline, idempotent, server-only data operations.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const hash=s=>createHash("sha256").update(s).digest("hex");
const url=process.env.SUPABASE_URL?.replace(/\/+$/,"");
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const command=process.argv[2]||"audit";
async function db(route,options={}){
 if(!url||!secret)throw Error("Server-only SUPABASE_URL and service key are required");
 const res=await fetch(url+"/rest/v1/"+route,{method:options.method||"GET",
 headers:{"Content-Type":"application/json",apikey:secret,
 ...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret}),
 ...(options.prefer?{Prefer:options.prefer}:{})},
 ...(options.body===undefined?{}:{body:JSON.stringify(options.body)}),
 signal:AbortSignal.timeout(12000),cache:"no-store"});
 if(!res.ok)throw Error("Supabase HTTP "+res.status);
 const body=await res.text();return body?JSON.parse(body):null;
}
async function save(path,content){
 let old="";try{old=await readFile(path,"utf8");}catch{}
 if(old===content)return false;
 await writeFile(path,content,"utf8");return true;
}
const yaml=value=>JSON.stringify(String(value??""));
const front=(type,id,locale,verified)=>[
 "---","id: "+yaml(id),"locale: "+yaml(locale),"visibility: public",
 "source: "+yaml(type),"verified: "+String(verified),
 "source_ref: "+yaml(id),"---",""
].join("\n");
async function sync(){
 const [projects,services,clients]=await Promise.all([
 db("projects?select=slug,title,client_label,year_label,discipline,summary,challenge,idea,outcome&status=eq.published&limit=200&order=position.asc"),
 db("services?select=slug,title,description&is_published=eq.true&limit=50"),
 db("clients?select=slug,name&is_visible=eq.true&limit=100")
 ]);
 const entities=[
 ...projects.map(p=>({id:"project:"+p.slug,title:p.title,text:[
 p.title,"Cliente: "+(p.client_label||""),"Ano: "+(p.year_label||""),
 "Disciplina: "+(p.discipline||""),p.summary,p.challenge,p.idea,p.outcome].filter(Boolean).join("\n\n")})),
 ...services.map(p=>({id:"service:"+p.slug,title:p.title,text:p.title+"\n\n"+(p.description||"")})),
 ...clients.map(p=>({id:"client:"+p.slug,title:p.name,text:p.name+" — marca publicada no portfólio."}))
 ].filter(e=>/^[a-z]+:[a-z0-9_-]{1,120}$/.test(e.id));
 let written=0;
 for(const locale of ["pt","en"]){
  const dir=join(root,"knowledge",locale);await mkdir(dir,{recursive:true});
  for(const e of entities){
   const verified=locale==="pt";
   const body=front("site_db",e.id,locale,verified)+"# "+e.title+"\n\n"+
     (verified?"":"[Translation pending editorial review]\n\n")+e.text+"\n";
   if(await save(join(dir,e.id.replace(":","_")+".md"),body))written++;
  }
 }
 console.log(JSON.stringify({entities:entities.length,filesUpdated:written,
  englishApproval:"pending_review"}));
}
function parseMarkdown(raw,name){
 const m=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
 if(!m)throw Error("Invalid document: "+name);
 const metadata=Object.fromEntries(m[1].split("\n").filter(Boolean).map(line=>{
  const pos=line.indexOf(":");if(pos<0)throw Error("Bad field "+name);
  const key=line.slice(0,pos).trim();let value=line.slice(pos+1).trim();
  try{value=JSON.parse(value);}catch{}return [key,value];
 }));
 if(!["site_db","repo_md","web_public","linkedin_export","instagram_export","facebook_export"].includes(metadata.source)
   ||!metadata.source_ref)throw Error("Unsafe source: "+name);
 return {metadata,content:m[2].trim()};
}
function chunks(text,title){
 const out=[];let current="";
 for(const piece of text.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)){
  const candidate=current?current+"\n\n"+piece:piece;
  if(current&&candidate.split(/\s+/).length>270){out.push(title+" > "+current);current=piece;}
  else current=candidate;
 }
 if(current)out.push(title+" > "+current);
 return out.slice(0,16).map(s=>s.slice(0,1700));
}
async function embed(text){
 if(process.env.KB_EMBED_ENABLED!=="true")return null;
 if(!process.env.GEMINI_API_KEY)throw Error("GEMINI_API_KEY required for explicit embedding");
 const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",{
 method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
 body:JSON.stringify({model:"models/gemini-embedding-001",
 content:{parts:[{text}]},taskType:"RETRIEVAL_DOCUMENT",outputDimensionality:768}),
 signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error("Embedding HTTP "+res.status);
 const values=(await res.json()).embedding?.values;
 if(!Array.isArray(values)||values.length!==768)throw Error("Unexpected embedding response");
 const norm=Math.hypot(...values);return values.map(x=>x/norm);
}
async function ingest(){
 let changed=0,embedded=0,seen=0;
 for(const locale of ["pt","en"]){
  const dir=join(root,"knowledge",locale);let names=[];
  try{names=await readdir(dir);}catch{continue;}
  for(const name of names.filter(n=>n.endsWith(".md")&&n!=="README.md")){
   const {metadata:m,content}=parseMarkdown(await readFile(join(dir,name),"utf8"),name);
   const type=m.source;const sourceRef=m.source_ref;
   const status=type==="site_db"&&m.verified===true?"verified":"pending_review";
   const title=content.match(/^# (.+)/m)?.[1]||String(sourceRef);
   const digest=hash(content);seen++;
   const where="kb_documents?select=id,content_hash,status&source_type=eq."+
      encodeURIComponent(type)+"&source_ref=eq."+encodeURIComponent(sourceRef)+
      "&locale=eq."+locale+"&limit=1";
   const existing=await db(where);
   if(existing[0]?.content_hash===digest&&existing[0]?.status===status)continue;
   const row=await db("kb_documents?on_conflict=source_type%2Csource_ref%2Clocale",{
    method:"POST",prefer:"resolution=merge-duplicates,return=representation",
    body:[{source_type:type,source_ref:sourceRef,title,locale,visibility:"public",
      status,content_hash:digest}]});
   const id=row[0]?.id;if(!id)throw Error("Ingest not acknowledged");
   const parts=chunks(content,title);
   for(let i=0;i<parts.length;i++){
    const vector=await embed(parts[i]);if(vector)embedded++;
    await db("kb_chunks?on_conflict=document_id%2Cchunk_index",{
      method:"POST",prefer:"resolution=merge-duplicates,return=representation",
      body:[{document_id:id,chunk_index:i,locale,content:parts[i],
        metadata:{source:type,source_ref:sourceRef},...(vector?{embedding:vector}:{})}]
    });
   }
   changed++;
  }
 }
 console.log(JSON.stringify({seen,changed,embedded}));
}
async function audit(){
 const [facts,docs]=await Promise.all([
 db("kb_facts?select=key,status,value&limit=250"),
 db("kb_documents?select=id,status&limit=1000")]);
 const invalid=facts.filter(x=>/edmundokutuzov\.mz|gmail\.com/i.test(x.value));
 console.log(JSON.stringify({verifiedFacts:facts.filter(x=>x.status==="verified").length,
 documents:docs.filter(x=>x.status==="verified").length,
 pendingReview:facts.filter(x=>x.status==="pending_review").length,
 legacyEmailValues:invalid.length}));
 if(invalid.length)process.exitCode=1;
}
async function evaluate(){
 const arr=JSON.parse(await readFile(join(root,"knowledge/evals/golden.json"),"utf8"));
 if(!Array.isArray(arr)||arr.length<120||arr.some(c=>!c.query||!c.locale||!Array.isArray(c.must_not_include)))
  throw Error("Golden set missing or invalid");
 console.log(JSON.stringify({goldenCases:arr.length,pt:arr.filter(c=>c.locale==="pt").length,
 en:arr.filter(c=>c.locale==="en").length,contactCases:arr.filter(c=>c.expected_tier==="contact").length,
 note:"Dataset validation only. Live-model quality requires separate deployment tests."}));
}
try{
 const tasks={audit,sync,ingest,eval:evaluate};
 if(!tasks[command])throw Error("Unknown command");
 await tasks[command]();
}catch(error){console.error("kb:"+command+" failed: "+error.message);process.exitCode=1;}
