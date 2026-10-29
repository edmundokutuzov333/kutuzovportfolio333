import { useState, type ReactNode } from "react";
import { Download, ExternalLink, FileImage, Mail, RefreshCw, Save, Search, Trash2, Upload } from "lucide-react";
import {
  cancelMediaUploadFn, completeMediaUploadFn, createMediaUploadFn, createSignedContactAttachmentUrlFn,
  deleteMediaAssetFn, listMediaAssetReferencesFn, retryEmailOutboxFn,
} from "@/lib/admin-media.functions";
import { SUPABASE_URL } from "@/lib/cms/public-client";

type Row = Record<string, unknown>;
type TableState = { rows: Row[]; error: string | null };
type StorageState = { status: string; buckets?: Array<{ id: string; name: string; public: boolean }>; error?: string };
type Badge = (value: unknown) => ReactNode;
const txt = (v: unknown) => typeof v === "string" ? v : v == null ? "" : String(v);

export function ContactInboxView({ rows, error, busy, onStatus, stateBadge }: {
  rows: Row[]; error: string | null; busy: boolean;
  onStatus: (row: Row, status: "new" | "in_review" | "replied" | "archived") => void;
  stateBadge: Badge;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const filtered = rows.filter((row) => ["name","email","company","message","request_type","status"].some((key) => txt(row[key]).toLowerCase().includes(query.trim().toLowerCase())));

  async function getSignedUrl(row: Row, path: string) {
    const id = txt(row["id"]);
    const key = id + ":" + path;
    setLoadingPath(key);
    setAttachmentError("");
    try {
      const result = await createSignedContactAttachmentUrlFn({ data: { submissionId: id, path } }) as { url: string };
      setUrls((current) => ({ ...current, [key]: result.url }));
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : "Não foi possível criar um link privado.");
    } finally { setLoadingPath(null); }
  }

  if (error) return <div role="alert" className="rounded-xl border border-[#e8b4ae] bg-white p-5 text-sm text-[#922f25]">{error}</div>;
  return <div className="space-y-3">
    <label className="relative block max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]"/><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar pedidos de contacto" placeholder="Pesquisar pedidos..." className="h-10 w-full rounded-lg border border-[#dfe2e8] pl-8 pr-3 text-xs outline-none focus-visible:border-[#3b5ccc] focus-visible:ring-2 focus-visible:ring-[#3b5ccc]/20"/></label>
    {attachmentError ? <p role="alert" className="rounded-lg border border-[#e8b4ae] bg-white p-3 text-xs text-[#922f25]">{attachmentError}</p> : null}
    {filtered.length === 0 ? <div className="rounded-xl border border-[#e1e4ea] bg-white p-10 text-center"><Mail size={22} className="mx-auto text-[#7e8490]"/><h2 className="mt-3 text-sm font-semibold">{rows.length ? "Nenhum pedido encontrado" : "Caixa de entrada vazia"}</h2><p className="mt-1 text-xs text-[#777c87]">{rows.length ? "Altere o termo de pesquisa." : "Ainda não existem pedidos persistidos em contact_submissions."}</p></div> :
      filtered.map((row) => {
        const id = txt(row["id"]);
        const open = expanded === id;
        const attachments = Array.isArray(row["attachment_paths"]) ? row["attachment_paths"].filter((value): value is string => typeof value === "string") : [];
        return <article key={id} className="rounded-xl border border-[#e1e4ea] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{txt(row["name"])}</h2><p className="mt-1 break-all text-xs text-[#636977]">{txt(row["email"])}{row["company"] ? " · " + txt(row["company"]) : ""}</p><p className="mt-1 text-[11px] text-[#858a95]">{txt(row["request_type"])} · {txt(row["created_at"])}</p></div>{stateBadge(row["status"])}<button type="button" onClick={() => {setExpanded(open ? null : id);setNotes((current) => ({...current,[id]:current[id] ?? txt(row["internal_notes"])}));}} className="h-8 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#243d98]">{open ? "Fechar detalhes" : "Ver detalhes"}</button><select aria-label={"Alterar estado de " + txt(row["name"])} value={txt(row["status"])} onChange={(e) => onStatus({...row,internal_notes:notes[id] ?? row["internal_notes"]},e.target.value as "new"|"in_review"|"replied"|"archived")} disabled={busy} className="h-8 rounded-lg border border-[#dfe2e8] bg-white px-2 text-xs focus-visible:outline-2 focus-visible:outline-[#243d98]"><option value="new">Novo</option><option value="in_review">Em análise</option><option value="replied">Respondido</option><option value="archived">Arquivado</option></select></div>
          {open ? <div className="mt-4 border-t border-[#eff0f4] pt-4"><h3 className="text-xs font-semibold">Mensagem</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b505b]">{txt(row["message"])}</p>
            {row["links"] ? <div className="mt-3"><p className="text-xs font-semibold">Links enviados</p><pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-[#f7f8fa] p-3 text-xs">{JSON.stringify(row["links"],null,2)}</pre></div> : null}
            {attachments.length ? <section className="mt-4 border-t border-[#eff0f4] pt-4"><h3 className="text-xs font-semibold">Anexos privados ({attachments.length})</h3><p className="mt-1 text-xs leading-5 text-[#777c87]">O servidor verifica a associação ao pedido. Os links expiram após 2 minutos.</p><div className="mt-3 space-y-2">{attachments.map((path) => {const key=id+":"+path;const url=urls[key];return <div key={path} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e6e8ed] p-3"><span className="min-w-0 flex-1 break-all font-mono text-[10px]">{path.split("/").pop()}</span>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[#17295f] px-3 py-2 text-[11px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-[#243d98]"><ExternalLink size={12}/>Abrir anexo</a> : <button type="button" onClick={() => void getSignedUrl(row,path)} disabled={busy||loadingPath===key} className="rounded-md border border-[#dfe2e8] px-3 py-2 text-[11px] font-semibold disabled:opacity-50">{loadingPath===key ? "A gerar link..." : "Gerar link de 2 minutos"}</button>}</div>;})}</div></section> : null}
            <label className="mt-4 block text-xs font-semibold" htmlFor={"contact-notes-"+id}>Notas internas<textarea id={"contact-notes-"+id} value={notes[id]??""} onChange={(e)=>setNotes((current)=>({...current,[id]:e.target.value}))} maxLength={4000} rows={3} className="mt-2 w-full rounded-lg border border-[#dfe2e8] px-3 py-2 text-sm outline-none focus-visible:border-[#3b5ccc] focus-visible:ring-2 focus-visible:ring-[#3b5ccc]/20"/></label><p className="mt-1 text-[10px] text-[#888d97]">As notas são persistidas com a alteração de estado.</p><button type="button" onClick={()=>onStatus({...row,internal_notes:notes[id]??txt(row["internal_notes"])},txt(row["status"]) as "new"|"in_review"|"replied"|"archived")} disabled={busy} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#17295f] px-3 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/>Guardar estado e notas</button></div> : null}
        </article>;
      })}
  </div>;
}

export function MediaLibraryView({ rows, inventory, storage, onRefresh, onNotice }: {
  rows: Row[]; inventory: TableState | undefined; storage: StorageState | undefined;
  onRefresh: () => Promise<void>; onNotice: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [mime, setMime] = useState("all");
  const [file, setFile] = useState<File|null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [references, setReferences] = useState<Record<string,{loading:boolean;values:string[]|null;error?:string}>>({});
  const items = rows.filter((r)=>[r["original_name"],r["object_path"],r["alt_text"],r["caption"],r["content_type"]].some((v)=>txt(v).toLowerCase().includes(query.trim().toLowerCase())) && (mime==="all"||txt(r["content_type"])===mime));
  const publicUrl = (r:Row) => {
    const path=txt(r["object_path"]);
    return txt(r["bucket_id"])==="portfolio-public-assets"&&path
       ? SUPABASE_URL.replace(/\/+$/,"")+"/storage/v1/object/public/portfolio-public-assets/"+path.split("/").map(encodeURIComponent).join("/")
      : null;
  };

  async function upload() {
    if(!file||uploading)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size<=0||file.size>15*1024*1024||!alt.trim()){
      onNotice("error","Seleccione PNG, JPG ou WEBP até 15 MB e preencha o texto alternativo. A validação definitiva é repetida no servidor.");return;
    }
    setUploading(true);
    let path:string|null=null,uploaded=false,persisted=false;
    try{
      const intent=await createMediaUploadFn({data:{originalName:file.name,contentType:file.type as "image/png"|"image/jpeg"|"image/webp",byteSize:file.size}}) as {path:string;uploadUrl:string};
      path=intent.path;
      const response=await fetch(intent.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
      if(!response.ok)throw new Error("O upload temporário falhou. O asset não foi registado.");
      uploaded=true;
      const done=await completeMediaUploadFn({data:{path:intent.path,originalName:file.name,contentType:file.type as "image/png"|"image/jpeg"|"image/webp",byteSize:file.size,altText:alt.trim(),caption:caption.trim()}}) as {asset:Row;publicUrl:string;auditRecorded:boolean};
      persisted=true;setFile(null);setAlt("");setCaption("");
      onNotice(done.auditRecorded?"success":"info",done.auditRecorded?"Imagem carregada, validada pelos bytes reais e registada na base de dados.":"Imagem registada, mas o evento de auditoria não pôde ser confirmado.");
      await onRefresh().catch(()=>undefined);
    }catch(err){
      if(uploaded&&path&&!persisted)await cancelMediaUploadFn({data:{path}}).catch(()=>undefined);
      onNotice(persisted?"info":"error",persisted?"O asset ficou guardado, mas a lista não actualizou. Use Actualizar dados.":err instanceof Error?err.message:"O upload não foi confirmado.");
    }finally{setUploading(false);}
  }

  async function showReferences(row:Row){
    const id=txt(row["id"]);setReferences((c)=>({...c,[id]:{loading:true,values:null}}));
    try{const result=await listMediaAssetReferencesFn({data:{id}}) as {references:string[]};setReferences((c)=>({...c,[id]:{loading:false,values:result.references}}));}
    catch(err){setReferences((c)=>({...c,[id]:{loading:false,values:null,error:err instanceof Error?err.message:"Não foi possível verificar as referências."}}));}
  }
  async function remove(row:Row){
    const id=txt(row["id"]),name=txt(row["original_name"])||txt(row["object_path"]);
    if(!window.confirm('Remover "'+name+'"? A remoção só prossegue se o servidor confirmar que o asset não está referenciado.'))return;
    setDeleting(id);
    try{await deleteMediaAssetFn({data:{id}});onNotice("success","Asset removido do armazenamento e do inventário.");await onRefresh().catch(()=>undefined);}
    catch(err){onNotice("error",err instanceof Error?err.message:"O asset não foi removido.");}
    finally{setDeleting(null);}
  }
  return <div className="space-y-4">
    <section className="rounded-xl border border-[#dfe3ed] bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Upload size={16} className="text-[#344c9a]"/><h2 className="text-sm font-semibold">Carregar imagem pública</h2></div><p className="mt-1 text-xs leading-5 text-[#687080]">PNG, JPG e WEBP, até 15 MB e 40 megapíxeis. O servidor verifica a assinatura binária, dimensões, MIME, tamanho e hash. SVG não é aceite sem sanitização.</p>
      <form onSubmit={(e)=>{e.preventDefault();void upload();}} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold">Ficheiro *<input type="file" accept="image/png,image/jpeg,image/webp" required onChange={(e)=>setFile(e.target.files?.[0]??null)} className="mt-2 block w-full text-xs"/></label><label className="block text-xs font-semibold">Texto alternativo *<input required maxLength={300} value={alt} onChange={(e)=>setAlt(e.target.value)} placeholder="Descreva a imagem" className="mt-2 h-10 w-full rounded-lg border border-[#dfe2e8] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#243d98]"/></label><label className="block text-xs font-semibold sm:col-span-2">Legenda opcional<input maxLength={500} value={caption} onChange={(e)=>setCaption(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#dfe2e8] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#243d98]"/></label>{file?<p className="sm:col-span-2 rounded-lg bg-[#f7f8fa] p-3 text-xs">{file.name} · {file.type||"MIME não declarado"} · {(file.size/(1024*1024)).toFixed(2)} MB</p>:null}<div className="sm:col-span-2"><button type="submit" disabled={uploading||!file||!alt.trim()||storage?.status!=="ready"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17295f] px-4 text-sm font-semibold text-white disabled:opacity-50">{uploading?<RefreshCw size={14} className="animate-spin"/>:<Upload size={14} />}{uploading?"A validar e guardar...":"Carregar e registar asset"}</button>{storage?.status!=="ready"?<p role="alert" className="mt-2 text-xs text-[#922f25]">O estado do armazenamento não foi confirmado. Upload desactivado.</p>:null}</div></form>
    </section>
    <section className="rounded-xl border border-[#e1e4ea] bg-white p-4"><div className="flex flex-wrap gap-3"><label className="relative block min-w-[180px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]"/><input value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Pesquisar assets" placeholder="Pesquisar nome, caminho ou texto alternativo" className="h-10 w-full rounded-lg border border-[#dfe2e8] pl-8 pr-3 text-xs focus-visible:outline-2 focus-visible:outline-[#243d98]"/></label><label className="text-xs">Tipo <select value={mime} onChange={(e)=>setMime(e.target.value)} className="ml-2 h-10 rounded-lg border border-[#dfe2e8] bg-white px-2 text-xs"><option value="all">Todos</option><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select></label></div><p className="mt-3 text-xs text-[#6f7480]">{items.length} de {rows.length} assets carregados.</p></section>
    {!items.length?<div className="rounded-xl border border-[#e1e4ea] bg-white p-10 text-center"><FileImage size={24} className="mx-auto text-[#7d8491]"/><p className="mt-3 text-sm font-semibold">Nenhum asset encontrado</p><p className="mt-1 text-xs text-[#777c87]">{rows.length?"Altere os filtros de pesquisa.":"Ainda não existem assets registados; as origens que não foram recuperadas continuam no inventário."}</p></div>:items.map((row)=>{
      const id=txt(row["id"]),url=publicUrl(row),ref=references[id];
      return <article key={id} className="grid gap-4 rounded-xl border border-[#e1e4ea] bg-white p-4 shadow-sm sm:grid-cols-[120px_minmax(0,1fr)]"><div className="flex min-h-[100px] items-center justify-center overflow-hidden rounded-lg bg-[#f4f5f7]">{url?<img src={url} alt={txt(row["alt_text"])} loading="lazy" className="max-h-32 w-full object-contain"/>:<FileImage size={26} className="text-[#777c87]"/>}</div><div className="min-w-0"><p className="break-words text-sm font-semibold">{txt(row["original_name"])||txt(row["object_path"])}</p><p className="mt-1 break-all font-mono text-[10px] text-[#777c87]">{txt(row["bucket_id"])} / {txt(row["object_path"])}</p><p className="mt-1 text-xs text-[#5d626e]">{txt(row["content_type"])} · {txt(row["byte_size"])} bytes · {row["width"]&&row["height"]?txt(row["width"])+" × "+txt(row["height"])+" px":"Dimensões indisponíveis"}</p><p className="mt-1 text-xs text-[#5d626e]">Alt: {txt(row["alt_text"])||"Não definido"}{row["caption"]?" · "+txt(row["caption"]):""}</p>{row["sha256"]?<p className="mt-1 font-mono text-[10px] text-[#8a8f99]">SHA-256 {txt(row["sha256"]).slice(0,16)}…</p>:null}{url?<p className="mt-2"><a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d468f] underline underline-offset-2"><ExternalLink size={12}/>Abrir URL pública</a></p>:null}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>void showReferences(row)} disabled={ref?.loading} className="h-8 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold disabled:opacity-50">{ref?.loading?"A verificar...":"Ver referências"}</button><button type="button" onClick={()=>void remove(row)} disabled={deleting===id} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8aaa4] px-3 text-xs font-semibold text-[#922f25] disabled:opacity-50"><Trash2 size={12}/>{deleting===id?"A remover...":"Remover asset"}</button></div>{ref?.error?<p role="alert" className="mt-2 text-xs text-[#922f25]">{ref.error}</p>:null}{ref?.values?<div className="mt-2 rounded-lg bg-[#f7f8fa] p-3 text-xs"><p className="font-semibold">Referências encontradas: {ref.values.length}</p>{ref.values.length?<ul className="mt-2 list-disc space-y-1 pl-4">{ref.values.map((v)=> <li key={v}>{v}</li>)}</ul>:<p className="mt-1 text-[#6f7480]">O servidor não encontrou referências actuais e volta a verificar antes de apagar.</p>}</div>:null}</div></article>;
    })}
    <section className="rounded-xl border border-[#e1e4ea] bg-white p-4"><h2 className="text-sm font-semibold">Inventário de origens ainda não migradas</h2>{inventory?.error?<p role="alert" className="mt-2 text-xs text-[#922f25]">{inventory.error}</p>:<p className="mt-2 text-xs leading-5 text-[#666b76]">{inventory?.rows.length??0} manifestos visíveis. {inventory?.rows.filter((r)=>r["migration_status"]!=="uploaded").length??0} continuam por migrar. Os caminhos originais mantêm-se até os binários serem recuperados e verificados.</p>}<p className="mt-1 text-[11px] text-[#777c87]">Buckets: {storage?.status==="ready"?(storage.buckets??[]).map((b)=>b.name+" ("+(b.public?"público":"privado")+")").join(", "):storage?.error??"Estado não confirmado"}.</p></section>
  </div>;
}

export function NewsletterManagementView({ rows, error, stateBadge }: { rows: Row[]; error: string|null; stateBadge: Badge }) {
  const [query,setQuery]=useState("");
  const filtered=rows.filter((r)=>["email","status","consent_text_version"].some((k)=>txt(r[k]).toLowerCase().includes(query.trim().toLowerCase())));
  function exportCsv(){
    const columns=["email","status","consent_text_version","requested_at","confirmed_at","unsubscribed_at"];
    const escape=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const csv=[columns.join(","),...filtered.map((r)=>columns.map((k)=>escape(r[k])).join(","))].join("\\r\\n");
    const url=URL.createObjectURL(new Blob(["\\ufeff",csv],{type:"text/csv;charset=utf-8;"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download="kutuzov-newsletter-export.csv";anchor.click();URL.revokeObjectURL(url);
  }
  if(error)return <div role="alert" className="rounded-xl border border-[#e8b4ae] bg-white p-5 text-sm text-[#922f25]">{error}</div>;
  return <div className="rounded-xl border border-[#e1e4ea] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaf0] p-4"><div><h2 className="text-sm font-semibold">Subscritores da newsletter</h2><p className="mt-1 text-xs text-[#777c87]">Só endereços confirmados são activos. A exportação limita-se aos registos carregados e filtrados.</p></div><button type="button" onClick={exportCsv} disabled={!filtered.length} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold disabled:opacity-50"><Download size={14}/>Exportar CSV</button></div><div className="p-4"><label className="relative block max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Pesquisar email, estado ou consentimento" aria-label="Pesquisar subscritores" className="h-9 w-full rounded-lg border border-[#dfe2e8] pl-8 pr-3 text-xs"/></label></div>{!filtered.length?<p className="p-10 text-center text-sm text-[#727784]">{rows.length?"Nenhum subscritor corresponde à pesquisa.":"Não existem subscritores registados."}</p>:<div className="divide-y divide-[#eff0f4]">{filtered.map((row)=><div key={txt(row["id"])} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{txt(row["email"])}</p><p className="mt-1 text-[10px] text-[#7a7f8b]">Pedido: {txt(row["requested_at"])} · Confirmado: {txt(row["confirmed_at"])||"não confirmado"} · Cancelado: {txt(row["unsubscribed_at"])||"não"}</p><p className="mt-1 text-[10px] text-[#7a7f8b]">Consentimento: {txt(row["consent_text_version"])||"indisponível"}</p></div>{stateBadge(row["status"])}</div>)}</div>}</div>;
}

export function EmailOutboxView({ rows, error, busy, onRefresh, stateBadge }: { rows: Row[]; error: string|null; busy: boolean; onRefresh:()=>Promise<void>; stateBadge:Badge }) {
  const [query,setQuery]=useState("");
  const [retrying,setRetrying]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<{tone:"success"|"error";text:string}|null>(null);
  const filtered=rows.filter((r)=>["message_type","recipient","status","last_error"].some((k)=>txt(r[k]).toLowerCase().includes(query.trim().toLowerCase())));
  async function retry(id:string){
    if(retrying||busy)return;
    setRetrying(id);setFeedback(null);
    try{await retryEmailOutboxFn({data:{id}});setFeedback({tone:"success",text:"O fornecedor confirmou a entrega. A fila será actualizada."});await onRefresh().catch(()=>undefined);}
    catch(err){setFeedback({tone:"error",text:err instanceof Error?err.message:"A tentativa falhou. O estado não foi apresentado como enviado."});await onRefresh().catch(()=>undefined);}
    finally{setRetrying(null);}
  }
  if(error)return <div role="alert" className="rounded-xl border border-[#e8b4ae] bg-white p-5 text-sm text-[#922f25]">{error}</div>;
  return <div className="space-y-3"><div className="rounded-xl border border-[#e1e4ea] bg-white p-4"><h2 className="text-sm font-semibold">Fila persistente de email</h2><p className="mt-1 text-xs leading-5 text-[#6f7480]">As falhas ficam registadas quando o fornecedor não está configurado. O sucesso só é mostrado após aceitação pela API de email.</p><label className="relative mt-3 block max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Pesquisar destinatário, tipo ou erro" aria-label="Pesquisar fila de email" className="h-9 w-full rounded-lg border border-[#dfe2e8] pl-8 pr-3 text-xs"/></label></div>{feedback?<p role={feedback.tone==="error"?"alert":"status"} className={"rounded-lg border p-3 text-xs "+(feedback.tone==="error"?"border-[#e8b4ae] bg-white text-[#922f25]":"border-[#b8dfc6] bg-[#eff9f2] text-[#17653b]")}>{feedback.text}</p>:null}{!filtered.length?<div className="rounded-xl border border-[#e1e4ea] bg-white p-10 text-center"><Mail size={22} className="mx-auto text-[#7e8490]"/><p className="mt-3 text-sm font-semibold">Fila sem envios correspondentes</p><p className="mt-1 text-xs text-[#777c87]">{rows.length?"Altere a pesquisa.":"Não existem notificações de exemplo."}</p></div>:filtered.map((row)=>{const id=txt(row["id"]);return <article key={id} className="rounded-xl border border-[#e1e4ea] bg-white p-4"><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{txt(row["message_type"])}</p><p className="mt-1 break-all text-xs">{txt(row["recipient"])}</p><p className="mt-1 text-[10px] text-[#7a7f8b]">Tentativas: {txt(row["attempts"])} · Próxima tentativa: {txt(row["next_attempt_at"])||"sem agendamento"}</p>{row["last_error"]?<p className="mt-2 text-xs text-[#922f25]">Erro: {txt(row["last_error"])}</p>:null}</div>{stateBadge(row["status"])}<button type="button" onClick={()=>void retry(id)} disabled={busy||retrying!==null||!["failed","pending"].includes(txt(row["status"]))} className="h-9 rounded-lg border border-[#dfe2e8] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">{retrying===id?"A enviar...":"Tentar novamente"}</button></div></article>;})}</div>;
}
