import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shouldEndRecording } from "@/lib/jarvis/audio-capture";
import { splitVoiceSegments } from "@/lib/jarvis/voice-chunks";

describe("JARVIS low-latency audio without losing user speech", () => {
  it("ends after shorter silence for established speech, but tolerates short-question pauses", () => {
    expect(shouldEndRecording({speechDetected:false,silenceMs:10_000,elapsedMs:10_000})).toBe(false);
    expect(shouldEndRecording({speechDetected:true,silenceMs:1000,elapsedMs:1800})).toBe(false);
    expect(shouldEndRecording({speechDetected:true,silenceMs:1300,elapsedMs:1800})).toBe(true);
    expect(shouldEndRecording({speechDetected:true,silenceMs:950,elapsedMs:3500})).toBe(true);
    expect(shouldEndRecording({speechDetected:true,silenceMs:800,elapsedMs:3500})).toBe(false);
  });

  it("splits natural speech into bounded ordered pieces without dropping information", () => {
    const text="Hello and welcome. ".repeat(40).trim();
    const parts=splitVoiceSegments(text,240);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every(x=>x.length<=240)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g," ")).toBe(text);
    expect(splitVoiceSegments("")).toEqual([]);
    expect(splitVoiceSegments("Short reply.")).toEqual(["Short reply."]);
    expect(splitVoiceSegments("a".repeat(500),200).join("")).toBe("a".repeat(500));
  });

  it("keeps written chat in ordinary mode and only accelerates the voice stream", () => {
    const client=readFileSync("src/components/JarvisLauncher.tsx","utf8");
    const api=readFileSync("src/routes/api.jarvis.stream.ts","utf8");
    const server=readFileSync("src/lib/server/jarvis-stream.server.ts","utf8");
    expect(client).toContain('onFirstChunk: (chunk) =>');
    expect(client).toContain('onFirstChunk(first)');
    expect(client).toContain('mode: "voice"');
    expect(client).toContain('enqueue(chunk)');
    expect(client).toContain('response.startsWith(firstChunk)');
    expect(client).toContain('const remaining = firstChunk');
    expect(api).toContain('mode:z.enum(["text","voice"]).default("text")');
    expect(server).toContain('maxOutputTokens:mode==="voice"?150:220');
    expect(server).toContain('mode:"text"|"voice"="text"');
  });
});
