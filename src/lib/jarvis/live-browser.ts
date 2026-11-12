/**
 * Native Gemini Live audio. Browser receives an ephemeral token, NEVER the API key.
 * Audio PCM: microphone 16kHz, output 24kHz. Uses automatic activity detection,
 * interruptions, approved contact tool and resumable WebSockets.
 */
type LiveContact = { email: string|null; phone: string|null; whatsapp: string|null;
  site: string|null; linkedin: string|null; instagram: string|null; facebook: string|null };
type TokenReply = { token: string; model: string; contact: LiveContact; config: Record<string,unknown> };
type LivePart = {inlineData?:{data?:string;mimeType?:string};text?:string};
type LiveEvent = {
  setupComplete?: Record<string,unknown>;
  serverContent?: {modelTurn?:{parts?:LivePart[]};outputTranscription?:{text?:string};
    inputTranscription?:{text?:string};interrupted?:boolean;turnComplete?:boolean};
  toolCall?:{functionCalls?:Array<{id:string;name:string;args?:Record<string,unknown>}>};
  goAway?:{timeLeft?:string};
  sessionResumptionUpdate?:{newHandle?:string;resumable?:boolean};
};
export type LiveSession = {stop:()=>void};
type Callbacks = {
  onState:(state:"listening"|"speaking"|"processing")=>void;
  onError:(message:string)=>void;
  onUserTranscript?:(text:string)=>void;
  onAssistantTranscript?:(text:string)=>void;
};
const LIVE_SOCKET="wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=";

