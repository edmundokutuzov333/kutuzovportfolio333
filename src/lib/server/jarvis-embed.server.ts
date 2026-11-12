import { db } from "./jarvis-kb.server";
type PendingChunk={id:string;content:string;metadata:Record<string,unknown>};
type BatchResponse={embeddings?:Array<{values?:number[]}>};
const MODEL="gemini-embedding-2";
export async function embedPendingChunks(limit=24):Promise<{processed:number;remaining:number}>{
  const key=process.env["GEMINI_API_KEY"];
  if(!key)throw Error("Gemini embedding key unavailable");
  const count=Math.max(1,Math.min(40,Math.floor(limit)));
  const approvedQuery="kb_chunks?select=id,content,metadata,kb_documents!inner(status,visibility)"
    +"&kb_documents.status=eq.verified&kb_documents.visibility=eq.public&embedding=is.null";
  const chunks=await db<PendingChunk[]>(approvedQuery+"&limit="+count);
  if(!chunks.length)return {processed:0,remaining:0};
  const requests=chunks.map(chunk=>({
    model:"models/"+MODEL,
    content:{parts:[{text:"title: "+String(chunk.content.split("\n")[0]).slice(0,120)
      +" | text: "+chunk.content.slice(0,1400)}]},
    outputDimensionality:768,
  }));
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":batchEmbedContents",{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
    body:JSON.stringify({requests}),signal:AbortSignal.timeout(16000),cache:"no-store",
  });
  if(!response.ok)throw Error("Gemini embeddings HTTP "+response.status);
  const body=await response.json() as BatchResponse;
  if(!body.embeddings||body.embeddings.length!==chunks.length)throw Error("Embedding count mismatch");
  const rows=chunks.map((chunk,index)=>{
    const values=body.embeddings?.[index]?.values;
    if(!values||values.length!==768||values.some(v=>!Number.isFinite(v)))
      throw Error("Invalid embedding dimensions");
    return {id:chunk.id,values,model:MODEL};
  });
  // Atomic server-only RPC validates model and dimensions, never writes CMS tables.
  const processed=await db<number>("rpc/kb_store_embeddings",{
    method:"POST",body:{p_rows:rows},timeoutMs:8000,
  });
  const remainingRows=await db<Array<{id:string}>>(approvedQuery.replace("id,content,metadata","id")+"&limit=1",{timeoutMs:1600});
  return {processed,remaining:remainingRows.length};
}
