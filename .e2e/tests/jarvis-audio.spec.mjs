import { test, expect } from "@playwright/test";

function mockWav() {
  const samples = 2400;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8, "ascii");
  bytes.write("fmt ", 12, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(24000 * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36, "ascii");
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

async function installFakeMicrophone(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    window.MediaRecorder = class FakeMediaRecorder {
      static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
      constructor(_stream, options) {
        this.mimeType = options?.mimeType ?? "audio/webm";
        this.state = "inactive";
      }
      start() { this.state = "recording"; }
      stop() {
        if (this.state !== "recording") return;
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(1800)], { type: this.mimeType }) });
        this.onstop?.();
      }
    };
  });
}

async function openJarvis(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-jarvis-ready", "true", { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("ek:jarvis-open")));
  await expect(page.locator(".jv-root")).toBeVisible();
}

test("recorded voice uses raw STT, normal text dialogue and WAV TTS in the same session", async ({ page }) => {
  await installFakeMicrophone(page);
  const requests = [];
  await page.route("**/api/jarvis/transcribe", async route => {
    const request = route.request();
    expect(request.headers()["content-type"]).toBe("audio/webm");
    expect(request.headers()["x-jarvis-locale"]).toBe("en");
    // Playwright WebKit may expose a Blob-backed fetch body as null when intercepted.
    // Byte-length and MIME validation run independently against the real server handler.
    const observedBody = request.postDataBuffer();
    if (observedBody) expect(observedBody.length).toBeGreaterThan(300);
    requests.push("transcription");
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "Tell me about your work", error: null }) });
  });
  await page.route("**/api/jarvis/stream", async route => {
    const request = route.request().postDataJSON();
    expect(request.locale).toBe("en");
    expect(request.messages.at(-1).content).toBe("Tell me about your work");
    requests.push("answer");
    await route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: {"text":"I work in art direction and branding."}\n\n'
        + 'event: done\ndata: {}\n\n' });
  });
  await page.route("**/api/jarvis/tts-stream", route => route.fulfill({ status: 503 }));
  await page.route("**/api/jarvis/tts", async route => {
    const input = route.request().postDataJSON();
    expect(input.locale).toBe("en");
    expect(input.text).toContain("art direction");
    requests.push("tts");
    await route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() });
  });

  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await expect(jarvis.locator(".jv-visual")).toHaveAttribute("data-state", "listening");
  await jarvis.locator(".jv-orbit-hit").click();
  await expect.poll(() => requests).toEqual(["transcription", "answer", "tts"]);
  await jarvis.getByRole("button", { name: "Open text chat" }).click();
  await expect(jarvis.locator(".jv-chat-message--user").last()).toContainText("Tell me about your work");
  await expect(jarvis.locator(".jv-chat-message--assistant").last()).toContainText("art direction and branding");
});

test("audio transcription failure reports an error without sending a false text reply", async ({ page }) => {
  await installFakeMicrophone(page);
  let answers = 0;
  await page.route("**/api/jarvis/transcribe", async route => {
    await route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ error: "Transcription is temporarily unavailable.", transcript: null }) });
  });
  await page.route("**/api/jarvis/stream", async route => { answers++; await route.abort(); });
  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  await expect(jarvis.locator(".jv-voice-state")).toContainText("Transcription is temporarily unavailable.");
  expect(answers).toBe(0);
});

