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
    try{
      const res=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
        method:"POST",headers,
        body:JSON.stringify({uses:1,newSessionExpireTime:new Date(Date.now()+60_000).toISOString(),
          expireTime:new Date(Date.now()+180_000).toISOString(),
          liveConnectConstraints:{model:"models/gemini-3.8-live",config:{
            responseModalities:["AUDIO"],
            speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}},
          }}}),
        signal:AbortSignal.timeout(7500),cache:"no-store",
      });
      result["tokenHTTP"]=res.status;
      result["tokenLatencyMs"]=Date.now()-start;
      if(res.ok)token=(await res.json() as {name?:string}).name||"";
    }catch(error){
      result["tokenError"]=error instanceof Error?error.name:"unknown";
    }
    if(token&&typeof WebSocket!=="undefined"){
      result["websocketSupported"]=true;
      try{
        const audio=await new Promise<{setup:boolean;firstAudioMs:number|null;bytes:number;code?:number}>((resolve)=>{
          let settled=false,setup=false,firstAudioMs:number|null=null,bytes=0;
          const deadline=setTimeout(()=>finish(),12000);
          const finish=(code?:number)=>{
            if(settled)return;settled=true;clearTimeout(deadline);
            try{socket.close();}catch{/* already closed */}
            resolve({setup,firstAudioMs,bytes,code});
          };
          const socket=new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token="+encodeURIComponent(token));
          socket.addEventListener("open",()=>socket.send(JSON.stringify({setup:{
            model:"models/gemini-3.8-live",responseModalities:["AUDIO"],
            speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Orus"}}},
            systemInstruction:{parts:[{text:"Responde com voz masculina em português de Portugal usado em Moçambique. Uma frase curta."}]},
          }})));
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
          socket.addEventListener("close",event=>finish(event.code));
          socket.addEventListener("error",()=>finish(1006));
        });
        result["liveSetup"]=audio.setup;
        result["firstAudioMs"]=audio.firstAudioMs;
        result["audioPayloadBytes"]=audio.bytes;
        result["socketCloseCode"]=audio.code||null;
      }catch(error){result["socketError"]=error instanceof Error?error.name:"unknown";}
    }else result["websocketSupported"]=typeof WebSocket!=="undefined";
    result["totalElapsedMs"]=Date.now()-first;
    return Response.json(result,{headers:{"Cache-Control":"no-store, private"}});
  }}},
});
