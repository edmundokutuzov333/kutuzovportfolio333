import { Buffer } from "node:buffer";

type AudioStep = { type?: string; content?: Array<{ type?: string; data?: string }> };
/** Gemini Interactions raw JSON can expose audio in output_audio or the last model_output step. */
export function extractJarvisWav(value: unknown): Uint8Array | null {
  if (!value || typeof value !== "object") return null;
  const data = value as {
    output_audio?: { data?: string };
    outputAudio?: { data?: string };
    steps?: AudioStep[];
  };
  const encoded = data.output_audio?.data ?? data.outputAudio?.data ??
    data.steps?.filter(step => step.type === "model_output")
      .flatMap(step => step.content ?? [])
      .filter(part => part.type === "audio").at(-1)?.data;
  if (typeof encoded !== "string" || encoded.length < 60 || encoded.length > 4_000_000) return null;
  if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 44 || bytes.length > 2_400_000 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE") return null;
  return new Uint8Array(bytes);
}
