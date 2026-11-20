import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/admin-auth.server", () => ({
  getAdminServerContext: vi.fn().mockResolvedValue({}),
}));

import { reorderGitHubProjects } from "@/lib/server/github-portfolio.server";

const projects = [
  { id: "b", status: "published", position: 1 },
  { id: "draft", status: "draft", position: 0 },
  { id: "a", status: "published", position: 0 },
];

function mockSnapshot() {
  return vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({
      content: Buffer.from(JSON.stringify({ tables: { projects } })).toString("base64"),
      sha: "snapshot-sha",
    }))
    .mockResolvedValueOnce(Response.json({}));
}

describe("GitHub portfolio reorder persistence", () => {
  beforeEach(() => vi.stubEnv("GITHUB_PORTFOLIO_TOKEN", "test-token"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a stale order and preserves the stored snapshot", async () => {
    const fetchMock = mockSnapshot();
    vi.stubGlobal("fetch", fetchMock);
    await expect(reorderGitHubProjects(["a", "b"], ["b", "a"])).rejects.toMatchObject({ code: "conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not commit an unchanged order", async () => {
    const fetchMock = mockSnapshot();
    vi.stubGlobal("fetch", fetchMock);
    await expect(reorderGitHubProjects(["a", "b"], ["a", "b"])).resolves.toMatchObject({ count: 2, changed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes the entire published order with the base SHA and preserves drafts", async () => {
    const fetchMock = mockSnapshot();
    vi.stubGlobal("fetch", fetchMock);
    await expect(reorderGitHubProjects(["b", "a"], ["a", "b"])).resolves.toMatchObject({ count: 2, changed: 2 });
    const request = fetchMock.mock.calls[1]?.[1];
    expect(request?.method).toBe("PUT");
    const payload = JSON.parse(String(request?.body));
    expect(payload.sha).toBe("snapshot-sha");
    expect(payload.branch).toBe("editorial/portfolio");
    expect(JSON.parse(Buffer.from(payload.content, "base64").toString()).tables.projects).toEqual([
      { id: "b", status: "published", position: 0 },
      { id: "draft", status: "draft", position: 0 },
      { id: "a", status: "published", position: 1 },
    ]);
  });
});
