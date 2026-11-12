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

describe("Public CMS fast path and model key protection",()=>{
 it("answers published client questions before requesting Gemini",()=>{
  const src=readFileSync("src/lib/server/jarvis-stream.server.ts","utf8");
  expect(src.indexOf("answerPublishedClient(question,facts,locale)"))
    .toBeLessThan(src.indexOf("const contextPromise=findRelevant"));
 });
 it("protects all lead contact data with a literal user consent gate",()=>{
  const src=readFileSync("src/routes/api.jarvis.lead.ts","utf8");
  expect(src).toContain("consent:z.literal(true)");
  expect(src).toContain("acquireQuota");
  expect(src).toContain("return=representation");
  expect(src).not.toContain("VITE_SUPABASE_SECRET");
 });
 it("separates voice API key from browser WebSocket and requests a masculine voice",()=>{
  const server=readFileSync("src/routes/api.jarvis.live-token.ts","utf8");
  const client=readFileSync("src/lib/jarvis/live-browser.ts","utf8");
  expect(server).toContain('voiceName:"Orus"');
  expect(server).toContain("contextWindowCompression");
  expect(client).toContain("BidiGenerateContentConstrained?access_token=");
  expect(client).toContain('socket.binaryType="arraybuffer"');
  expect(client).not.toContain("process.env.GEMINI_API_KEY");
 });
});