test("voice begins TTS before the LLM finishes streaming, without duplicating the first sentence", async ({ page }) => {
  await installFakeMicrophone(page);
  await page.addInitScript(() => {
    window.__jarvisStreamFinished = false;
    window.__jarvisVoiceMode = "";
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (input === "/api/jarvis/stream") {
        window.__jarvisVoiceMode = JSON.parse(String(init?.body || "{}")).mode;
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: chunk\ndata: {"text":"I direct art and visual identities. "}\n\n'));
            setTimeout(() => {
              controller.enqueue(encoder.encode('event: chunk\ndata: {"text":"I also create brand campaigns."}\n\n'));
              controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
              controller.close();
              window.__jarvisStreamFinished = true;
            }, 1800);
          },
        });
        return Promise.resolve(new Response(body, {
          status: 200, headers: { "Content-Type": "text/event-stream" },
        }));
      }
      return originalFetch(input, init);
    };
  });
  await page.route("**/api/jarvis/transcribe", async route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "Tell me what you do.", error: null }) }));
  const tts = [];
  await page.route("**/api/jarvis/tts", async route => {
    const text = route.request().postDataJSON().text;
    const finished = await page.evaluate(() => window.__jarvisStreamFinished);
    tts.push({ text, finished });
    await route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() });
  });
  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  await expect.poll(() => tts.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(tts[0]).toEqual({ text: "I direct art and visual identities.", finished: false });
  expect(await page.evaluate(() => window.__jarvisVoiceMode)).toBe("voice");
  await expect.poll(() => page.evaluate(() => window.__jarvisStreamFinished)).toBe(true);
  await expect(jarvis.getByRole("button", { name: "Open text chat" })).toBeVisible();
  await jarvis.getByRole("button", { name: "Open text chat" }).click();
  await expect(jarvis.locator(".jv-chat-message--assistant").last())
    .toContainText("I direct art and visual identities. I also create brand campaigns.");
});


test("PCM starts playing BEFORE the final TTS network event, without waiting for WAV", async ({ page }) => {
  await installFakeMicrophone(page);
  await page.addInitScript(() => {
    window.__jarvisPcmDone = false;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (input === "/api/jarvis/tts-stream") {
        const pcm = new Uint8Array(48_000);
        const audio = btoa(String.fromCharCode(...pcm));
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: audio\ndata: ' + JSON.stringify({ data: audio }) + '\n\n'));
            setTimeout(() => {
              window.__jarvisPcmDone = true;
              controller.enqueue(encoder.encode('event: done\ndata: {"bytes":48000}\n\n'));
              controller.close();
            }, 1800);
          },
        });
        return Promise.resolve(new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        }));
      }
      return original(input, init);
    };
  });
  await page.route("**/api/jarvis/transcribe", route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "What do you create?", error: null }) }));
  await page.route("**/api/jarvis/stream", route =>
    route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: {"text":"I create distinctive visual identities."}\n\n'
        + 'event: done\ndata: {}\n\n' }));
  let wavRequests = 0;
  await page.route("**/api/jarvis/tts", route => {
    wavRequests++;
    return route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() });
  });
  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  await expect(jarvis.locator(".jv-visual")).toHaveAttribute("data-state", "speaking", { timeout: 12_000 });
  expect(await page.evaluate(() => window.__jarvisPcmDone)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__jarvisPcmDone)).toBe(true);
  expect(wavRequests).toBe(0);
});

test("unavailable streamed TTS gracefully falls back to the existing WAV pipeline", async ({ page }) => {
  await installFakeMicrophone(page);
  await page.route("**/api/jarvis/transcribe", route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "Tell me about Edmundo.", error: null }) }));
  await page.route("**/api/jarvis/stream", route =>
    route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: {"text":"Edmundo is an art director."}\n\n'
        + 'event: done\ndata: {}\n\n' }));
  const stages = [];
  await page.route("**/api/jarvis/tts-stream", route => {
    stages.push("stream");
    return route.fulfill({ status: 503 });
  });
  await page.route("**/api/jarvis/tts", route => {
    stages.push("wav");
    return route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() });
  });
  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  await expect.poll(() => stages).toEqual(["stream", "wav"]);
  await jarvis.getByRole("button", { name: "Open text chat" }).click();
  await expect(jarvis.locator(".jv-chat-message--assistant")).toContainText("Edmundo is an art director.");
});

