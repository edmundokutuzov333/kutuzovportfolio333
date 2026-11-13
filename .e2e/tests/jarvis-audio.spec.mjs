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
