import {createFileRoute} from "@tanstack/react-router";

/** TEMPORARY protected integration test. Remove after verification. */
export const Route=createFileRoute("/api/jarvis/probe")({
  server:{handlers:{GET:async ({request})=>{
    const url=new URL(request.url);
    if(!process.env["JARVIS_TEST_TOKEN"]||
      url.searchParams.get("token")!==process.env["JARVIS_TEST_TOKEN"])
      return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
    if(url.searchParams.get("action")==="tts"){
      const started=Date.now();
      try{
        const reply=await fetch("https://edmundokutuzov.art/api/jarvis/tts",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:"Olá. Sou o JARVIS do Kutuzov."}),
          signal:AbortSignal.timeout(18000),
        });
        const bytes=new Uint8Array(await reply.arrayBuffer());
        return Response.json({http:reply.status,ms:Date.now()-started,
          bytes:bytes.length,validWav:bytes.length>44&&
            String.fromCharCode(...bytes.slice(0,4))==="RIFF"},{headers:{"Cache-Control":"no-store, private"}});
      }catch(error){
        return Response.json({error:error instanceof Error?error.name:"unknown",ms:Date.now()-started},
          {status:503,headers:{"Cache-Control":"no-store, private"}});
      }
    }
    if(url.searchParams.get("action")==="smoke"){
      const results=[];
      for(const [locale,query] of [
        ["pt","Qual é o email oficial do Edmundo?"],
        ["en","What is Edmundo's official email?"],
        ["pt","Fala-me de um projecto da Toyota."]
      ]){
        const begin=Date.now();
        try{
          const rsp=await fetch("https://edmundokutuzov.art/api/jarvis/stream",{
            method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({messages:[{role:"user",content:query}]}),
            signal:AbortSignal.timeout(13000),cache:"no-store",
          });
          const text=await rsp.text();
          const fragments=[...text.matchAll(/event: chunk\ndata: (.+)/g)]
            .map(match=>{try{return (JSON.parse(match[1]||"") as {text:string}).text;}catch{return "";}});
          const timings=[...text.matchAll(/event: timing\ndata: (.+)/g)]
            .map(match=>{try{return JSON.parse(match[1]||"");}catch{return null;}});
          results.push({locale,http:rsp.status,totalMs:Date.now()-begin,
            chars:fragments.join("").length,hasVerifiedEmail:fragments.join("").includes("contact@edmundokutuzov.art"),
            safe:!fragments.join("").includes("edmundokutuzov.mz@gmail.com"),
            timing:timings.at(-1)??null});
        }catch(e){results.push({locale,totalMs:Date.now()-begin,error:e instanceof Error?e.name:"unknown"});}
      }
      return Response.json({results},{headers:{"Cache-Control":"no-store, private"}});
    }
    // A single explicit, authenticated backfill call, never invoked by public traffic.
    if(url.searchParams.get("action")==="embed"){
      try{
        const {embedPendingChunks}=await import("@/lib/server/jarvis-embed.server");
        const result=await embedPendingChunks(24);
        return Response.json({status:"ok",...result},{headers:{"Cache-Control":"no-store, private"}});
      }catch(error){
        return Response.json({status:"error",message:error instanceof Error?
          error.message.slice(0,180):"unknown"},{status:503,
          headers:{"Cache-Control":"no-store, private"}});
      }
    }
    const key=process.env["GEMINI_API_KEY"];
    if(!key)return Response.json({ok:false,error:"gemini_not_configured"},{status:503});
    const result:Record<string,unknown>={provider:"Gemini",model:"gemini-3.8-live"};
    const headers={"Content-Type":"application/json","x-goog-api-key":key};
    const first=Date.now();
    try{
      const modelsResponse=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",{
        headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(5500),cache:"no-store",
      });
      result["modelsHTTP"]=modelsResponse.status;
      if(modelsResponse.ok){
        const listing=await modelsResponse.json() as {models?:Array<{name?:string}>};
        result["availableModels"]=(listing.models??[]).map(m=>m.name||"").filter(
          name=>name.includes('gemini-')).slice(0,35);
        result["availableLiveModels"]=(listing.models??[]).map(m=>m.name||"").filter(name=>name.includes("live"));
      }
    }catch(error){result["modelsError"]=error instanceof Error?error.name:"unknown";}
    try {
      const text=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse",{
        method:"POST",headers,
        body:JSON.stringify({contents:[{role:"user",parts:[{text:"Responde só: Olá."}]}],
          generationConfig:{maxOutputTokens:60,thinkingConfig:{thinkingLevel:"MINIMAL"}}}),
        signal:AbortSignal.timeout(8500),cache:"no-store",
      });
      result["textHTTP"]=text.status;
      if(text.ok&&text.body){
        const reader=text.body.getReader();
        const chunk=await reader.read();
        result["firstGeminiChunkMs"]=Date.now()-first;
        result["firstChunkContainsData"]=!!chunk.value&&new TextDecoder().decode(chunk.value).includes("data:");
        await reader.cancel().catch(()=>{});
      }
    }catch(error){
      result["textError"]=error instanceof Error?error.name:"unknown";
    }
    // One inexpensive real embedding batch, no user data and no DB writes.
    try{
      const embed=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents",{
        method:"POST",headers,body:JSON.stringify({requests:[{
          model:"models/gemini-embedding-2",
          content:{parts:[{text:"title: teste | text: produção de identidade visual em Maputo"}]},
          outputDimensionality:768,
        }]}),signal:AbortSignal.timeout(7000),cache:"no-store",
      });
      result["embeddingHTTP"]=embed.status;
      const data=await embed.json().catch(()=>null) as {
        embeddings?:Array<{values?:number[]}>,error?:{status?:string;message?:string}}|null;
      result["embeddingDim"]=data?.embeddings?.[0]?.values?.length||0;
      if(!embed.ok)result["embeddingError"]=String(data?.error?.message||"").slice(0,200);
    }catch(e){result["embeddingError"]=e instanceof Error?e.name:"unknown";}
    // 3.8 TTS is optional fallback for browsers without masculine PT/MZ speech.
    try{
      const tts=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
        method:"POST",headers,body:JSON.stringify({
          model:"gemini-3.8-flash-lite-tts",
          input:[{type:"user_input",content:[{type:"text",text:"Olá.",
            annotations:[{type:"speech_metadata",style:
              "Adult masculine voice speaking Portuguese from Mozambique/Portugal, never Brazilian."}]}]}],
          response_format:{type:"audio"},
          generation_config:{speech_config:[{voice:"Orus"}]},
        }),signal:AbortSignal.timeout(8500),cache:"no-store",
      });
      result["ttsHTTP"]=tts.status;
      const data=await tts.json().catch(()=>null) as {
        steps?:Array<{content?:Array<{type?:string;data?:string}>}>,
        error?:{status?:string;message?:string}}|null;
      result["ttsAudioBytes"]=(data?.steps??[]).flatMap(step=>step.content??[])
        .filter(part=>part.type==="audio").reduce((total,part)=>total+(part.data?.length||0)*0.75,0);
      if(!tts.ok)result["ttsError"]=String(data?.error?.message||"").slice(0,220);
    }catch(e){result["ttsError"]=e instanceof Error?e.name:"unknown";}
    const start=Date.now();
    let token="";
    const configs=[
      {version:"v1beta",locked:true},
      {version:"v1alpha",locked:true},
      {version:"v1beta",locked:false},
    ];
    const errors:Array<{version:string;locked:boolean;code:number;status?:string;message?:string}>=[];
    for(const mode of configs){
      try{
        const body={
          uses:1,newSessionExpireTime:new Date(Date.now()+60_000).toISOString(),
          expireTime:new Date(Date.now()+180_000).toISOString(),
          ...(mode.locked?{liveConnectConstraints:{model:"models/gemini-3.8-live",
            config:{responseModalities:["AUDIO"],
              speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}}}}}:{}),
        };
        const res=await fetch("https://generativelanguage.googleapis.com/"+mode.version+"/auth_tokens",{
          method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(5000),cache:"no-store",
        });
        if(res.ok){
          token=(await res.json() as {name?:string}).name||"";
          result["tokenHTTP"]=res.status;
          result["tokenMode"]=mode;
          result["tokenLatencyMs"]=Date.now()-start;
          break;
        }
        const problem=await res.json().catch(()=>null) as {error?:{status?:string;message?:string}}|null;
        errors.push({version:mode.version,locked:mode.locked,code:res.status,
          ...(problem?.error?.status?{status:problem.error.status}:{}),
          ...(problem?.error?.message?{message:problem.error.message.slice(0,260)}:{})});
      }catch(error){
        errors.push({version:mode.version,locked:mode.locked,code:0,
          message:error instanceof Error?error.name:"unknown"});
      }
    }
    result["tokenAttemptFailures"]=errors;
    if(token&&typeof WebSocket!=="undefined"){
      result["websocketSupported"]=true;
      try{
        const audio=await new Promise<{setup:boolean;firstAudioMs:number|null;bytes:number;code?:number;reason?:string}>((resolve)=>{
          let settled=false,setup=false,opened=false,firstAudioMs:number|null=null,bytes=0,audioChunks=0;
          const deadline=setTimeout(()=>finish(),12000);
          const finish=(code?:number,reason?:string)=>{
            result["socketOpened"]=opened;
            result["audioChunks"]=audioChunks;
            if(settled)return;settled=true;clearTimeout(deadline);
            try{socket.close();}catch{/* already closed */}
            resolve({setup,firstAudioMs,bytes,...(code===undefined?{}:{code}),...(reason?{reason:reason.slice(0,280)}:{})});
          };
          const apiVersion=url.searchParams.get("socketVersion")==="v1alpha"?"v1alpha":"v1beta";
          const socket=new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage."+apiVersion+".GenerativeService.BidiGenerateContentConstrained?access_token="+encodeURIComponent(token));
          socket.binaryType="arraybuffer";
          socket.addEventListener("open",()=>{
            opened=true;
            const mode=url.searchParams.get("mode")||"minimal";
            const voice={speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}}};
            const speech={systemInstruction:{parts:[{text:"Responde em português europeu com voz masculina."}]}};
            const full=mode==="full"||mode==="complete";
            const init={model:"models/gemini-3.8-live",
              generationConfig:{responseModalities:["AUDIO"],
                ...(mode==="voice"||full?voice:{})},
              ...(full?speech:{}),
              ...(mode==="complete"?{
                inputAudioTranscription:{},
                outputAudioTranscription:{},
                sessionResumption:{},
                contextWindowCompression:{slidingWindow:{}},
                tools:[{functionDeclarations:[{
                  name:"get_contact",description:"Official portfolio contact",
                  parameters:{type:"OBJECT",properties:{}},
                }]}],
              }:{})};
            socket.send(JSON.stringify({setup:init}));
          });
          socket.addEventListener("message",(event)=>{
            try{
              const raw=typeof event.data==="string"?event.data:
                event.data instanceof ArrayBuffer?new TextDecoder().decode(event.data):"";
              const data=JSON.parse(raw) as {
                setupComplete?:Record<string,unknown>,
                serverContent?:{turnComplete?:boolean;modelTurn?:{parts?:Array<{inlineData?:{data?:string;mimeType?:string}}>}}
              };
              if(data.setupComplete&&!setup){
                setup=true;socket.send(JSON.stringify({realtimeInput:{text:"Olá, diga uma frase curta."}}));
              }
              for(const part of data.serverContent?.modelTurn?.parts??[]){
                if(part.inlineData?.data){
                  firstAudioMs??=Date.now()-start;
                  bytes+=part.inlineData.data.length*0.75;
                  audioChunks++;
                  result["audioMimeType"]=part.inlineData.mimeType||"unknown";
                  if(bytes>3000)finish();
                }
              }
              if(data.serverContent?.turnComplete && audioChunks)finish();
            }catch{/* not a JSON data event */}
          });
          socket.addEventListener("close",event=>finish(event.code,event.reason));
          socket.addEventListener("error",()=>finish(1006));
        });
        result["liveSetup"]=audio.setup;
        result["firstAudioMs"]=audio.firstAudioMs;
        result["audioPayloadBytes"]=audio.bytes;
        result["socketCloseCode"]=audio.code||null;
        result["socketCloseReason"]=audio.reason||null;
      }catch(error){result["socketError"]=error instanceof Error?error.name:"unknown";}
    }else result["websocketSupported"]=typeof WebSocket!=="undefined";
    result["totalElapsedMs"]=Date.now()-first;
    return Response.json(result,{headers:{"Cache-Control":"no-store, private"}});
  }}},
});
