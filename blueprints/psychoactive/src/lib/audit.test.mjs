import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicUrl, mockAudit, mockAuditResponse, toAuditView, auditReducer, initialAuditState } from "./audit.mjs";
test("normalizes a public domain and removes fragments", () => {
  assert.equal(normalizePublicUrl(" exemplo.pt/path#section "), "https://exemplo.pt/path");
  assert.equal(normalizePublicUrl("https://exemplo.pt/?a=1"), "https://exemplo.pt/?a=1");
});
test("rejects malformed and local targets", () => {
  for (const input of ["", "not a url", "javascript:alert(1)", "http://127.0.0.1", "http://localhost", "https://u:p@exemplo.pt", "https://exemplo.pt:8888"]) {
    assert.throws(() => normalizePublicUrl(input));
  }
});
test("mock totals equal 42 and all categories fit 20", async () => {
  const controller = new AbortController();
  const result = await mockAudit("https://example.com/", { signal: controller.signal, delayMs: 1 });
  assert.equal(result.categories.reduce((sum, item) => sum + item.score, 0), result.score);
  assert.equal(result.score, 42);
  assert.ok(result.categories.every(item => item.score >= 0 && item.score <= 20));
});
test("cancels an in-flight mock", async () => {
  const controller = new AbortController();
  const pending = mockAudit("https://example.com/", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
test("ignores results after reset", () => {
  const pending = auditReducer(initialAuditState, { type: "START", url: "https://example.com/" });
  const reset = auditReducer(pending, { type: "RESET" });
  assert.equal(auditReducer(reset, { type: "SUCCESS", result: {} }).status, "idle");
});

test("preserves the captured API field names independently from the UI model", () => {
  const raw = mockAuditResponse("https://example.com/");
  assert.deepEqual(Object.keys(raw.report.categories).sort(), [
    "content_craft","conversion_architecture","credibility_trust","structural_hierarchy","value_proposition",
  ]);
  assert.equal(raw.report.overall_score,42);
  assert.equal(raw.heroImageUrl,null);
  assert.equal(toAuditView(raw).categories.length,5);
});
