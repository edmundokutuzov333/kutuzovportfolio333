type LiveContact = {email:string|null;phone:string|null;whatsapp:string|null;
  site:string|null;linkedin:string|null;instagram:string|null;facebook:string|null};
type TokenReply = {token:string;model:string;contact:LiveContact;config:Record<string,unknown>};
type LiveEvent = {setupComplete?: Record<string,unknown>;
  serverContent?: {
    modelTurn?: {parts?: Array<{inlineData?: {data?:string;mimeType?:string};text?:string}>};
    outputTranscription?: {text?:string};inputTranscription?: {text?:string};
    interrupted?:boolean;turnComplete?:boolean;
  };toolCall?:{functionCalls?:Array<{id:string;name:string;args?:Record<string,unknown>}>};
  goAway?: {timeLeft?:string};
  sessionResumptionUpdate?: {newHandle?:string;resumable?:boolean};
};
export type LiveSession = { stop:()=>void };
type Callbacks = {
  onState:(state:"listening"|"speaking"|"processing")=>void;
  onError:(message:string)=>void;
  onMic:(stream:MediaStream)=>void;
};

/** WebSocket Live uses only server-issued ephemeral tokens (never a full Gemini API key). */
export async function connectJarvisLive(microphone:MediaStream,callbacks:Callbacks):Promise<LiveSession|null>{
  const request=await fetch("/api/jarvis/live-token",{
    method:"POST",headers:{"Accept":"application/json"},credentials:"same-origin",
  }).catch(()=>null);
  if(!request?.ok)return null; // Feature flag off or model unavailable: use existing browser speech fallback.
  const data=await request.json() as TokenReply;
  if(!data.token||!data.model||!data.config)return null;
  const AudioConstructor=window.AudioContext;
  if(!AudioConstructor||!window.WebSocket)return null;

  let closed=false,ready=false,queueTime=0;
  const context=new AudioConstructor({latencyHint:"interactive"});
  await context.resume();
  const source=context.createMediaStreamSource(microphone);
  const processor=context.createScriptProcessor(2048,1,1);
  const silent=context.createGain(); silent.gain.value=0;
  source.connect(processor);processor.connect(silent);silent.connect(context.destination);
  const playing=new Set<AudioBufferSourceNode>();
  const clearAudio=()=>{
    for(const sound of playing){try{sound.stop();}catch{/* sound already finished */}}
    playing.clear();queueTime=context.currentTime;
  };
  const socket=new WebSocket(
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token="
    +encodeURIComponent(data.token),
  );
  function pcmBase64(input:Float32Array,sampleRate:number){
    const factor=sampleRate/16000;
    const count=Math.floor(input.length/factor);
    const pcm=new Int16Array(count);
    for(let i=0;i<count;i++){
      const left=Math.floor(i*factor),right=Math.min(input.length,Math.floor((i+1)*factor));
      let sum=0;for(let j=left;j<right;j++)sum+=(input[j]??0);
      const value=Math.max(-1,Math.min(1,sum/Math.max(1,right-left)));
      pcm[i]=Math.round(value<0?value*32768:value*32767);
    }
    const bytes=new Uint8Array(pcm.buffer);
    let binary="";for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]??0);
    return btoa(binary);
  }
  processor.onaudioprocess=event=>{
    if(closed||!ready||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>120000)return;
    const input=event.inputBuffer.getChannelData(0);
    socket.send(JSON.stringify({realtimeInput:{
      audio:{data:pcmBase64(input,context.sampleRate),mimeType:"audio/pcm;rate=16000"},
    }}));
  };
  function play(data64:string,mime:string){
    try{
      const raw=atob(data64),samples=new Float32Array(Math.floor(raw.length/2));
      for(let i=0;i<samples.length;i++){
        let n=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
        if(n>=32768)n-=65536;
        samples[i]=n/32768;
      }
      const rate=Number(/rate=(\d+)/.exec(mime)?.[1]||24000);
      const audio=context.createBuffer(1,samples.length,rate);
      audio.copyToChannel(samples,0);
      const player=context.createBufferSource();player.buffer=audio;player.connect(context.destination);
      const when=Math.max(context.currentTime+0.025,queueTime);
      queueTime=when+audio.duration;playing.add(player);
      player.onended=()=>playing.delete(player);
      player.start(when);
      callbacks.onState("speaking");
    }catch{/* malformed audio chunk, keep the session alive */}
  }
  function post(message:Record<string,unknown>){
    if(!closed&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));
  }
  function checkTranscript(text:string){
    const email=/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/g;
    const urls=/https?:\/\/[^\s]+/g;
    const known=[data.contact.email,data.contact.phone,data.contact.whatsapp,
      data.contact.site,data.contact.linkedin,data.contact.instagram].filter(Boolean) as string[];
    const found=[...text.matchAll(email),...text.matchAll(urls)];
    if(found.some(m=>!known.includes(m[0]))){
      // Audio can't be edited retrospectively: interrupt and correct the response.
      clearAudio();
      const correct=data.contact.email||"canal oficial";
      post({clientContent:{turns:[{role:"user",parts:[{text:
        "Correcção obrigatória: utilizou um contacto não verificado. Use exclusivamente "+correct+
        " e os contactos oficiais confirmados. Corrija agora por voz."}]}],turnComplete:true}});
    }
  }
  let handle="";
  socket.onopen=()=>{
    post({setup:{model:data.model,...data.config}});
  };
  socket.onmessage=event=>{
    if(closed)return;
    let result:LiveEvent;
    try{result=JSON.parse(String(event.data)) as LiveEvent;}catch{return;}
    if(result.setupComplete){ready=true;callbacks.onState("listening");}
    if(result.sessionResumptionUpdate?.newHandle)handle=result.sessionResumptionUpdate.newHandle;
    if(result.toolCall?.functionCalls?.length){
      const functionResponses=result.toolCall.functionCalls.map(call=>({
        id:call.id,name:call.name,response:call.name==="get_contact"?data.contact:{error:"unsupported_tool"},
      }));
      post({toolResponse:{functionResponses}});
    }
    const sc=result.serverContent;
    if(sc?.interrupted){clearAudio();callbacks.onState("listening");}
    if(sc?.outputTranscription?.text)checkTranscript(sc.outputTranscription.text);
    for(const part of sc?.modelTurn?.parts??[]){
      if(part.inlineData?.data)play(part.inlineData.data,part.inlineData.mimeType||"audio/pcm;rate=24000");
    }
    if(sc?.turnComplete && !playing.size)callbacks.onState("listening");
    if(result.goAway){
      // Stop safely; a new user gesture starts a fresh session/token.
      callbacks.onError("A sessão de voz chegou ao limite. Pode iniciar outra conversa.");
    }
    void handle;
  };
  socket.onerror=()=>{if(!closed)callbacks.onError("Ligação de voz interrompida.");};
  socket.onclose=()=>{if(!closed)callbacks.onError("Sessão de voz terminada. Pode iniciar outra.");};
  const maxDuration=window.setTimeout(()=>{
    if(!closed)callbacks.onError("A sessão atingiu o limite. Inicie outra conversa.");
    stop();
  },9*60_000);
  function stop(){
    if(closed)return;closed=true;ready=false;
    window.clearTimeout(maxDuration);
    processor.onaudioprocess=null;
    clearAudio();
    try{processor.disconnect();silent.disconnect();source.disconnect();}catch{/* already disconnected */}
    try{socket.close();}catch{/* already closed */}
    void context.close().catch(()=>{});
  }
  return {stop};
}
