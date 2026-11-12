/** Browser speech voice selection without accidentally using pt-BR.
 * Web Speech API has no gender metadata; only known masculine PT/MZ voices qualify.
 * Native Gemini Live is preferred and explicitly configured with Orus.
 */
export type BrowserVoice = Pick<SpeechSynthesisVoice, "name"|"lang">;
const MASCULINE_NAMES=/\b(duarte|rui|jo[aã]o|jorge|ant[oó]nio|manuel|paulo|miguel|vasco|hugo|francisco|carlos|fernando|nuno|pedro|diogo|tiago|rodrigo|bruno)\b/i;
export function choosePortugueseMaleVoice<T extends BrowserVoice>(voices:readonly T[]):T|null {
  const candidates=voices.filter(v=>/^pt-(?:mz|pt)$/i.test(v.lang));
  const male=candidates.filter(v=>MASCULINE_NAMES.test(v.name));
  const rank=(v:T)=>/^pt-mz$/i.test(v.lang)?0:1;
  return male.sort((a,b)=>rank(a)-rank(b))[0]??null;
}
export const JARVIS_LIVE_VOICE="Orus";
export const JARVIS_SPEECH_LOCALE="pt-PT";
export function describeVoiceFallback(voices:readonly BrowserVoice[]):string|null {
  if(choosePortugueseMaleVoice(voices))return null;
  return "Este dispositivo não disponibiliza uma voz masculina portuguesa confirmada. A resposta continua disponível por escrito.";
}
