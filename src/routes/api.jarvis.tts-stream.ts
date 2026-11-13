import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";
import {
  MAX_PCM_STREAM_BYTES, parseGeminiAudioDelta, parseSseData, takeSseEvents,
} from "@/lib/jarvis/pcm-stream";

const Input = z.object({
  text: z.string().trim().min(1).max(650),
  locale: z.enum(["en", "pt"]).default("en"),
}).strict();

export const Route = createFileRoute("/api/jarvis/tts-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = {
          "Cache-Control": "no-store, private",
          "X-Content-Type-Options": "nosniff",
        };
        const origin = request.headers.get("origin");
        if (request.headers.get("sec-fetch-site") === "cross-site" ||
            (origin && origin !== new URL(request.url).origin)) {
          return new Response(null, { status: 403, headers });
        }
        if (Number(request.headers.get("content-length") || "0") > 2000) {
          return new Response(null, { status: 413, headers });
        }
        let input: z.infer<typeof Input>;
        try {
          const body = await request.text();
          if (body.length > 2000) return new Response(null, { status: 413, headers });
          input = Input.parse(JSON.parse(body));
        } catch { return new Response(null, { status: 400, headers }); }

        const providerController = new AbortController();
        const onAbort = () => providerController.abort();
        request.signal.addEventListener("abort", onAbort, { once: true });
        try {
          const { getVerifiedFacts, acquireQuota } = await import("@/lib/server/jarvis-kb.server");
          const { validateContacts } = await import("@/lib/jarvis/facts");
          const { spokenJarvisText } = await import("@/lib/jarvis/speech");
          const [facts, permitted] = await Promise.all([getVerifiedFacts(), acquireQuota()]);
          if (!permitted) return new Response(null, { status: 429, headers });
          const key = process.env["GEMINI_API_KEY"];
          if (!key) return new Response(null, { status: 503, headers });
          const safe = validateContacts(input.text, facts, input.locale);
          const speech = spokenJarvisText(safe.text, input.locale).slice(0, 850);
          const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
            method: "POST",
            headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-3.8-flash-lite-tts",
              input: [{
                type: "user_input", content: [{
                  type: "text", text: speech,
                  annotations: [{ type: "speech_metadata", style: input.locale === "en"
                    ? "Adult male voice, low warm timbre, natural polished British English, calm confident delivery."
                    : "Adult male voice, low warm timbre, natural Portuguese as spoken in Mozambique and Portugal, never Brazilian pronunciation." }],
                }],
              }],
              response_format: { type: "audio", mime_type: "audio/l16", sample_rate: 24000 },
              generation_config: { speech_config: [{ voice: "Orus" }] },
              stream: true,
            }),
            cache: "no-store",
            signal: providerController.signal,
          });
          if (!response.ok || !response.body) {
            console.warn("JARVIS_TTS_STREAM_HTTP", response.status);
            return new Response(null, { status: 503, headers });
          }

          const reader = response.body.getReader();
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              let buffer = "", total = 0;
              let emitted = false;
              const write = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
              };
              const handle = (block: string) => {
                const delta = parseGeminiAudioDelta(parseSseData(block));
                if (!delta) return;
                const bytes = Buffer.from(delta, "base64");
                if (!bytes.length || bytes.length % 2 !== 0) return;
                total += bytes.length;
                if (total > MAX_PCM_STREAM_BYTES) throw new Error("tts_audio_limit");
                emitted = true;
                write("audio", { data: delta });
              };
              try {
                while (!providerController.signal.aborted) {
                  const chunk = await reader.read();
                  if (chunk.done) break;
                  buffer += decoder.decode(chunk.value, { stream: true });
                  if (buffer.length > 450_000) throw new Error("tts_event_limit");
                  const parsed = takeSseEvents(buffer);
                  buffer = parsed.tail;
                  for (const block of parsed.events) handle(block);
                }
                if (buffer.trim()) handle(buffer);
                if (!emitted) write("error", { reason: "no_audio" });
                else write("done", { bytes: total });
              } catch {
                if (!providerController.signal.aborted) write("error", { reason: "interrupted" });
              } finally {
                reader.cancel().catch(() => {});
                controller.close();
                request.signal.removeEventListener("abort", onAbort);
              }
            },
            cancel() {
              providerController.abort();
              request.signal.removeEventListener("abort", onAbort);
            },
          });
          return new Response(stream, {
            headers: {
              ...headers,
              "Content-Type": "text/event-stream; charset=utf-8",
              "X-Accel-Buffering": "no",
            },
          });
        } catch {
          return new Response(null, { status: 503, headers });
        } finally {
          // The streaming response owns providerController after headers are returned.
          if (providerController.signal.aborted) request.signal.removeEventListener("abort", onAbort);
        }
      },
    },
  },
});
