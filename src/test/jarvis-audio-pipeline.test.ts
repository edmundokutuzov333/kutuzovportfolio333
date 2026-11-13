import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { extractJarvisWav } from "@/lib/jarvis/tts-response";
import { MAX_JARVIS_AUDIO_BYTES, MAX_JARVIS_RECORDING_MS, normalizedAudioMime, preferredRecordingMime, shouldEndRecording } from "@/lib/jarvis/audio-capture";
import { handleJarvisAudioTranscription, parseJarvisAudioHeaders } from "@/routes/api.jarvis.transcribe";

describe("Jarvis microphone transport", () => {
  it("chooses WebM Opus on Chromium and MP4 AAC on Safari", () => {
    expect(preferredRecordingMime(type => type === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
    expect(preferredRecordingMime(type => type === "audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(preferredRecordingMime(() => false)).toBeUndefined();
    expect(normalizedAudioMime("audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(normalizedAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizedAudioMime("text/plain")).toBeNull();
  });

  it("waits for natural speech pauses, with bounded recording and request sizes", () => {
    expect(shouldEndRecording({ speechDetected: false, silenceMs: 9999, elapsedMs: 9999 })).toBe(false);
    expect(shouldEndRecording({ speechDetected: true, silenceMs: 900, elapsedMs: 2500 })).toBe(false);
    expect(shouldEndRecording({ speechDetected: true, silenceMs: 2000, elapsedMs: 3000 })).toBe(true);
    expect(MAX_JARVIS_RECORDING_MS).toBeGreaterThanOrEqual(15_000);
    expect(MAX_JARVIS_AUDIO_BYTES).toBeLessThan(3_000_000);
  });

  it("rejects unsupported or cross-origin media without calling external Gemini", async () => {
    expect(parseJarvisAudioHeaders(new Headers({
      "content-type": "audio/mp4; codecs=mp4a.40.2", "x-jarvis-locale": "pt",
    }))).toEqual({ mimeType: "audio/mp4", locale: "pt" });
    expect(parseJarvisAudioHeaders(new Headers({ "content-type": "text/plain" }))).toBeNull();
    expect(parseJarvisAudioHeaders(new Headers({
      "content-type": "audio/webm", "x-jarvis-locale": "de",
    }))).toBeNull();
    const url = "https://www.edmundokutuzov.art/api/jarvis/transcribe";
    const crossOrigin = await handleJarvisAudioTranscription(new Request(url, {
      method: "POST",
      headers: { "origin": "https://evil.example", "content-type": "audio/mp4" },
      body: new Uint8Array(800),
    }));
    expect(crossOrigin.status).toBe(403);
    const tooLarge = await handleJarvisAudioTranscription(new Request(url, {
      method: "POST",
      headers: { "content-type": "audio/webm", "content-length": "3000000" },
      body: new Uint8Array(400),
    }));
    expect(tooLarge.status).toBe(413);
    const empty = await handleJarvisAudioTranscription(new Request(url, {
      method: "POST",
      headers: { "content-type": "audio/webm" },
      body: new Uint8Array(50),
    }));
    expect(empty.status).toBe(400);
  });
});

describe("Jarvis male TTS response", () => {
  it("parses the canonical Interactions steps and direct output_audio forms", () => {
    const bytes = Buffer.alloc(48);
    bytes.write("RIFF", 0, "ascii");
    bytes.write("WAVE", 8, "ascii");
    const audio = bytes.toString("base64");
    expect(extractJarvisWav({ steps: [{ type: "model_output", content: [{ type: "audio", data: audio }] }] })).toEqual(new Uint8Array(bytes));
    expect(extractJarvisWav({ output_audio: { data: audio } })).toEqual(new Uint8Array(bytes));
    expect(extractJarvisWav({ outputAudio: { data: audio } })).toEqual(new Uint8Array(bytes));
  });

  it("rejects malformed non-WAV and oversized responses", () => {
    expect(extractJarvisWav(null)).toBeNull();
    expect(extractJarvisWav({ steps: [] })).toBeNull();
    expect(extractJarvisWav({ output_audio: { data: Buffer.alloc(80).toString("base64") } })).toBeNull();
    expect(extractJarvisWav({ output_audio: { data: "this-is-not-base64" } })).toBeNull();
  });
});
