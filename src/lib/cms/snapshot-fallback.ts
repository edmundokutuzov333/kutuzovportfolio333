import type { PublicCmsTable } from "./public-client";

/**
 * Emergency, READ-ONLY snapshot of the last known published public CMS rows.
 *
 * The snapshot contains no unpublished projects, hidden clients, private
 * submissions, audit logs, credentials or administrative data. It is loaded
 * lazily only after a retriable public Supabase API error.
 *
 * When the API recovers, the live database is authoritative again.
 */
export async function selectOfflinePublicRows(
  table: PublicCmsTable,
  query: Record<string, string>,
): Promise<unknown[]> {
  const snapshot = (await import("@/data/public-cms-snapshot.json")).default;
  const tables = snapshot.tables as unknown as Record<string, Record<string, unknown>[]>;
  const source = tables[table];
  if (!Array.isArray(source)) throw new Error(`Public snapshot missing: ${table}`);

  let rows = [...source];
  for (const [field, condition] of Object.entries(query)) {
    if (field === "select" || field === "order" || field === "limit") continue;

    if (condition.startsWith("eq.")) {
      const expected = condition.slice(3);
      rows = rows.filter(row => String(row[field] ?? "") === expected);
    } else if (condition === "is.true" || condition === "is.false") {
      rows = rows.filter(row => row[field] === (condition === "is.true"));
    } else if (condition === "eq.true" || condition === "eq.false") {
      rows = rows.filter(row => row[field] === (condition === "eq.true"));
    } else if (condition === "is.null") {
      rows = rows.filter(row => row[field] === null || row[field] === undefined);
    } else {
      // Never return an unfiltered result for an unfamiliar PostgREST predicate.
      throw new Error(`Unsupported public snapshot filter: ${table}.${field}`);
    }
  }

  if (query["order"]) {
    const [field, direction] = query["order"].split(".");
    if (!field || (direction !== "asc" && direction !== "desc")) {
      throw new Error("Unsupported public snapshot sort order");
    }
    const sign = direction === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const left = a[field];
      const right = b[field];
      if (left === right) return 0;
      if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
      return String(left ?? "").localeCompare(String(right ?? "")) * sign;
    });
  }

  const limit = query["limit"];
  if (limit !== undefined) {
    const count = Number(limit);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid public snapshot limit");
    rows = rows.slice(0, count);
  }

  // Match the PostgREST column projection: never leak snapshot fields that
  // the corresponding public query did not request.
  const columns = query["select"]?.split(",") ?? [];
  if (columns.length && columns[0] !== "*") {
    rows = rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
  }
  return rows;
}
