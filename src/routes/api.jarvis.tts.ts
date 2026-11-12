import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";

const Input=z.object({text:z.string().trim().min(1).max(650)}).strict();
/** Render a masculine Portuguese voice through Google TTS if a local PT/MZ voice is unavailable.
 * Only verified public contacts may be synthesized. Never pass master keys to the browser.
 */
export const Route=createFileRoute("/api/jarvis/tts")({
  server:{handlers:{POST:async ({request})=>{
    const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
    const origin=request.headers.get("origin");
    if(request.headers.get("sec-fetch-site")==="cross-site"
      ||(origin&&origin!==new URL(request.url).origin))return new Response(null,{status:403,headers});
    if(Number(request.headers.get("content-length")||"0")>2000)return new Response(null,{status:413,headers});
    let text:string;
    try{
      const raw=await request.text();
      if(raw.length>2000)return new Response(null,{status:413,headers});
      text=Input.parse(JSON.parse(raw)).text;
    }catch{return new Response(null,{status:400,headers});}
    try {
      const {getVerifiedFacts,acquireQuota}=await import("@/lib/server/jarvis-kb.server");
      const {validateContacts}=await import("@/lib/jarvis/facts");
      const {spokenJarvisText}=await import("@/lib/jarvis/speech");
      const [facts,allowed]=await Promise.all([getVerifiedFacts(),acquireQuota()]);
      if(!allowed)return new Response(null,{status:429,headers});
      const safe=validateContacts(text,facts,"pt");
      const key=process.env["GEMINI_API_KEY"];
      if(!key)return new Response(null,{status:503,headers});
      const voiceText=spokenJarvisText(safe.text).slice(0,850);
      const response=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
        method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"gemini-3.8-flash-lite-tts",
          input:[{type:"user_input",content:[{type:"text",text:voiceText,
            annotations:[{type:"speech_metadata",style:
              "Adult male voice, low warm timbre, precise natural Portuguese as spoken in Mozambique; European Portuguese pronunciation, never Brazilian Portuguese. Calm confident articulate delivery."}]}]}],
          response_format:{type:"audio",mime_type:"audio/wav"},
          generation_config:{speech_config:[{voice:"Orus"}]},
        }),signal:AbortSignal.timeout(16000),cache:"no-store",
      });
      if(!response.ok){
        console.warn("JARVIS_TTS_HTTP",response.status);
        return new Response(null,{status:503,headers});
      }
      const data=await response.json() as {steps?:Array<{type?:string;content?:Array<{type?:string;data?:string}>}>};
      const audio=data.steps?.filter(x=>x.type==="model_output").flatMap(x=>x.content??[])
        .filter(x=>x.type==="audio").at(-1)?.data;
      if(!audio||audio.length>2_000_000)return new Response(null,{status:503,headers});
      const bytes=Buffer.from(audio,"base64");
      if(bytes.length<44||bytes.toString("ascii",0,4)!=="RIFF")
        return new Response(null,{status:503,headers});
      return new Response(new Uint8Array(bytes),{
        headers:{...headers,"Content-Type":"audio/wav","Content-Length":String(bytes.length)}
      });
    }catch{
      return new Response(null,{status:503,headers});
    }
  }}},
});