/** Emit little-endian PCM16 at 16K without reallocation of AudioContext. */
function pcm16(input:Float32Array,sampleRate:number):string {
  const factor=sampleRate/16000, count=Math.max(1,Math.floor(input.length/factor));
  const pcm=new Int16Array(count);
  for(let i=0;i<count;i++){
    const first=Math.floor(i*factor),last=Math.min(input.length,Math.floor((i+1)*factor));
    let value=0;
    for(let j=first;j<last;j++)value+=input[j]??0;
    value=Math.min(1,Math.max(-1,value/Math.max(1,last-first)));
    pcm[i]=Math.round(value<0?value*32768:value*32767);
  }
  const bytes=new Uint8Array(pcm.buffer);
  let data="";
  for(let i=0;i<bytes.length;i++)data+=String.fromCharCode(bytes[i]??0);
  return btoa(data);
}
function validatedTranscript(text:string,contact:LiveContact):{text:string;flagged:boolean}{
  let flagged=false;
  const approved=[contact.email,contact.whatsapp,contact.site,contact.linkedin,contact.instagram]
    .filter((v):v is string=>!!v);
  const textSafe=text.replace(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s,;!?]+/gi,(match)=>{
    if(approved.some(v=>v.toLowerCase()===match.toLowerCase()))return match;
    flagged=true;
    return match.includes("@")?(contact.email||"contacto não confirmado"):(contact.site||"site oficial");
  });
  return {text:textSafe,flagged};
}
export async function connectJarvisLive(microphone:MediaStream,callbacks:Callbacks):Promise<LiveSession|null> {
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),7000);
  let tokenResponse:Response;
  try {
    tokenResponse=await fetch("/api/jarvis/live-token",{
      method:"POST",headers:{"Accept":"application/json"},credentials:"same-origin",
      signal:controller.signal,
    });
  }catch{
    window.clearTimeout(timer);
    return null;
  }
  window.clearTimeout(timer);
  if(!tokenResponse.ok)return null;
  const token=await tokenResponse.json() as TokenReply;
  if(!token.token||!token.model||!token.config||!window.WebSocket||!window.AudioContext)return null;
  const context=new window.AudioContext({latencyHint:"interactive"});
  try{await context.resume();}catch{void context.close();return null;}
  const source=context.createMediaStreamSource(microphone);
  const capture=context.createScriptProcessor(1024,1,1);
  const mute=context.createGain();mute.gain.value=0;
  source.connect(capture);capture.connect(mute);mute.connect(context.destination);
  const playing=new Set<AudioBufferSourceNode>();
  let ws:WebSocket|null=null,closed=false,ready=false,nextAudioTime=0,handle="";
  let retries=0,reconnectTimer=0;
  const startedAt=Date.now();
  let inputTranscript="",outputTranscript="",correctionRequested=false;

  const clearPlayback=()=>{
    for(const node of playing){try{node.stop();}catch{/* already stopped */}}
    playing.clear();nextAudioTime=context.currentTime;
  };
  const close=()=>{
    if(closed)return;
    closed=true;ready=false;
    window.clearTimeout(reconnectTimer);
    capture.onaudioprocess=null;
    clearPlayback();
    try{source.disconnect();capture.disconnect();mute.disconnect();}catch{/* already stopped */}
    if(ws){ws.onclose=null;ws.onerror=null;ws.onmessage=null;try{ws.close();}catch{/* already closed */}}
    void context.close().catch(()=>{});
  };
  const send=(message:Record<string,unknown>)=>{
    if(!closed&&ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));
  };
  const play=(encoded:string,mimeType:string)=>{
    try {
      const pcm=atob(encoded),buffer=new Float32Array(Math.floor(pcm.length/2));
      for(let i=0;i<buffer.length;i++){
        let raw=pcm.charCodeAt(2*i)|(pcm.charCodeAt(2*i+1)<<8);
        if(raw>32767)raw-=65536;
        buffer[i]=raw/32768;
      }
      const rate=Number(/rate=(\d+)/.exec(mimeType)?.[1]??"24000");
      if(rate<8000||rate>96000||!buffer.length)return;
      const audio=context.createBuffer(1,buffer.length,rate);
      audio.copyToChannel(buffer,0);
      const node=context.createBufferSource();
      node.buffer=audio;node.connect(context.destination);
      const start=Math.max(context.currentTime+0.018,nextAudioTime);
      nextAudioTime=start+audio.duration;
      playing.add(node);
      node.onended=()=>{
        playing.delete(node);
        if(!playing.size&&ready&&!closed)callbacks.onState("listening");
      };
      node.start(start);
      callbacks.onState("speaking");
    }catch{/* Ignore malformed server audio frames. */}
  };
  const finishTranscripts=()=>{
    const user=inputTranscript.trim(),assistant=outputTranscript.trim();
    inputTranscript="";outputTranscript="";
    if(user)callbacks.onUserTranscript?.(user.slice(0,1900));
    if(assistant) {
      const result=validatedTranscript(assistant,token.contact);
      callbacks.onAssistantTranscript?.(result.text.slice(0,1900));
      if(result.flagged&&!correctionRequested){
        correctionRequested=true;
        clearPlayback();
        const official=token.contact.email||"contacto oficial";
        send({clientContent:{turns:[{role:"user",parts:[{text:
          "Corrige o contacto da resposta anterior. O único email aprovado é "+official+
          ". Usa sempre a função get_contact antes de responder."}]}],turnComplete:true}});
      }else correctionRequested=false;
    }
  };
  const dispatch=(message:LiveEvent)=>{
    if(message.sessionResumptionUpdate?.newHandle)handle=message.sessionResumptionUpdate.newHandle;
    if(message.toolCall?.functionCalls?.length){
      send({toolResponse:{functionResponses:message.toolCall.functionCalls.map(call=>({
        id:call.id,name:call.name,
        response:call.name==="get_contact"?token.contact:{error:"tool_nao_disponivel"},
      }))}});
    }
    const content=message.serverContent;
    if(!content)return;
    if(content.interrupted){clearPlayback();callbacks.onState("listening");}
    if(content.inputTranscription?.text)inputTranscript+=content.inputTranscription.text;
    if(content.outputTranscription?.text)outputTranscript+=content.outputTranscription.text;
    for(const part of content.modelTurn?.parts??[]){
      if(part.inlineData?.data)play(part.inlineData.data,part.inlineData.mimeType||"audio/pcm;rate=24000");
    }
    if(content.turnComplete)finishTranscripts();
  };
  const setup=(resume:boolean)=>({
    setup:{model:token.model,...token.config,
      ...(resume&&handle?{sessionResumption:{handle}}:{})},
  });
  const connect=(resume:boolean):Promise<boolean>=>new Promise(resolve=>{
    if(closed){resolve(false);return;}
    let established=false,settled=false;
    const settle=(value:boolean)=>{if(!settled){settled=true;resolve(value);}};
    const timeout=window.setTimeout(()=>{
      if(!established){settle(false);try{socket.close();}catch{/* ignore */}}
    },7000);
    const socket=new WebSocket(LIVE_SOCKET+encodeURIComponent(token.token));
    ws=socket;ready=false;
    socket.onopen=()=>{socket.send(JSON.stringify(setup(resume)));};
    socket.onmessage=event=>{
      if(closed)return;
      let message:LiveEvent;
      try{message=JSON.parse(String(event.data)) as LiveEvent;}catch{return;}
      if(message.setupComplete){
        established=true;retries=0;ready=true;
        window.clearTimeout(timeout);settle(true);
        callbacks.onState("listening");
      }
      dispatch(message);
      if(message.goAway&&handle&&!closed){
        ready=false;try{socket.close(1000,"resume");}catch{/* reconnect below */}
      }
    };
    const disconnect=()=>{
      window.clearTimeout(timeout);ready=false;settle(false);
      if(closed)return;
      if(established && handle && Date.now()-startedAt<29*60_000 && retries<3){
        retries++;
        reconnectTimer=window.setTimeout(()=>{
          if(!closed)void connect(true).then(ok=>{if(!ok&&retries>=3){
            callbacks.onError("A sessão de voz terminou. Pode iniciar outra conversa.");
            close();
          }});
        },retries*400);
      }else if(established){
        callbacks.onError("A ligação de voz terminou. Pode iniciar outra conversa.");
        close();
      }
    };
    socket.onerror=disconnect;
    socket.onclose=disconnect;
  });
  capture.onaudioprocess=event=>{
    if(closed||!ready||ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>110_000)return;
    const input=event.inputBuffer.getChannelData(0);
    send({realtimeInput:{audio:{data:pcm16(input,context.sampleRate),mimeType:"audio/pcm;rate=16000"}}});
  };
  const connected=await connect(false);
  if(!connected){close();return null;}
  // The server limits each token. Proactively close before its expiry.
  const lifetime=window.setTimeout(()=>{
    if(!closed)callbacks.onError("A sessão de voz chegou ao limite. Inicie outra para continuar.");
    close();
  },30*60_000);
  const stop=()=>{window.clearTimeout(lifetime);close();};
  return {stop};
}
