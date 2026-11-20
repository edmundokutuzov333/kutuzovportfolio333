import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Check, Edit3, GripVertical, ListOrdered, Pin, RotateCcw, Save, Search, Undo2, X } from "lucide-react";
import { resolvePublicAssetUrl } from "@/lib/public-assets";
import {
  idsFromProjects, isExactOrder, moveProjectId, moveSelectedProjectIds, positionLabel,
  publishedProjectRows, selectProjectRange, toggleProjectSelection, visibleProjectIds, type ProjectOrderRecord,
} from "@/lib/admin-project-order";

type SavedOrder = { before: string[]; after: string[] };
type Props = {
  records: ProjectOrderRecord[];
  saving: boolean;
  savedOrder: SavedOrder | null;
  onPublish: (next: string[], previous: string[]) => Promise<void>;
  onClose: () => void;
  onEdit?: (row: ProjectOrderRecord) => void;
  onToggleFeatured?: (ids: string[], featured: boolean) => Promise<void>;
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

const secondary = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#465777] bg-[#1d2940] px-3 text-xs font-semibold text-white transition hover:bg-[#2a3a59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#91a9ea] disabled:opacity-40";

export function ProjectOrderEditor({ records, saving, savedOrder, onPublish, onClose, onEdit = () => undefined, onToggleFeatured = async () => undefined, onDirtyChange }: Props) {
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [bulkPosition, setBulkPosition] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startY: number; active: boolean; lastTargetId: string | null; selectedIds: string[] } | null>(null);
  const orderRef = useRef(order);
  const selectedRef = useRef(selectedIds);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipPositionBlurRef = useRef<string | null>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => { selectedRef.current = selectedIds; }, [selectedIds]);

  useEffect(() => {
    setOrder(baseline);
    setHistory([]);
    setConfirming(false);
    setPositionDraft({});
    setDragId(null);
    setDragOverId(null);
    setMessage("");
    setError("");
    setSelectedIds([]);
    setSelectionAnchor(null);
    setBulkPosition("");
    // The baseline is deliberately the complete published order, not the search results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineKey]);

  const categories = ["Social Media", "Campaign design", "Manipulation", "Some dezaines*", "Video"];
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

  function applyBulkPosition() {
    const number = Number(bulkPosition.trim());
    if (!selectedIds.length || !/^\d+$/.test(bulkPosition.trim()) || !Number.isSafeInteger(number) || number < 1 || number > order.length) {
      setError(`Seleccione trabalhos e introduza uma posição entre 1 e ${order.length}.`);
      return;
    }
    setNewOrder(moveSelectedProjectIds(order, selectedIds, number - 1), `${selectedIds.length} trabalhos movidos para a posição ${number}.`);
    setBulkPosition("");
  }

  function selectRow(event: MouseEvent, id: string) {
    const extend = event.metaKey || event.ctrlKey;
    const next = event.shiftKey && selectionAnchor
      ? selectProjectRange(order, selectionAnchor, id)
      : toggleProjectSelection(selectedIds, id, extend);
    setSelectedIds(next);
    setSelectionAnchor(id);
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
    if (skipPositionBlurRef.current === id) {
      skipPositionBlurRef.current = null;
      return;
    }
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
    const movingIds = selectedRef.current.includes(id) ? selectedRef.current : [id];
    if (!selectedRef.current.includes(id)) { setSelectedIds([id]); setSelectionAnchor(id); }
    dragRef.current = { id, startY: event.clientY, active: false, lastTargetId: null, selectedIds: movingIds };
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
    if (targetId && targetId !== active.id) {
      setDragOverId(targetId);
      if (active.lastTargetId !== targetId) {
        active.lastTargetId = targetId;
        const next = moveSelectedProjectIds(orderRef.current, active.selectedIds, orderRef.current.indexOf(targetId));
        setNewOrder(next, `${active.selectedIds.length} trabalho${active.selectedIds.length === 1 ? "" : "s"} movido${active.selectedIds.length === 1 ? "" : "s"}.`);
      }
    }
  }

  function exitEditor() {
    if (saving) return;
    if (changed && !window.confirm("Descartar as alterações de ordem ainda não publicadas?")) return;
    onClose();
  }

  function pointerEnd() {
    dragRef.current = null;
    setDragId(null);
    setDragOverId(null);
  }

  async function publish() {
    if (saving || !changed) return;
    setError("");
    try {
      await onPublish(order, baseline);
      setConfirming(false);
      setHistory([]);
      setMessage("Ordem guardada para revisão.");
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
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#34425e] bg-[#111827] p-4 text-white sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-white"><ListOrdered size={19} /><h2 className="text-base font-semibold sm:text-lg">Organizar trabalhos</h2></div>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[#b8c3d8]">
          Ordem global de {published.length} trabalhos publicados. Arraste pelo manípulo, seleccione vários com Cmd/Ctrl ou Shift, arraste o bloco ou escreva a posição exacta (1-{published.length}).
          Tudo permanece em pré-visualização até confirmar a publicação.
        </p>
      </div>
      <button type="button" onClick={exitEditor} disabled={saving}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#4b5c7a] bg-[#1d2940] px-3 text-xs font-semibold text-white transition hover:bg-[#2a3a59]"> <X size={15} /> Voltar à galeria</button>
    </header>

    <div className="flex flex-wrap items-center gap-2 border-b border-[#34425e] bg-[#182238] p-4 sm:px-6">
      <label className="relative min-w-[175px] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888e9b]" />
        <input aria-label="Pesquisar trabalhos para organizar" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Pesquisar trabalho ou código..." className="h-10 w-full rounded-lg border border-[#465777] bg-[#0f172a] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#93a1b8] focus-visible:border-[#91a9ea]" />
      </label>
      <select aria-label="Filtrar trabalhos por categoria" value={category} onChange={event => setCategory(event.target.value)}
        className="h-10 min-w-0 max-w-full rounded-lg border border-[#465777] bg-[#0f172a] px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-[#91a9ea]">
        <option value="">All</option>
        {categories.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <span className="whitespace-nowrap rounded-lg bg-[#2b3c5e] px-3 py-2 text-xs font-medium text-white">
        {visible.length} / {order.length}
      </span>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-b border-[#34425e] bg-[#182238] px-4 py-3 text-white sm:px-6">
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
      {selectedIds.length > 0 && <>
        <span className="rounded-lg bg-[#314a80] px-3 py-2 text-xs font-semibold text-white">{selectedIds.length} seleccionados</span>
        <label className="flex items-center gap-1 rounded-lg border border-[#465777] bg-[#0f172a] px-2 text-xs text-[#cbd5e1]">Posição
          <input type="number" min={1} max={order.length} value={bulkPosition} onChange={event => setBulkPosition(event.target.value)} onKeyDown={event => { if (event.key === "Enter") applyBulkPosition(); }} placeholder="N.º" className="h-8 w-14 bg-transparent text-center text-white outline-none" />
        </label>
        <button type="button" className={secondary} onClick={applyBulkPosition} disabled={saving}>Mover bloco</button>
        <button type="button" className={secondary} onClick={() => void onToggleFeatured(selectedIds, true)} disabled={saving}><Pin size={14}/> Fixar seleccionados</button>
        <button type="button" className={secondary} onClick={() => void onToggleFeatured(selectedIds, false)} disabled={saving}>Desfixar seleccionados</button>
        <button type="button" className={secondary} onClick={() => { setSelectedIds([]); setSelectionAnchor(null); }} disabled={saving}><X size={14}/> Limpar</button>
      </>}
      <span aria-live="polite" className="ml-auto text-xs text-[#b8c3d8]">
        {changed ? `${movingCount} posições alteradas · por publicar` : "Sem alterações pendentes"}
      </span>
    </div>

    {(search.trim() || category) && <p className="px-4 py-2 text-[11px] text-[#6b7180] sm:px-6">
      A numeração apresentada é sempre global. Para arrastar, limpe os filtros; pode alterar a posição directamente mesmo com filtros activos.
    </p>}

    <div ref={scrollRef} className="max-h-[min(67vh,780px)] divide-y divide-[#34425e] overflow-y-auto overscroll-contain bg-[#0f172a]" data-project-order-list>
      {visible.length === 0 ? <p className="p-10 text-center text-sm text-[#727986]">Nenhum trabalho corresponde à pesquisa.</p> :
      visible.map(id => {
        const row = byId.get(id)!;
        const index = order.indexOf(id);
        const source = previewSource(row);
        const video = row.project_type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(source);
        return <div key={id} data-project-sort-id={id} data-order-position={index + 1}
          className={`flex flex-wrap items-center gap-3 border-l-2 px-3 py-2.5 text-white transition-colors sm:px-5 ${selectedIds.includes(id) ? "border-[#7da2ff] bg-[#1b2c4e]" : dragId === id ? "border-[#536bc1] bg-[#1b315f]" : dragOverId === id ? "border-[#3f5b8c] bg-[#17243c]" : "border-transparent hover:bg-[#172238]"}`}>
          <input type="checkbox" aria-label={`Seleccionar ${row.title}`} checked={selectedIds.includes(id)} onChange={() => {}} onClick={event => selectRow(event, id)} className="size-4 accent-[#7da2ff]" />
          <button type="button" aria-label={`Arrastar ${row.title} para outra posição`}
            title={canDrag ? "Arraste para reorganizar; no teclado use as setas" : "Limpe os filtros para arrastar"}
            disabled={!canDrag} onPointerDown={event => pointerDown(event, id)}
            onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                moveTo(id, index + (event.key === "ArrowUp" ? -1 : 1));
              }
            }} className="inline-flex h-10 w-8 shrink-0 touch-none items-center justify-center rounded-md text-[#aab8cf] hover:bg-[#2a3a59] focus-visible:outline-2 focus-visible:outline-[#91a9ea] disabled:opacity-30">
            <GripVertical size={19} />
          </button>
          <span className="w-10 shrink-0 font-mono text-xs font-semibold tabular-nums text-[#b8c3d8]" aria-label={`Posição ${index + 1}`}>{positionLabel(index, order.length)}</span>
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#171b25]">
            {source && !video ? <img src={source} alt="" loading="lazy" className="size-full object-cover" /> :
              <span className="text-[10px] font-medium text-white/75">{video ? "VIDEO" : "ARTE"}</span>}
          </div>
          <div className="min-w-[125px] flex-1">
            <p className="truncate text-sm font-semibold text-white" title={row.title}>{row.title}</p>
            <p className="truncate text-[11px] text-[#aab8cf]">{row.discipline || "Sem categoria"} · /{row.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 rounded-lg border border-[#465777] bg-[#182238] px-2 text-[11px] font-medium text-[#cbd5e1]">
              <span className="sr-only">Nova posição de {row.title}</span>
              <span aria-hidden="true">N.º</span>
              <input type="number" min={1} max={order.length} step={1} disabled={saving}
                aria-label={`Posição de ${row.title}`} value={positionDraft[id] ?? String(index + 1)}
                onChange={event => setPositionDraft(current => ({ ...current, [id]: event.target.value }))}
                onBlur={() => commitPosition(id)}
                onKeyDown={event => {
                  if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                  if (event.key === "Escape") {
                    skipPositionBlurRef.current = id;
                    setPositionDraft(current => { const next = { ...current }; delete next[id]; return next; });
                    event.currentTarget.blur();
                  }
                }} className="h-8 w-12 bg-transparent text-center text-xs font-semibold tabular-nums text-white outline-none disabled:opacity-40" />
            </label>
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#465777] bg-[#182238] px-2.5 text-xs font-semibold text-white hover:bg-[#2a3a59]" onClick={() => onToggleFeatured([id], !row.featured)} disabled={saving}><Pin size={13}/>{row.featured ? "Desfixar" : "Fixar"}</button>
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#465777] bg-[#182238] px-2.5 text-xs font-semibold text-white hover:bg-[#2a3a59]" onClick={() => onEdit(row)} disabled={saving}><Edit3 size={13}/>Editar</button>
          </div>
        </div>;
      })}
    </div>

    <footer className="space-y-3 border-t border-[#34425e] bg-[#111827] px-4 py-4 text-white sm:px-6">
      {message && <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-[#316044]"><Check size={14}/>{message}</p>}
      {error && <p role="alert" className="text-xs font-medium text-[#aa352d]">{error}</p>}
      {confirming && changed && <div role="group" aria-label="Confirmar publicação da ordem" className="rounded-lg border border-[#c6d2ed] bg-[#f3f6ff] p-4">
        <p className="text-sm font-semibold text-[#233e83]">Publicar nova ordem dos {order.length} trabalhos?</p>
          <p className="mt-1 text-xs leading-5 text-[#475b8b]">
            {movingCount} posições serão actualizadas. A ordem é guardada na branch editorial. O site público muda após a integração do pull request e o deploy da Vercel.
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
