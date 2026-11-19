import { afterEach, describe, expect, it, vi } from "vitest";
import { connectJarvisLive } from "@/lib/jarvis/live-browser";

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  state = "running";
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  createScriptProcessor = () => ({ connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null });
  createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() });
  createBuffer = (_channels: number, length: number, rate: number) =>
    ({ duration: length / rate, copyToChannel: vi.fn() });
  createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null });
}

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(_url: string) {
    FakeSocket.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
      this.emit({ setupComplete: {} });
    });
  }
  emit(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeSocket.instances = [];
});

describe("Gemini Live progressive output transcription", () => {
  it("shows partial spoken words, preserves the complete reply and resets per turn", async () => {
    const fetch = vi.fn(async () => Response.json({
      token: "ephemeral-test-only",
      model: "models/gemini-live-test",
      config: {},
      contact: { email: "contact@edmundokutuzov.art", phone: null, whatsapp: null,
        site: "https://www.edmundokutuzov.art", linkedin: null, instagram: null, facebook: null },
    }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const starts = vi.fn();
    const partial = vi.fn();
    const finished = vi.fn();
    const interrupted = vi.fn();
    const session = await connectJarvisLive({} as MediaStream, {
      onState: vi.fn(),
      onError: vi.fn(),
      onAssistantTurnStart: starts,
      onAssistantTranscriptPartial: partial,
      onAssistantTranscript: finished,
      onAssistantTranscriptInterrupted: interrupted,
    }, "en");
    expect(session).toBeTruthy();
    const socket = FakeSocket.instances.at(-1);
    expect(socket).toBeDefined();

    socket?.emit({ serverContent: { outputTranscription: { text: "Trans" } } });
    socket?.emit({ serverContent: { outputTranscription: { text: "cription appears" } } });
    socket?.emit({ serverContent: { outputTranscription: { text: " with audio." }, turnComplete: true } });
    expect(starts).toHaveBeenCalledTimes(1);
    expect(partial.mock.lastCall?.[0]).toBe("Transcription appears with audio.");
    expect(finished).toHaveBeenCalledWith("Transcription appears with audio.");

    socket?.emit({ serverContent: { outputTranscription: { text: "New" } } });
    socket?.emit({ serverContent: { interrupted: true } });
    expect(interrupted).toHaveBeenCalledTimes(1);
    socket?.emit({ serverContent: { outputTranscription: { text: "Next answer." }, turnComplete: true } });
    expect(starts).toHaveBeenCalledTimes(3);
    expect(finished).toHaveBeenLastCalledWith("Next answer.");
    session?.stop();
  });

  it("redacts unverified addresses even before the final Live transcription", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      token: "ephemeral-test-only", model: "models/gemini-live-test", config: {},
      contact: { email: "contact@edmundokutuzov.art", phone: null, whatsapp: null,
        site: "https://www.edmundokutuzov.art", linkedin: null, instagram: null, facebook: null },
    })));
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const partial = vi.fn();
    const session = await connectJarvisLive({} as MediaStream, {
      onState: vi.fn(), onError: vi.fn(), onAssistantTranscriptPartial: partial,
    }, "en");
    const socket = FakeSocket.instances.at(-1);
    socket?.emit({ serverContent: { outputTranscription: { text: "Email fake@" } } });
    expect(partial.mock.lastCall?.[0]).not.toContain("fake@");
    socket?.emit({ serverContent: { outputTranscription: { text: "example.com" } } });
    expect(partial.mock.lastCall?.[0]).not.toContain("fake@example.com");
    expect(partial.mock.lastCall?.[0]).toContain("contact@edmundokutuzov.art");
    session?.stop();
  });
});

