import { createFileRoute } from "@tanstack/react-router";
import { Buffer } from "node:buffer";
import { z } from "zod";

const MAX_AUDIO_BYTES = 2_400_000;
const Locale = z.enum(["en", "pt"]).default("en");
const SUPPORTED_AUDIO = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"]);

export function parseJarvisAudioHeaders(headers: Headers): { mimeType: string; locale: "en" | "pt" } | null {
  const mimeType = (headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const parsed = Locale.safeParse(headers.get("x-jarvis-locale") || "en");
  if (!SUPPORTED_AUDIO.has(mimeType) || !parsed.success) return null;
  return { mimeType, locale: parsed.data };
}

/** Raw audio transport avoids giant base64 JSON/server-action envelopes on mobile Safari. */
export async function handleJarvisAudioTranscription(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  const accepted = parseJarvisAudioHeaders(request.headers);
  if (!accepted) return Response.json({ error: "unsupported_audio_format" }, { status: 415, headers });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_AUDIO_BYTES) return Response.json({ error: "audio_too_large" }, { status: 413, headers });

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 300 || bytes.length > MAX_AUDIO_BYTES) {
      return Response.json({ error: "invalid_audio" }, {
        status: bytes.length > MAX_AUDIO_BYTES ? 413 : 400, headers,
      });
    }

    const { transcribeJarvis } = await import("@/lib/server/jarvis-kb.server");
    const result = await transcribeJarvis(Buffer.from(bytes).toString("base64"), accepted.mimeType, accepted.locale);
    if (result.error) return Response.json({ transcript: null, error: result.error }, { status: 503, headers });
    return Response.json({ transcript: result.reply?.trim() || null, error: null }, { headers });
  } catch (error) {
    console.warn("JARVIS_STT_TRANSPORT", error instanceof Error ? error.name : "unknown");
    return Response.json({ transcript: null, error: "transcription_unavailable" }, { status: 503, headers });
  }
}

export const Route = createFileRoute("/api/jarvis/transcribe")({
  server: { handlers: { POST: ({ request }) => handleJarvisAudioTranscription(request) } },
});
