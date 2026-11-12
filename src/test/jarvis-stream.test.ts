import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
describe("JARVIS streaming transport invariants",()=>{
  it("sends SSE with content type and disables proxy buffering",()=>{
    const code=readFileSync("src/routes/api.jarvis.stream.ts","utf8");
    expect(code).toContain("text/event-stream");
    expect(code).toContain("no-transform");
    expect(code).toContain("X-Accel-Buffering");
    expect(code).toContain("26000");
  });
  it("never releases unverified contact fragments before sentence validation",()=>{
    const code=readFileSync("src/lib/server/jarvis-stream.server.ts","utf8");
    expect(code).toContain("validateContacts(cleanJarvisReply(complete)");
    expect(code).toContain("validateContacts(cleanJarvisReply(pending)");
    expect(code).toContain("thinkingLevel");
  });
});
