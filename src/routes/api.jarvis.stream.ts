import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jarvisServerCopy } from "@/lib/jarvis/locale";

const Message=z.object({role:z.enum(["user","assistant"]),content:z.string().trim().min(1).max(2000)}).strict();
const Input=z.object({messages:z.array(Message).min(1).max(16),locale:z.enum(["en","pt"]).default("en")}).strict();

export const Route=createFileRoute("/api/jarvis/stream")({
  server:{handlers:{POST:async ({request})=>{
    const headers={"Cache-Control":"no-cache, no-transform","Content-Type":"text/event-stream; charset=utf-8",
      "X-Accel-Buffering":"no","X-Content-Type-Options":"nosniff","Vary":"Origin"};
    if(request.headers.get("sec-fetch-site")==="cross-site")return new Response(null,{status:403});
    const origin=request.headers.get("origin");
    if(origin && origin!==new URL(request.url).origin)return new Response(null,{status:403});
    if(Number(request.headers.get("content-length")||"0")>26000)return new Response(null,{status:413});
    let data:z.infer<typeof Input>;
    try{
      const raw=await request.text();
      if(raw.length>26000)return new Response(null,{status:413});
      data=Input.parse(JSON.parse(raw));
      if(data.messages.at(-1)?.role!=="user")return new Response(null,{status:400});
    }catch{return new Response(null,{status:400});}
    const encoder=new TextEncoder();
    const stream=new ReadableStream<Uint8Array>({
      start(controller) {
        // Never return the async generation promise from start(): the
        // response must be readable before Gemini finishes generating.
        void (async () => {
        let closed=false;
        const write=(kind:"chunk"|"done"|"error"|"timing",payload:Record<string,unknown>)=>{
          if(closed||request.signal.aborted)return;
          try{controller.enqueue(encoder.encode("event: "+kind+"\ndata: "+JSON.stringify(payload)+"\n\n"));}
          catch{closed=true;}
        };
        try{
          const {streamJarvis}=await import("@/lib/server/jarvis-stream.server");
          await streamJarvis(data.messages,write,request.signal,data.locale);
        }catch{write("error",{message:jarvisServerCopy(data.locale).temporary});}
        finally {if(!closed){closed=true;controller.close();}}
        })();
      },cancel(){/* request.signal propagates on disconnect */},
    });
    return new Response(stream,{headers});
  }}},
});
