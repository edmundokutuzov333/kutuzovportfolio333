/** Convert verified public contact strings to intelligible browser TTS.
 * The canonical value remains untouched in the text transcript.
 * No personal contact is embedded in this helper.
 */
import type { JarvisLocale } from "./facts";
export function spokenJarvisText(text: string, locale: JarvisLocale = "pt"): string {
  const dot=locale==="en"?" dot ":" ponto ";
  const underscore=locale==="en"?" underscore ":" traço baixo ";
  const at=locale==="en"?" at ":" arroba ";
  return text
    .replace(/https:\/\/wa\.me\/(\d{8,15})\b/gi, (_, digits: string) =>
      "WhatsApp, " + digits.split("").join(" "))
    .replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+)\.([a-z]{2,})\b/gi,
      (_, name: string, domain: string, ext: string) =>
        name.replace(/\./g, dot).replace(/_/g, underscore)
        + at + domain.replace(/\./g, dot) + dot + ext)
    .replace(/https?:\/\/[^\s]+/gi, locale==="en"?"link available in the text chat":"ligação disponível na conversa escrita");
}
