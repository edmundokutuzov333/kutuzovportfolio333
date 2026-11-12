/** Turns common model Markdown into readable plain-language chat text.
 * Shared by voice and written responses; no HTML is interpreted by the UI.
 */
export function cleanJarvisReply(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/^[ \t]*```[^\n]*\n?/gm, "")
    .replace(/^\s*(?:#{1,6}\s+|>\s+)/gm, "")
    .replace(/^\s*(?:[-*+•]\s+)/gm, "")
    .replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,;:!?)])/gm, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/gm, "$1$2")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
