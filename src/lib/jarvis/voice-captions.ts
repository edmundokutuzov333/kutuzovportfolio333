import { cleanJarvisReply } from "@/lib/jarvis-text";

/** Plain-text transcript of exactly the segments sent to the audio player. */
export function appendSpokenCaption(previous: string, segment: string): string {
  const text = cleanJarvisReply(segment).trim();
  if (!text) return previous;
  const separator = previous && !/[\s([{«“‘/-]$/.test(previous) && !/^[,.;!?)}\]»”’]/.test(text) ? " " : "";
  return previous + separator + text;
}

/**
 * Gemini Live sends transcription fragments while playing audio. Depending on
 * session/resumption, a fragment can be a new delta or a longer cumulative
 * correction. Only fold overlaps of substantial length so intentional word
 * repetitions ("yes, yes") are not accidentally discarded.
 */
export function appendLiveCaption(previous: string, fragment: string): string {
  if (!fragment) return previous;
  if (!previous) return fragment;
  // Preserve the provider's whitespace exactly: consecutive deltas can split
  // words ("trans" + "cription"), and cleanup happens on the full caption.
  if (fragment.startsWith(previous) && previous.length >= 4) return fragment;
  if (previous.endsWith(fragment) && fragment.length >= 12) return previous;
  const maxOverlap = Math.min(previous.length, fragment.length);
  for (let length = maxOverlap; length >= 8; length--) {
    if (previous.endsWith(fragment.slice(0, length))) {
      return previous + fragment.slice(length);
    }
  }
  return previous + fragment;
}

