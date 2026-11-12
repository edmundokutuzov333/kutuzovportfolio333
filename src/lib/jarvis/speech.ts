/** Convert verified public contact strings to intelligible browser TTS.
 * The canonical value remains untouched in the text transcript.
 * No personal contact is embedded in this helper.
 */
export function spokenJarvisText(text: string): string {
  return text
    .replace(/https:\/\/wa\.me\/(\d{8,15})\b/gi, (_, digits: string) =>
      "WhatsApp, " + digits.split("").join(" "))
    .replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+)\.([a-z]{2,})\b/gi,
      (_, name: string, domain: string, ext: string) =>
        name.replace(/\./g, " ponto ").replace(/_/g, " traço baixo ")
        + " arroba " + domain.replace(/\./g, " ponto ") + " ponto " + ext)
    .replace(/https?:\/\/[^\s]+/gi, "ligação disponível na conversa escrita");
}