test("spoken answer displays a progressive, retained transcript beside the voice visual", async ({ page }) => {
  await installFakeMicrophone(page);
  await page.route("**/api/jarvis/transcribe", route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "What can you create?", error: null }) }));
  await page.route("**/api/jarvis/stream", route =>
    route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: {"text":"I create visual identities."}\n\n'
        + 'event: chunk\ndata: {"text":"I also direct campaigns."}\n\n'
        + 'event: done\ndata: {}\n\n' }));
  await page.route("**/api/jarvis/tts-stream", route => route.fulfill({ status: 503 }));
  let audioRequests = 0;
  await page.route("**/api/jarvis/tts", async route => {
    audioRequests++;
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() });
  });

  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  const transcript = jarvis.getByRole("region", { name: "LIVE TRANSCRIPT" });
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("The spoken response will appear here");
  await expect.poll(() => audioRequests).toBeGreaterThan(0);
  await expect(transcript).toContainText("I create visual identities.");
  await expect(transcript).toContainText("I also direct campaigns.");
  await expect(jarvis.locator(".jv-voice-state")).toContainText("Ready to talk");
  await expect(transcript).toContainText("I create visual identities. I also direct campaigns.");

  // Spoken captions remain readable after the audio ends, in both UI modes.
  await jarvis.getByRole("button", { name: "Open text chat" }).click();
  await expect(jarvis.locator(".jv-chat-message--assistant").last())
    .toContainText("I create visual identities. I also direct campaigns.");
});

test("closing the voice UI clears stale captions before the next session", async ({ page }) => {
  await installFakeMicrophone(page);
  await page.route("**/api/jarvis/transcribe", route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "What do you do?", error: null }) }));
  await page.route("**/api/jarvis/stream", route =>
    route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: {"text":"I am a creative director."}\n\n'
        + 'event: done\ndata: {}\n\n' }));
  await page.route("**/api/jarvis/tts-stream", route => route.fulfill({ status: 503 }));
  await page.route("**/api/jarvis/tts", route =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() }));
  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  await expect(jarvis.locator(".jv-voice-transcript__body")).toContainText("I am a creative director.");
  await jarvis.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("ek:jarvis-open")));
  await expect(jarvis).toBeVisible();
  await expect(jarvis.locator(".jv-voice-transcript")).toHaveCount(0);
});


test("spoken transcript remains readable, contained and scrollable on narrow mobile screens", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installFakeMicrophone(page);
  const answer = Array.from({ length: 9 }, (_, index) =>
    "Part " + (index + 1) + ": clear creative direction connects strong ideas with memorable design.")
    .join(" ");
  await page.route("**/api/jarvis/transcribe", route =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ transcript: "Describe your creative approach.", error: null }) }));
  await page.route("**/api/jarvis/stream", route =>
    route.fulfill({ status: 200, contentType: "text/event-stream",
      body: 'event: chunk\ndata: ' + JSON.stringify({ text: answer }) + '\n\n'
        + 'event: done\ndata: {}\n\n' }));
  await page.route("**/api/jarvis/tts-stream", route => route.fulfill({ status: 503 }));
  await page.route("**/api/jarvis/tts", route =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: mockWav() }));

  await openJarvis(page);
  const jarvis = page.locator(".jv-root");
  await jarvis.getByRole("button", { name: "TALK TO KUTUZOV" }).click();
  await jarvis.locator(".jv-orbit-hit").click();
  const transcript = jarvis.getByRole("region", { name: "LIVE TRANSCRIPT" });
  await expect(transcript).toContainText("Part 9:", { timeout: 20_000 });
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector(".jv-panel").getBoundingClientRect();
    const caption = document.querySelector(".jv-voice-transcript").getBoundingClientRect();
    const scroller = document.querySelector(".jv-voice-transcript__body");
    return {
      panelLeft: panel.left,
      panelRight: panel.right,
      captionLeft: caption.left,
      captionRight: caption.right,
      captionHeight: scroller.clientHeight,
      contentHeight: scroller.scrollHeight,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.captionLeft).toBeGreaterThanOrEqual(geometry.panelLeft);
  expect(geometry.captionRight).toBeLessThanOrEqual(geometry.panelRight);
  expect(geometry.captionHeight).toBeLessThanOrEqual(108);
  expect(geometry.contentHeight).toBeGreaterThan(geometry.captionHeight);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});
