/** Browser codec negotiation. Safari prefers MP4/AAC; Chromium usually supports WebM/Opus.
 * The final MIME is always taken from the created recorder, not guessed from a user agent.
 */
export const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function preferredRecordingMime(isSupported: (type: string) => boolean): string | undefined {
  for (const type of RECORDING_MIME_CANDIDATES) {
    try { if (isSupported(type)) return type; } catch { /* Use the next supported codec. */ }
  }
  // Let MediaRecorder select its own supported browser format.
  return undefined;
}

export function normalizedAudioMime(mimeType: string): string | null {
  const type = mimeType.split(";")[0]?.trim().toLowerCase();
  return type && ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"].includes(type)
    ? type : null;
}

/** Conservative end-of-speech detector: don't cut off natural pauses or quiet starts. */
export function shouldEndRecording(options: {
  speechDetected: boolean;
  silenceMs: number;
  elapsedMs: number;
}): boolean {
  // Built-in Live VAD guidance recommends 500–800ms. Permit slightly
  // longer pauses on short questions to avoid truncating natural speech.
  const requiredSilenceMs = options.elapsedMs < 2800 ? 900 : 700;
  return options.speechDetected && options.elapsedMs >= 1100 && options.silenceMs >= requiredSilenceMs;
}

export const MAX_JARVIS_RECORDING_MS = 18_000;
export const MAX_JARVIS_AUDIO_BYTES = 2_400_000;
