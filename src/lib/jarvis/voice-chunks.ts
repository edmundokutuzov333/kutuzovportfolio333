/** Split speech only on safe, natural boundaries. Never drop or duplicate characters.
 * TTS receives smaller requests so the first spoken segment is ready sooner.
 */
export function splitVoiceSegments(text: string, maxLength = 440): string[] {
  const result: string[] = [];
  let remaining = text.trim();
  if (!remaining) return result;
  const cap = Math.max(80, Math.min(650, Math.floor(maxLength)));
  while (remaining.length > cap) {
    const fragment = remaining.slice(0, cap + 1);
    const sentenceEnds = [...fragment.matchAll(/[.!?](?:\s+|$)/g)];
    const lastSentence = sentenceEnds.at(-1);
    let cut = lastSentence ? lastSentence.index! + lastSentence[0].length : -1;
    if (cut < 65) cut = fragment.lastIndexOf(" ");
    if (cut < 65) cut = cap;
    result.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}
