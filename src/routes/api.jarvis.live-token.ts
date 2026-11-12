import { createFileRoute } from "@tanstack/react-router";

/** A one-use ephemeral token. Never expose GEMINI_API_KEY or Supabase credentials. */
export const Route = createFileRoute("/api/jarvis/live-token")({
  server: {
    handlers: {
      POST: async ({request}) => {
        const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
        if(process.env["JARVIS_LIVE_ENABLED"]!=="true")return new Response(null,{status:404,headers});
        const origin=request.headers.get("origin");
        if(!origin||new URL(origin).origin!==new URL(request.url).origin
          ||request.headers.get("sec-fetch-site")==="cross-site")
          return new Response(null,{status:403,headers});
        try{
          const {getVerifiedFacts,acquireQuota,db}=await import("@/lib/server/jarvis-kb.server");
          const {buildFactsBlock,getContact}=await import("@/lib/jarvis/facts");
          const {jarvisPersona}=await import("@/lib/jarvis/persona");
          const [facts,quota]=await Promise.all([getVerifiedFacts(),acquireQuota()]);
          if(!quota)return new Response(null,{status:429,headers});
          // Native audio incurs continuous provider costs, not merely one
          // request. A separate daily global session ceiling is essential.
          const configured=Number(process.env["JARVIS_LIVE_DAILY_SESSIONS"]||"24");
          const daily=Number.isFinite(configured)?Math.max(1,Math.min(100,Math.floor(configured))):24;
          const date=new Date().toISOString().slice(0,10);
          const available=await db<boolean>("rpc/kb_acquire_rate_slot",{
            method:"POST",body:{p_bucket:"live:global:"+date,p_max:daily,p_window_seconds:86400},
            timeoutMs:2300,
          });
          if(!available)return new Response(null,{status:429,headers});
          const contact=getContact(facts),apiKey=process.env["GEMINI_API_KEY"];
          if(!contact.email||!apiKey)return new Response(null,{status:503,headers});
          // Gemini Live 3.8 is the low-latency native-audio model.
          const model="models/gemini-3.8-live";
          const system=jarvisPersona("pt",buildFactsBlock(facts,"pt").slice(0,4300),"")
            +"\\nVOICE: Usa apresentação vocal MASCULINA, natural e calorosa, registo médio-grave."
            +"\\nRESPONDE INEQUIVOCAMENTE EM PORTUGUÊS EUROPEU FALADO EM MOÇAMBIQUE."
            +"\\nEvita de forma explícita a pronúncia e o vocabulário do português do Brasil."
            +"\\nMantém cadência moçambicana natural, sem imitações caricaturais."
            +"\\nFala em frases curtas. Em contactos invoca sempre get_contact.";

          const config={
            generationConfig:{
              responseModalities:["AUDIO"],
              speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}},
            },
            inputAudioTranscription:{},
            outputAudioTranscription:{},
            sessionResumption:{},
            contextWindowCompression:{slidingWindow:{}},
            systemInstruction:{parts:[{text:system}]},
            tools:[{functionDeclarations:[{
              name:"get_contact",description:"Obter email, WhatsApp, site, LinkedIn ou Instagram canónicos antes de dizer contactos.",
              parameters:{type:"OBJECT",properties:{}},
            }]}],
          };
          const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
            method:"POST",headers:{"x-goog-api-key":apiKey,"Content-Type":"application/json"},
            body:JSON.stringify({uses:1,
              expireTime:new Date(Date.now()+30*60_000).toISOString(),
              newSessionExpireTime:new Date(Date.now()+60_000).toISOString()}),
            signal:AbortSignal.timeout(8500),cache:"no-store",
          });
          if(!response.ok){
            console.warn("JARVIS_LIVE_TOKEN_STATUS",response.status);
            return new Response(null,{status:503,headers});
          }
          const data=await response.json() as {name?:string};
          if(!data.name)return new Response(null,{status:503,headers});
          return Response.json({token:data.name,model,config,contact,
            expiresInSeconds:60},{headers});
        }catch{
          return new Response(null,{status:503,headers});
        }
      },
    },
  },
});
