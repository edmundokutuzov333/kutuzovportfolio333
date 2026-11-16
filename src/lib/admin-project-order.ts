/** Pure, keyboard/touch-friendly ordering helpers. No Admin authentication or CMS state here. */
export type ProjectOrderRecord = {
  id: string;
  title: string;
  slug: string;
  discipline: string;
  cover_path?: string | null;
  gallery?: unknown;
  project_type?: string | null;
  client_label?: string | null;
  featured?: boolean;
  position: number;
  status: string;
};

export function publishedProjectRows<T extends { id: string; status: string; position: number }>(records: T[]): T[] {
  return records.filter(record => record.status === "published")
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function idsFromProjects(records: Array<{ id: string }>): string[] {
  return records.map(record => record.id);
}

export function isExactOrder(ids: readonly string[], baseline: readonly string[]): boolean {
  return ids.length === baseline.length &&
    ids.every((id, index) => id === baseline[index]);
}

export function isValidReorder(ids: readonly string[], baseline: readonly string[]): boolean {
  return ids.length > 0 && ids.length === baseline.length &&
    new Set(ids).size === ids.length &&
    new Set(baseline).size === baseline.length &&
    ids.every(id => baseline.includes(id));
}

/** Insertion semantics: move the selected work, shift every intervening work by one. */
export function moveProjectId(
  ids: readonly string[], selectedId: string, destinationIndex: number,
): string[] {
  const from = ids.indexOf(selectedId);
  if (from < 0 || !Number.isInteger(destinationIndex) ||
      destinationIndex < 0 || destinationIndex >= ids.length || from === destinationIndex) {
    return [...ids];
  }
  const next = [...ids];
  next.splice(from, 1);
  next.splice(destinationIndex, 0, selectedId);
  return next;
}

export function toggleProjectSelection(selected: readonly string[], id: string, extend: boolean): string[] {
  if (!extend) return [id];
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}

export function selectProjectRange(order: readonly string[], anchorId: string, targetId: string): string[] {
  const anchor = order.indexOf(anchorId);
  const target = order.indexOf(targetId);
  if (anchor < 0 || target < 0) return target < 0 ? [] : [targetId];
  return order.slice(Math.min(anchor, target), Math.max(anchor, target) + 1);
}

/** Move a selected block as one unit while preserving the global order of its members. */
export function moveSelectedProjectIds(
  ids: readonly string[], selectedIds: readonly string[], destinationIndex: number,
): string[] {
  const selected = new Set(selectedIds);
  const moving = ids.filter(id => selected.has(id));
  if (!moving.length || !Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex >= ids.length) return [...ids];
  const target = ids[destinationIndex];
  if (target && selected.has(target)) return [...ids];
  const remaining = ids.filter(id => !selected.has(id));
  const insertion = ids.slice(0, destinationIndex).filter(id => !selected.has(id)).length;
  remaining.splice(Math.min(insertion, remaining.length), 0, ...moving);
  return remaining;
}

export function positionLabel(index: number, total: number): string {
  return String(index + 1).padStart(Math.max(3, String(total).length), "0");
}

export function visibleProjectIds(
  order: readonly string[],
  projects: ReadonlyMap<string, { title: string; slug: string; discipline: string }>,
  search: string,
  discipline: string,
): string[] {
  const query = search.trim().toLocaleLowerCase();
  return order.filter(id => {
    const row = projects.get(id);
    return Boolean(row &&
      (!discipline || row.discipline === discipline) &&
      (!query || [row.title, row.slug, row.discipline].some(value => value.toLocaleLowerCase().includes(query))));
  });
}
