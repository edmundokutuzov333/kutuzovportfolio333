/** Restrictive parsing: only audio payloads are relayed, never provider metadata or API keys. */
export const JARVIS_PCM_SAMPLE_RATE = 24_000;
export const MAX_PCM_STREAM_BYTES = 2_400_000;

export function parseGeminiAudioDelta(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as {
    event_type?: string;
    delta?: { type?: string; data?: unknown };
    type?: string;
    data?: unknown;
  };
  if (event.event_type && event.event_type !== "step.delta") return null;
  const delta = event.delta ?? event;
  if (delta.type !== "audio" || typeof delta.data !== "string") return null;
  if (!delta.data || delta.data.length > 320_000 || delta.data.length % 4 !== 0) return null;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(delta.data) ? delta.data : null;
}

export function pcmBytesFromBase64(base64: string): Uint8Array | null {
  if (!base64 || base64.length > 320_000 || base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  try {
    const raw = atob(base64);
    if (!raw.length || raw.length % 2 !== 0) return null;
    const result = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index++) result[index] = raw.charCodeAt(index);
    return result;
  } catch { return null; }
}

export function pcmToFloat32(bytes: Uint8Array): Float32Array | null {
  if (!bytes.length || bytes.length % 2 !== 0) return null;
  const float = new Float32Array(bytes.length / 2);
  for (let i = 0; i < float.length; i++) {
    let value = bytes[i * 2]! | (bytes[i * 2 + 1]! << 8);
    if (value >= 32768) value -= 65536;
    float[i] = value / 32768;
  }
  return float;
}

/** Handles either regular CRLF or LF and multiple SSE events per network frame. */
export function takeSseEvents(buffer: string): { events: string[]; tail: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  return { events: chunks.slice(0, -1), tail: chunks.at(-1) ?? "" };
}

export function parseSseData(block: string): unknown | null {
  const data = block.split("\n").filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trim()).join("\n");
  if (!data || data === "[DONE]") return null;
  try { return JSON.parse(data) as unknown; } catch { return null; }
}
