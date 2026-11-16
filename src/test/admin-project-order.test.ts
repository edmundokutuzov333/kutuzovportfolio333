import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  idsFromProjects, isExactOrder, isValidReorder, moveProjectId,
  positionLabel, publishedProjectRows, visibleProjectIds,
} from "@/lib/admin-project-order";

const makeRows = (count = 155) => Array.from({ length: count }, (_, index) => ({
  id: String(index + 1).padStart(3, "0"),
  title: `Trabalho ${index + 1}`,
  slug: `trabalho-${index + 1}`,
  discipline: index < 90 ? "Social Media" : "Campaign design",
  position: index,
  status: "published",
}));

describe("Admin published portfolio ordering", () => {
  const published = makeRows();
  const archived = [
    { ...published[4]!, id: "archived-a", position: 0, status: "archived" },
    { ...published[5]!, id: "archived-b", position: 1, status: "archived" },
  ];
  const rows = [published[20]!, ...archived, ...published.filter(row => row.id !== published[20]!.id)];
  const sorted = publishedProjectRows(rows);
  const ids = idsFromProjects(sorted);

  it("builds one global 001–155 order, never mixing archived positions", () => {
    expect(ids.length).toBe(155);
    expect(ids[0]).toBe("001");
    expect(ids[154]).toBe("155");
    expect(ids).not.toContain("archived-a");
    expect(positionLabel(0, ids.length)).toBe("001");
    expect(positionLabel(154, ids.length)).toBe("155");
  });

  it("moves work #140 straight to the front without losing any item", () => {
    const moved = moveProjectId(ids, "140", 0);
    expect(moved[0]).toBe("140");
    expect(moved[1]).toBe("001");
    expect(moved[139]).toBe("139");
    expect(moved[140]).toBe("141");
    expect(moved.length).toBe(155);
    expect(isValidReorder(moved, ids)).toBe(true);
    expect(isExactOrder(ids, moved)).toBe(false);
  });

  it("handles bottom/top moves, no-op moves, invalid indices and undo", () => {
    const bottom = moveProjectId(ids, "001", 154);
    expect(bottom[154]).toBe("001");
    expect(bottom[0]).toBe("002");
    expect(moveProjectId(ids, "001", -1)).toEqual(ids);
    expect(moveProjectId(ids, "missing", 0)).toEqual(ids);
    expect(moveProjectId(ids, "020", 999)).toEqual(ids);
    const changed = moveProjectId(ids, "155", 10);
    expect(moveProjectId(changed, "155", 154)).toEqual(ids);
  });

  it("disallows incomplete, duplicate, cross-scope and out-of-date orders", () => {
    expect(isValidReorder(ids, ids)).toBe(true);
    expect(isValidReorder(ids.slice(1), ids)).toBe(false);
    expect(isValidReorder([...ids.slice(0, 154), ids[0]!], ids)).toBe(false);
    expect(isValidReorder([...ids.slice(0, 154), "archived-a"], ids)).toBe(false);
    expect(isExactOrder(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("uses global indices when searching and filtering by category", () => {
    const byId = new Map(sorted.map(row => [row.id, row]));
    const filtered = visibleProjectIds(ids, byId, "trabalho 140", "");
    expect(filtered).toEqual(["140"]);
    expect(ids.indexOf(filtered[0]!)).toBe(139);
    const campaigns = visibleProjectIds(ids, byId, "", "Campaign design");
    expect(campaigns[0]).toBe("091");
    expect(campaigns.at(-1)).toBe("155");
    const reordered = moveProjectId(ids, "140", 0);
    expect(visibleProjectIds(reordered, byId, "trabalho 140", "")).toEqual(["140"]);
  });

  it("does not modify the Admin login, PIN gate or public Work route", () => {
    const adminRoute = readFileSync("src/routes/admin.tsx", "utf8");
    const workspace = readFileSync("src/components/admin/AdminWorkspace.tsx", "utf8");
    const server = readFileSync("src/lib/server/admin-cms.server.ts", "utf8");
    const sql = readFileSync("drizzle/migrations/0019_atomic_published_project_order_20261116.sql", "utf8");
    expect(adminRoute).toContain("loginAdminFn");
    expect(adminRoute).toContain("getAdminSessionFn");
    expect(adminRoute).toContain("AdminWorkspace");
    expect(workspace).toContain("Organizar ordem");
    expect(workspace).toContain("reorderPublishedProjectsFn");
    expect(server).not.toContain("await Promise.all(input.ids.map");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("portfolio_order_conflict");
    expect(sql).toContain("status = 'published'");
    expect(sql).toContain("revoke all on function public.admin_reorder_published_projects");
  });

  it("uses one local ordering flow instead of publishing every arrow click", () => {
    const editor = readFileSync("src/components/admin/ProjectOrderEditor.tsx", "utf8");
    const workspace = readFileSync("src/components/admin/AdminWorkspace.tsx", "utf8");
    expect(editor).toContain("type=\"number\"");
    expect(editor).toContain("Arraste pelo manípulo");
    expect(editor).toContain("Guardar e publicar ordem");
    expect(editor).not.toContain("ArrowUp,");
    expect(editor).not.toContain("ArrowDown,");
    expect(workspace).not.toContain("onMove={(index, direction)");
  });

  it("does not render the cursor displacement glitch effect", () => {
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    expect(shell).not.toContain("feDisplacementMap");
    expect(shell).not.toContain("backdropFilter");
  });
});
