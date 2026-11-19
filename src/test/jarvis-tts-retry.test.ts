import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJarvisTtsWithRetry } from "@/lib/server/jarvis-tts-retry.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini audio retry", () => {
  it("recovers from one temporary 503 without replaying an incomplete response", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("audio", { status: 200 }));
    vi.stubGlobal("fetch", request);
    const reply = await fetchJarvisTtsWithRetry("https://example.org/audio", { method: "POST" });
    expect(reply.status).toBe(200);
    expect(await reply.text()).toBe("audio");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("never retries quota and permission responses", async () => {
    for (const status of [400, 401, 403, 429]) {
      const request = vi.fn().mockResolvedValue(new Response(null, { status }));
      vi.stubGlobal("fetch", request);
      const reply = await fetchJarvisTtsWithRetry("https://example.org/audio", { method: "POST" });
      expect(reply.status).toBe(status);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("respects an already aborted voice session", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(fetchJarvisTtsWithRetry("https://example.org/audio", {
      method: "POST", signal: controller.signal,
    })).rejects.toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });
});
