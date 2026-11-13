import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import {
  JARVIS_PCM_SAMPLE_RATE,
  parseGeminiAudioDelta,
  parseSseData,
  pcmBytesFromBase64,
  pcmToFloat32,
  takeSseEvents,
} from "@/lib/jarvis/pcm-stream";

describe("Gemini low-latency PCM streaming protocol", () => {
  const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x01, 0x00]);
  const encoded = pcm.toString("base64");

  it("accepts only audio step deltas, never other provider events", () => {
    expect(parseGeminiAudioDelta({ event_type: "step.delta", delta: { type: "audio", data: encoded } })).toBe(encoded);
    expect(parseGeminiAudioDelta({ delta: { type: "audio", data: encoded } })).toBe(encoded);
    expect(parseGeminiAudioDelta({ event_type: "step.done", delta: { type: "audio", data: encoded } })).toBeNull();
    expect(parseGeminiAudioDelta({ delta: { type: "text", data: encoded } })).toBeNull();
    expect(parseGeminiAudioDelta({ delta: { type: "audio", data: "not|base64" } })).toBeNull();
  });

  it("decodes mono 16-bit signed PCM at the documented 24 kHz rate", () => {
    expect(JARVIS_PCM_SAMPLE_RATE).toBe(24_000);
    const bytes = pcmBytesFromBase64(encoded);
    expect(bytes).toEqual(new Uint8Array(pcm));
    const samples = pcmToFloat32(bytes!);
    expect(samples).not.toBeNull();
    expect(samples?.length).toBe(4);
    expect(samples?.[0]).toBe(0);
    expect(samples?.[1]).toBeCloseTo(32767 / 32768);
    expect(samples?.[2]).toBe(-1);
    expect(samples?.[3]).toBeCloseTo(1 / 32768);
    expect(pcmBytesFromBase64("bad token")).toBeNull();
    expect(pcmToFloat32(new Uint8Array([1]))).toBeNull();
  });

  it("buffers partial network frames until complete SSE messages arrive", () => {
    const first = 'event: step.delta\r\ndata: {"delta":{"type":"audio","data":"'+encoded+'"}}\r\n\r\nevent:';
    const batch = takeSseEvents(first);
    expect(batch.events).toHaveLength(1);
    expect(batch.tail).toBe("event:");
    const audio = parseGeminiAudioDelta(parseSseData(batch.events[0]!));
    expect(audio).toBe(encoded);
    const second = takeSseEvents(batch.tail + ' done\ndata: {}\n\n');
    expect(second.events).toHaveLength(1);
    expect(parseSseData('data: [DONE]')).toBeNull();
    expect(parseSseData('data: {not-json}')).toBeNull();
  });
});
