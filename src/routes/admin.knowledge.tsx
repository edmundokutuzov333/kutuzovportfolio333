import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminSessionFn } from "@/lib/admin-auth.functions";
import {
  loadKnowledgeFn, saveKnowledgeFn, rollbackKnowledgeFn, reindexKnowledgeFn,
} from "@/lib/jarvis-admin.functions";

export const Route = createFileRoute("/admin/knowledge")({ component: KnowledgePage });
type Workspace = Awaited<ReturnType<typeof loadKnowledgeFn>>;
type Fact = Workspace["facts"][number];
function KnowledgePage() {
  const sessionFn = useServerFn(getAdminSessionFn);
  const load = useServerFn(loadKnowledgeFn);
  const save = useServerFn(saveKnowledgeFn);
  const rollback = useServerFn(rollbackKnowledgeFn);
  const reindex = useServerFn(reindexKnowledgeFn);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<Fact | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const refresh = async () => {
    const next = await load();
    setWorkspace(next);
  };
  useEffect(() => {
    let live = true;
    void sessionFn().then((s) => {
      if (!live) return;
      setAuthenticated(!!s);
      if (s) void load().then((v) => { if (live) setWorkspace(v); })
        .catch(() => { if (live) setError("Não foi possível carregar a base de conhecimento."); });
    }).catch(() => { if (live) setAuthenticated(false); });
    return () => { live = false; };
  }, []);
  async function execute(callback: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await callback(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Operação falhou."); }
    finally { setBusy(false); }
  }
  const fieldClass = "w-full rounded-lg border border-white/20 bg-[#0b1731] px-3 py-2 text-sm text-white";
  if (authenticated === null) return <main className="min-h-screen bg-[#071126] p-10 text-white">A verificar autorização…</main>;
  if (!authenticated) return <main className="min-h-screen bg-[#071126] p-10 text-white"><h1 className="text-2xl">Área protegida</h1><a href="/admin" className="mt-5 block underline">Entrar no Admin</a></main>;
  return (
    <main className="min-h-screen bg-[#071126] px-5 py-7 text-[#eef5ff] md:px-10">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
        <div><p className="text-xs tracking-[.25em] text-blue-300">KUTUZOV / ADMIN</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Base de conhecimento</h1></div>
        <Link to="/admin" className="text-sm text-blue-200 underline">Voltar ao Admin</Link>
      </header>
      <div className="mx-auto max-w-7xl pt-7">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-blue-200">Versão {workspace?.version ?? "—"} · {workspace?.facts.length ?? 0} factos · {workspace?.documents ?? 0} documentos</p>
          <button type="button" disabled={busy} onClick={() => void execute(async () => { await reindex(); })}
            className="rounded-full border border-blue-300/50 px-5 py-3 text-sm hover:bg-blue-500/15 disabled:opacity-50">
            Reindexar trabalhos publicados
          </button>
        </div>
        {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/50 p-3 text-red-200">{error}</p>}
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(290px,.72fr)]">
          <section aria-label="Factos" className="min-w-0 rounded-2xl border border-white/15 bg-white/[.025] p-5">
            <label htmlFor="kb-find" className="mb-2 block text-xs text-blue-200">Encontrar facto</label>
            <input id="kb-find" className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="email, cliente, serviço…" />
            <div className="mt-5 max-h-[600px] overflow-y-auto">
            {workspace?.facts.filter(f => (f.key+" "+f.value).toLowerCase().includes(search.toLowerCase()))
              .map(f => <button type="button" key={f.key+f.locale} onClick={()=>setSelected(f)}
                className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border-b border-white/10 px-3 py-3 text-left hover:bg-blue-500/10">
                <span className="min-w-0 flex-1"><strong className="block text-sm">{f.key}</strong><small className="block truncate text-blue-100/70">{f.value}</small></span>
                <span className={"text-xs "+(f.status==="verified"?"text-green-300":"text-amber-300")}>{f.status}</span>
              </button>)}
            </div>
          </section>
          <section className="min-w-0 rounded-2xl border border-white/15 bg-white/[.025] p-5">
            <h2 className="mb-4 text-xl">Revisão editorial</h2>
            {selected ? (
              <form key={selected.key+selected.locale} className="grid gap-4" onSubmit={e=>{
                e.preventDefault();
                const data=new FormData(e.currentTarget);
                void execute(async () => { await save({data:{
                  key:selected.key, locale:selected.locale,
                  value:String(data.get("value")||""),
                  spoken:String(data.get("spoken")||"")||null,
                  status:String(data.get("status")) as Fact["status"],
                  visibility:String(data.get("visibility")) as Fact["visibility"],
                  priority:Number(data.get("priority")||100),
                  source:"admin:knowledge-review",
                }});setSelected(null);});
              }}>
                <p className="text-sm text-blue-200">{selected.key}</p>
                <label className="text-xs">Valor<textarea name="value" className={fieldClass+" min-h-32"} defaultValue={selected.value} required maxLength={2000}/></label>
                <label className="text-xs">Forma falada<input name="spoken" className={fieldClass} defaultValue={selected.spoken??""}/></label>
                <label className="text-xs">Estado<select name="status" defaultValue={selected.status} className={fieldClass}>
                  <option value="verified">verified</option><option value="pending_review">pending_review</option>
                  <option value="rejected">rejected</option><option value="deprecated">deprecated</option>
                </select></label>
                <label className="text-xs">Visibilidade<select name="visibility" defaultValue={selected.visibility} className={fieldClass}><option value="public">public</option><option value="private">private</option></select></label>
                <input name="priority" type="hidden" value={selected.priority} />
                <button disabled={busy} type="submit" className="rounded-lg bg-blue-600 p-3 text-sm font-semibold disabled:opacity-50">Guardar revisão</button>
              </form>
            ) : <p className="text-sm text-blue-200/70">Seleccione um facto para editar ou aprovar. Os valores não verificados nunca entram nas respostas.</p>}
            <h3 className="mb-2 mt-10 text-xs uppercase tracking-widest text-blue-200">Perguntas por resolver / sinalizadas</h3>
            <div className="max-h-40 space-y-2 overflow-auto">
              {workspace?.flags.map(flag=><p key={flag.id} className="rounded border border-white/10 p-2 text-xs">{flag.query_redacted||"[pergunta ocultada]"} · {flag.flag_reason||"sem resposta"}</p>)}
            </div>
          </section>
        </div>
        <section className="mt-8 rounded-2xl border border-white/15 bg-white/[.025] p-5">
          <h2 className="mb-3 text-xl">Histórico e reversão</h2>
          <div className="grid gap-2">
            {workspace?.revisions.slice(0,25).map(item=><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-2 text-xs" key={item.id}>
              <span>{item.fact_key} · {item.operation} · {new Date(item.changed_at).toLocaleString("pt-MZ")}</span>
              <button type="button" disabled={busy||!item.old_fact} className="rounded border border-blue-400/40 px-3 py-2 text-blue-100 disabled:opacity-30"
                onClick={()=>void execute(async()=>{await rollback({data:{id:item.id}});setSelected(null);})}>Repor versão anterior</button>
            </div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
