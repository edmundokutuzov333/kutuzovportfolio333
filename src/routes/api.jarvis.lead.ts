import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Lead=z.object({
  name:z.string().trim().min(2).max(120),
  contact:z.string().trim().min(5).max(160).refine(
    v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[\d\s().-]{9,24}$/.test(v),
    "Provide a valid email or phone number",
  ),
  brief:z.string().trim().min(10).max(2000),
  deadline:z.string().trim().max(100).optional(),
  budget:z.string().trim().max(100).optional(),
  consent:z.literal(true),
}).strict();

/** Explicit browser-submitted consent; the model is forbidden to silently submit leads. */
export const Route=createFileRoute("/api/jarvis/lead")({
  server:{handlers:{POST:async ({request})=>{
    const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
    const origin=request.headers.get("origin");
    if(!origin || origin!==new URL(request.url).origin
      ||request.headers.get("sec-fetch-site")==="cross-site")return new Response(null,{status:403,headers});
    if(Number(request.headers.get("content-length")||"0")>5500)return new Response(null,{status:413,headers});
    let lead:z.infer<typeof Lead>;
    try{
      const raw=await request.text();
      if(raw.length>5500)return new Response(null,{status:413,headers});
      lead=Lead.parse(JSON.parse(raw));
    }catch{return Response.json({ok:false,error:"invalid_or_missing_consent"},{status:400,headers});}
    try{
      const {acquireQuota,db}=await import("@/lib/server/jarvis-kb.server");
      if(!await acquireQuota())return Response.json({ok:false,error:"rate_limited"},{status:429,headers});
      const saved=await db<Array<{id:string}>>("kb_leads?select=id",{
        method:"POST",
        headers:{Prefer:"return=representation"},
        body:[{
          name:lead.name,
          contact:lead.contact,
          brief:lead.brief,
          deadline:lead.deadline||null,
          budget:lead.budget||null,
          source:"jarvis",
        }],timeoutMs:5000,
      });
      if(!saved[0]?.id)return Response.json({ok:false,error:"database_not_confirmed"},{status:503,headers});
      return Response.json({ok:true,reference:saved[0].id},{headers});
    }catch{
      return Response.json({ok:false,error:"submission_unavailable"},{status:503,headers});
    }
  }}},
});
