import {createFileRoute} from "@tanstack/react-router";

/** TEMPORARY protected integration test. Remove after verification. */
export const Route=createFileRoute("/api/jarvis/probe")({
  server:{handlers:{GET:async ({request})=>{
    const url=new URL(request.url);
    if(!process.env["JARVIS_TEST_TOKEN"]||
      url.searchParams.get("token")!==process.env["JARVIS_TEST_TOKEN"])
      return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
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
          let settled=false,setup=false,firstAudioMs:number|null=null,bytes=0;
          const deadline=setTimeout(()=>finish(),12000);
          const finish=(code?:number,reason?:string)=>{
            if(settled)return;settled=true;clearTimeout(deadline);
            try{socket.close();}catch{/* already closed */}
            resolve({setup,firstAudioMs,bytes,...(code===undefined?{}:{code}),...(reason?{reason:reason.slice(0,280)}:{})});
          };
          const apiVersion=url.searchParams.get("socketVersion")==="v1alpha"?"v1alpha":"v1beta";
          const socket=new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage."+apiVersion+".GenerativeService.BidiGenerateContentConstrained?access_token="+encodeURIComponent(token));
          socket.addEventListener("open",()=>{
            const mode=url.searchParams.get("mode")||"minimal";
            const voice={speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}}};
            const speech={systemInstruction:{parts:[{text:"Responde em português europeu com voz masculina."}]}};
            const init={model:"models/gemini-3.8-live",responseModalities:["AUDIO"],
              ...(mode==="voice"||mode==="full"?voice:{}),...(mode==="full"?speech:{})};
            socket.send(JSON.stringify({setup:init}));
          });
          socket.addEventListener("message",(event)=>{
            try{
              const data=JSON.parse(String(event.data)) as {
                setupComplete?:Record<string,unknown>,
                serverContent?:{modelTurn?:{parts?:Array<{inlineData?:{data?:string}}>}}
              };
              if(data.setupComplete&&!setup){
                setup=true;socket.send(JSON.stringify({realtimeInput:{text:"Olá, diga uma frase curta."}}));
              }
              for(const part of data.serverContent?.modelTurn?.parts??[]){
                if(part.inlineData?.data){
                  firstAudioMs??=Date.now()-start;
                  bytes+=part.inlineData.data.length*0.75;
                  finish();
                }
              }
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
