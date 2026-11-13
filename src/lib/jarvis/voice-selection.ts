/** Browser speech voice selection without accidentally using pt-BR.
 * Web Speech API has no gender metadata; only known masculine PT/MZ voices qualify.
 * Native Gemini Live is preferred and explicitly configured with Orus.
 */
import type { JarvisLocale } from "./facts";
export type BrowserVoice = Pick<SpeechSynthesisVoice, "name"|"lang">;
const MASCULINE_NAMES=/\b(duarte|rui|jo[aã]o|jorge|ant[oó]nio|manuel|paulo|miguel|vasco|hugo|francisco|carlos|fernando|nuno|pedro|diogo|tiago|rodrigo|bruno)\b/i;
export function choosePortugueseMaleVoice<T extends BrowserVoice>(voices:readonly T[]):T|null {
  const candidates=voices.filter(v=>/^pt-(?:mz|pt)$/i.test(v.lang));
  const male=candidates.filter(v=>MASCULINE_NAMES.test(v.name));
  const rank=(v:T)=>/^pt-mz$/i.test(v.lang)?0:1;
  return male.sort((a,b)=>rank(a)-rank(b))[0]??null;
}
/** Only voices whose names are explicitly male are selected: Web Speech has no gender metadata. */
const EN_MALE_NAMES=/\b(daniel|oliver|arthur|george|james|ryan|thomas|william|alfie|david|fred|matthew|john|adam|harry|male)\b/i;
export function chooseEnglishMaleVoice<T extends BrowserVoice>(voices:readonly T[]):T|null {
  const male=voices.filter(v=>/^en(?:-[a-z]{2})?$/i.test(v.lang)&&EN_MALE_NAMES.test(v.name));
  const rank=(v:T)=>/^en-gb$/i.test(v.lang)?0:/^en-za$/i.test(v.lang)?1:/^en-us$/i.test(v.lang)?2:3;
  return male.sort((a,b)=>rank(a)-rank(b))[0]??null;
}
export function chooseJarvisMaleVoice<T extends BrowserVoice>(voices:readonly T[],locale:JarvisLocale):T|null {
  return locale==="en"?chooseEnglishMaleVoice(voices):choosePortugueseMaleVoice(voices);
}
export const JARVIS_LIVE_VOICE="Orus";
export const JARVIS_SPEECH_LOCALE="pt-PT";
export const jarvisSpeechLocale=(locale:JarvisLocale)=>locale==="en"?"en-GB":"pt-PT";
export function describeVoiceFallback(voices:readonly BrowserVoice[],locale:JarvisLocale="pt"):string|null {
  if(chooseJarvisMaleVoice(voices,locale))return null;
  return locale==="en"
    ? "This device has no confirmed male English voice. You can read the response in text chat."
    : "Este dispositivo não disponibiliza uma voz masculina portuguesa confirmada. A resposta continua disponível por escrito.";
}
