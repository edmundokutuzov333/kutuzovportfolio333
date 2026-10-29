export function getRestorableSnapshot(row: Record<string, unknown>): Record<string, unknown> | null {
  const snapshot = row["after_snapshot"];
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  return snapshot as Record<string, unknown>;
}
