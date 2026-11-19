/**
 * Retry a transient voice-provider outage once, without retrying quota (429),
 * authorization, validation, or other permanent errors. No duplicate replay:
 * callers only receive the final successful response body.
 */
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);

function retryDelay(signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("tts_aborted"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("tts_aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 250);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchJarvisTtsWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (init.signal?.aborted) throw init.signal.reason ?? new Error("tts_aborted");
    try {
      const response = await fetch(url, init);
      if (attempt === 1 || !TRANSIENT_STATUSES.has(response.status)) return response;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      if (init.signal?.aborted || attempt === 1) throw error;
    }
    await retryDelay(init.signal);
  }
  throw new Error("tts_retry_exhausted");
}
