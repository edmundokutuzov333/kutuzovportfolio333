import { describe, expect, it } from "vitest";
import { getRestorableSnapshot } from "@/lib/admin-revisions";

describe("admin revision restoration", () => {
  it("restores the selected revision's committed after snapshot", () => {
    const row = {
      before_snapshot: { title: "Versão anterior" },
      after_snapshot: { title: "Versão seleccionada", status: "published" },
    };
    expect(getRestorableSnapshot(row)).toEqual(row.after_snapshot);
  });

  it("does not offer restoration for missing, primitive, or array snapshots", () => {
    expect(getRestorableSnapshot({ after_snapshot: null })).toBeNull();
    expect(getRestorableSnapshot({ after_snapshot: "not an object" })).toBeNull();
    expect(getRestorableSnapshot({ after_snapshot: [] })).toBeNull();
  });
});
