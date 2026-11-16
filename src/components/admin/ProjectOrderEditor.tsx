import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Check, GripVertical,
  ListOrdered, RotateCcw, Save, Search, Undo2, X,
} from "lucide-react";
import { resolvePublicAssetUrl } from "@/lib/public-assets";
import {
  idsFromProjects, isExactOrder, moveProjectId, positionLabel,
  publishedProjectRows, visibleProjectIds, type ProjectOrderRecord,
} from "@/lib/admin-project-order";

type SavedOrder = { before: string[]; after: string[] };
type Props = {
  records: ProjectOrderRecord[];
  saving: boolean;
  savedOrder: SavedOrder | null;
  onPublish: (next: string[], previous: string[]) => Promise<void>;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function previewSource(project: ProjectOrderRecord): string {
  const gallery = Array.isArray(project.gallery) ? project.gallery :
    typeof project.gallery === "string" ? (() => {
      try { return JSON.parse(project.gallery) as unknown; } catch { return []; }
    })() : [];
  const first = Array.isArray(gallery) && typeof gallery[0] === "string" ? gallery[0] : "";
  return resolvePublicAssetUrl(project.cover_path || first);
}

const control = "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#dce1eb] bg-white text-[#37415c] transition hover:border-[#97a7d1] hover:bg-[#eef2fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:cursor-not-allowed disabled:opacity-25";
const secondary = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#dce1eb] bg-white px-3 text-xs font-semibold text-[#293b67] transition hover:bg-[#f0f3fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-40";

export function ProjectOrderEditor({ records, saving, savedOrder, onPublish, onClose, onDirtyChange }: Props) {
  const published = useMemo(() => publishedProjectRows(records), [records]);
  const baseline = useMemo(() => idsFromProjects(published), [published]);
  const baselineKey = baseline.join("|");
  const byId = useMemo(() => new Map(published.map(row => [row.id, row])), [published]);
  const [order, setOrder] = useState<string[]>(baseline);
  const [history, setHistory] = useState<string[][]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [positionDraft, setPositionDraft] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startY: number; active: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrder(baseline);
    setHistory([]);
    setConfirming(false);
    setPositionDraft({});
    setDragId(null);
    setMessage("");
    setError("");
    // The baseline is deliberately the complete published order, not the search results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineKey]);

  const categories = useMemo(() => Array.from(new Set(published.map(row => row.discipline)))
    .filter(Boolean).sort((a, b) => a.localeCompare(b)), [published]);
  const visible = useMemo(() => visibleProjectIds(order, byId, search, category),
    [order, byId, search, category]);
  const changed = !isExactOrder(order, baseline);
  const movingCount = order.filter((id, index) => baseline[index] !== id).length;
  useEffect(() => { onDirtyChange?.(changed); }, [changed, onDirtyChange]);
  const canDrag = !search.trim() && !category && !saving;
  const canRevertLastPublish = !changed && Boolean(savedOrder) &&
    savedOrder !== null && isExactOrder(savedOrder.after, baseline);
  const previousPublishedOrder = savedOrder?.before ?? [];

  function setNewOrder(next: string[], label: string) {
    if (saving || isExactOrder(next, order)) return;
    setHistory(current => [...current.slice(-29), order]);
    setOrder(next);
    setConfirming(false);
    setError("");
    setMessage(label);
  }

  function moveTo(id: string, targetIndex: number) {
    const next = moveProjectId(order, id, targetIndex);
    const target = next.indexOf(id);
    if (target !== order.indexOf(id)) {
      setNewOrder(next, `“${byId.get(id)?.title ?? "Trabalho"}” → posição ${target + 1} de ${order.length}.`);
      setPositionDraft(current => {
        const nextDraft = { ...current };
        delete nextDraft[id];
        return nextDraft;
      });
    }
  }

  function commitPosition(id: string) {
    const raw = positionDraft[id];
    if (raw === undefined) return;
    const number = Number(raw);
    if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(number) ||
        number < 1 || number > order.length) {
      setError(`Introduza uma posição entre 1 e ${order.length}.`);
      setPositionDraft(current => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    moveTo(id, number - 1);
    setPositionDraft(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function undo() {
    if (saving || !history.length) return;
    const previous = history[history.length - 1]!;
    setHistory(history.slice(0, -1));
    setOrder(previous);
    setConfirming(false);
    setError("");
    setMessage("Última movimentação desfeita.");
  }

  function reset() {
    if (saving) return;
    setOrder(baseline);
    setHistory([]);
    setPositionDraft({});
    setConfirming(false);
    setMessage("Ordem publicada restaurada na pré-visualização.");
    setError("");
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!canDrag || event.button !== 0) return;
    dragRef.current = { id, startY: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = dragRef.current;
    if (!active || !canDrag) return;
    if (!active.active && Math.abs(event.clientY - active.startY) < 6) return;
    active.active = true;
    setDragId(active.id);

    const list = scrollRef.current;
    if (list) {
      const bounds = list.getBoundingClientRect();
      if (event.clientY > bounds.bottom - 42) list.scrollTop += 16;
      if (event.clientY < bounds.top + 42) list.scrollTop -= 16;
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = element?.closest<HTMLElement>("[data-project-sort-id]");
    const targetId = target?.dataset["projectSortId"];
    if (targetId && targetId !== active.id) moveTo(active.id, order.indexOf(targetId));
  }

  function exitEditor() {
    if (saving) return;
    if (changed && !window.confirm("Descartar as alterações de ordem ainda não publicadas?")) return;
    onClose();
  }

  function pointerEnd() {
    dragRef.current = null;
    setDragId(null);
  }

  async function publish() {
    if (saving || !changed) return;
    setError("");
    try {
      await onPublish(order, baseline);
      setConfirming(false);
      setHistory([]);
      setMessage("Ordem publicada com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A publicação falhou. A ordem local foi mantida.");
    }
  }

  if (!published.length) {
    return <div className="rounded-xl border border-[#e1e4ea] bg-white p-6">
      <p className="text-sm text-[#626774]">Não existem trabalhos publicados para organizar.</p>
      <button type="button" onClick={onClose} className={secondary}>Voltar aos projectos</button>
    </div>;
  }

  return <section aria-label="Organizar ordem dos trabalhos" className="overflow-hidden rounded-xl border border-[#e1e4ea] bg-white shadow-sm" data-project-order-editor>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8eaf0] p-4 sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[#17295f]"><ListOrdered size={19} /><h2 className="text-base font-semibold sm:text-lg">Organizar trabalhos</h2></div>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[#636b79]">
          Ordem global de {published.length} trabalhos publicados. Arraste pelo manípulo, use as setas ou escreva directamente a posição (1–{published.length}).
          Tudo permanece em pré-visualização até confirmar a publicação.
        </p>
      </div>
      <button type="button" onClick={exitEditor} disabled={saving}
        className={secondary}><X size={15} /> Voltar à galeria</button>
    </header>

    <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0f5] bg-[#fcfcfe] p-4 sm:px-6">
      <label className="relative min-w-[175px] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888e9b]" />
        <input aria-label="Pesquisar trabalhos para organizar" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Pesquisar trabalho ou código..." className="h-10 w-full rounded-lg border border-[#dfe2e9] bg-white pl-9 pr-3 text-sm outline-none focus-visible:border-[#4f69ba]" />
      </label>
      <select aria-label="Filtrar trabalhos por categoria" value={category} onChange={event => setCategory(event.target.value)}
        className="h-10 min-w-0 max-w-full rounded-lg border border-[#dfe2e9] bg-white px-3 text-xs focus-visible:outline-2 focus-visible:outline-[#243d98]">
        <option value="">Todas as categorias</option>
        {categories.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <span className="whitespace-nowrap rounded-lg bg-[#edf1fb] px-3 py-2 text-xs font-medium text-[#29427b]">
        {visible.length} / {order.length}
      </span>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-b border-[#e8eaf0] px-4 py-3 sm:px-6">
      <button type="button" className={secondary} onClick={undo} disabled={saving || !history.length}>
        <Undo2 size={14} /> Desfazer movimento
      </button>
      <button type="button" className={secondary} onClick={reset} disabled={saving || !changed}>
        <RotateCcw size={14} /> Repor ordem
      </button>
      {canRevertLastPublish && <button type="button" className={secondary} onClick={() => {
        setNewOrder(previousPublishedOrder, "Última ordem publicada preparada para reversão. Confirme para publicar.");
        setConfirming(true);
      }} disabled={saving}>
        <RotateCcw size={14} /> Reverter última publicação
      </button>}
      <span aria-live="polite" className="ml-auto text-xs text-[#606776]">
        {changed ? `${movingCount} posições alteradas · por publicar` : "Sem alterações pendentes"}
      </span>
    </div>

    {(search.trim() || category) && <p className="px-4 py-2 text-[11px] text-[#6b7180] sm:px-6">
      A numeração apresentada é sempre global. Para arrastar, limpe os filtros; pode alterar a posição directamente mesmo com filtros activos.
    </p>}

    <div ref={scrollRef} className="max-h-[min(67vh,780px)] divide-y divide-[#edf0f4] overflow-y-auto overscroll-contain" data-project-order-list>
      {visible.length === 0 ? <p className="p-10 text-center text-sm text-[#727986]">Nenhum trabalho corresponde à pesquisa.</p> :
      visible.map(id => {
        const row = byId.get(id)!;
        const index = order.indexOf(id);
        const source = previewSource(row);
        const video = row.project_type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(source);
        return <div key={id} data-project-sort-id={id} data-order-position={index + 1}
          className={`flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors sm:px-5 ${dragId === id ? "bg-[#e9efff]" : "hover:bg-[#fafbfe]"}`}>
          <button type="button" aria-label={`Arrastar ${row.title} para outra posição`}
            title={canDrag ? "Arraste para reorganizar; no teclado use ↑ e ↓" : "Limpe os filtros para arrastar"}
            disabled={!canDrag} onPointerDown={event => pointerDown(event, id)}
            onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                moveTo(id, index + (event.key === "ArrowUp" ? -1 : 1));
              }
            }} className="inline-flex h-10 w-8 shrink-0 touch-none items-center justify-center rounded-md text-[#738098] hover:bg-[#e8edf8] focus-visible:outline-2 focus-visible:outline-[#243d98] disabled:opacity-30">
            <GripVertical size={19} />
          </button>
          <span className="w-10 shrink-0 font-mono text-xs font-semibold tabular-nums text-[#263b70]" aria-label={`Posição ${index + 1}`}>{positionLabel(index, order.length)}</span>
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#171b25]">
            {source && !video ? <img src={source} alt="" loading="lazy" className="size-full object-cover" /> :
              <span className="text-[10px] font-medium text-white/75">{video ? "VIDEO" : "ARTE"}</span>}
          </div>
          <div className="min-w-[125px] flex-1">
            <p className="truncate text-sm font-semibold text-[#272d3a]" title={row.title}>{row.title}</p>
            <p className="truncate text-[11px] text-[#6e7684]">{row.discipline || "Sem categoria"} · /{row.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-label={`Colocar ${row.title} no início`} title="Primeiro"
              className={control} onClick={() => moveTo(id, 0)} disabled={saving || index === 0}><ArrowUpToLine size={15}/></button>
            <button type="button" aria-label={`Subir ${row.title}`} title="Subir um"
              className={control} onClick={() => moveTo(id, index - 1)} disabled={saving || index === 0}><ArrowUp size={15}/></button>
            <label className="flex items-center gap-1 rounded-lg border border-[#dce1eb] bg-white px-2 text-[11px] font-medium text-[#606a7c]">
              <span className="sr-only">Nova posição de {row.title}</span>
              <span aria-hidden="true">N.º</span>
              <input type="number" min={1} max={order.length} step={1} disabled={saving}
                aria-label={`Posição de ${row.title}`} value={positionDraft[id] ?? String(index + 1)}
                onChange={event => setPositionDraft(current => ({ ...current, [id]: event.target.value }))}
                onBlur={() => commitPosition(id)}
                onKeyDown={event => {
                  if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                  if (event.key === "Escape") {
                    setPositionDraft(current => { const next = { ...current }; delete next[id]; return next; });
                    event.currentTarget.blur();
                  }
                }} className="h-8 w-12 bg-transparent text-center text-xs font-semibold tabular-nums text-[#263b70] outline-none disabled:opacity-40" />
            </label>
            <button type="button" aria-label={`Descer ${row.title}`} title="Descer um"
              className={control} onClick={() => moveTo(id, index + 1)} disabled={saving || index === order.length - 1}><ArrowDown size={15}/></button>
            <button type="button" aria-label={`Colocar ${row.title} no fim`} title="Último"
              className={control} onClick={() => moveTo(id, order.length - 1)} disabled={saving || index === order.length - 1}><ArrowDownToLine size={15}/></button>
          </div>
        </div>;
      })}
    </div>

    <footer className="space-y-3 border-t border-[#e2e6ee] bg-white px-4 py-4 sm:px-6">
      {message && <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-[#316044]"><Check size={14}/>{message}</p>}
      {error && <p role="alert" className="text-xs font-medium text-[#aa352d]">{error}</p>}
      {confirming && changed && <div role="group" aria-label="Confirmar publicação da ordem" className="rounded-lg border border-[#c6d2ed] bg-[#f3f6ff] p-4">
        <p className="text-sm font-semibold text-[#233e83]">Publicar nova ordem dos {order.length} trabalhos?</p>
        <p className="mt-1 text-xs leading-5 text-[#475b8b]">
          {movingCount} posições serão actualizadas. O portfólio público só muda depois de a transacção no Supabase terminar com sucesso.
          Os trabalhos arquivados, os destaques e os ficheiros não serão alterados.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#17295f] px-4 text-xs font-semibold text-white hover:bg-[#243d82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:opacity-50"
            disabled={saving} onClick={() => void publish()}><Save size={15}/>{saving ? "A publicar..." : "Confirmar e publicar"}</button>
          <button type="button" className={secondary} onClick={() => setConfirming(false)} disabled={saving}>Voltar à ordem</button>
        </div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[#6c7280]">{order.length} trabalhos publicados · ordem global 001–{positionLabel(order.length - 1, order.length)}</p>
        <button type="button" disabled={!changed || saving} onClick={() => { setError(""); setConfirming(true); }}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#17295f] px-4 text-xs font-semibold text-white hover:bg-[#243d82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243d98] disabled:cursor-not-allowed disabled:opacity-40">
          <Save size={15}/>{saving ? "A guardar..." : "Guardar e publicar ordem"}
        </button>
      </div>
    </footer>
  </section>;
}
