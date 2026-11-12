import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Mic, MessageSquare, Plus, Send, X } from "lucide-react";
import { EKMark } from "./EKMark";
import { askJarvis } from "@/lib/jarvis.functions";
import { jarvisWorks } from "@/lib/jarvis-works";
import "./JarvisLauncher.css";

export const JARVIS_OPEN_EVENT = "ek:jarvis-open";
export const openJarvis = () => window.dispatchEvent(new Event(JARVIS_OPEN_EVENT));

export function JarvisTrigger({ className = "", label = "JARVIS · AI" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={openJarvis} aria-haspopup="dialog" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-primary/60 blur-[3px] transition group-hover:bg-primary" />
        <span className="relative h-2 w-2 rounded-full bg-primary" />
      </span>
      <span>{label}</span>
    </button>
  );
}

type Msg = { role: "user" | "assistant"; content: string };
type VoiceState = "idle" | "listening" | "processing" | "speaking" | "unavailable";

const VOICE_LABEL: Record<VoiceState, string> = {
  idle: "Disponível para conversar",
  listening: "A ouvir…",
  processing: "A processar…",
  speaking: "A responder…",
  unavailable: "Ligação indisponível",
};

const SUGGESTIONS = [
  { id: "percurso", label: "Conhecer o meu percurso.", prompt: "Fala-me do teu percurso profissional." },
  { id: "projectos", label: "Explorar os meus projectos.", prompt: null },
  { id: "marcas", label: "Ver as marcas com que trabalhei.", prompt: "Com que marcas já trabalhaste?" },
] as const;

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

function getRecognition(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/* ---------- Conversation core (shared by voice + text) ---------- */
function useConversation() {
  const ask = useServerFn(askJarvis);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (text: string): Promise<string | null> => {
    const content = text.trim();
    if (!content || pending) return null;
    const next = [...messages, { role: "user" as const, content }].slice(-24);
    setMessages(next);
    setPending(true);
    setError(null);
    try {
      const res = await ask({ data: { messages: next } });
      if (res.reply) {
        setMessages((m) => [...m, { role: "assistant", content: res.reply! }]);
        return res.reply;
      }
      setError(res.error ?? "Algo correu mal.");
    } catch {
      setError("Ligação indisponível. Tente novamente.");
    } finally {
      setPending(false);
    }
    return null;
  }, [ask, messages, pending]);

  const reset = () => { setMessages([]); setError(null); };
  return { messages, pending, error, send, reset };
}


const WAVEFORM = [2, 3, 4, 8, 14, 23, 34, 47, 57, 47, 35, 25, 16, 9, 5, 3, 2];

function JarvisVoiceVisual({ voice, onToggle }: { voice: VoiceState; onToggle: () => void }) {
  return (
    <div className="jv-visual" data-state={voice}>
      <svg className="jv-visual__svg" viewBox="0 0 660 250" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="jv-outline" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16315f" />
            <stop offset="48%" stopColor="#317eff" />
            <stop offset="100%" stopColor="#0b2353" />
          </linearGradient>
          <radialGradient id="jv-sphere" cx="35%" cy="23%" r="86%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="34%" stopColor="#edf6ff" />
            <stop offset="73%" stopColor="#a4c6ff" />
            <stop offset="100%" stopColor="#659aff" />
          </radialGradient>
          <filter id="jv-softglow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="jv-waveglow" x="-100%" y="-200%" width="300%" height="500%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <path className="jv-visual__horizontal" d="M4 125H656" />
        <g className="jv-visual__waves">
          {WAVEFORM.map((height, i) => {
            const x = 96 + i * 8;
            return (
              <g key={i}>
                <path className="jv-visual__bar-glow" d={'M'+x+' '+(125-height/2)+'V'+(125+height/2)} filter="url(#jv-waveglow)" />
                <path className="jv-visual__bar" d={'M'+x+' '+(125-height/2)+'V'+(125+height/2)} style={{ animationDelay: i * -0.09 + 's' }} />
                <path className="jv-visual__bar-glow" d={'M'+(660-x)+' '+(125-height/2)+'V'+(125+height/2)} filter="url(#jv-waveglow)" />
                <path className="jv-visual__bar" d={'M'+(660-x)+' '+(125-height/2)+'V'+(125+height/2)} style={{ animationDelay: i * -0.09 + 's' }} />
              </g>
            );
          })}
        </g>
        <circle cx="330" cy="125" r="119" className="jv-visual__dots" />
        <circle cx="330" cy="125" r="101" className="jv-visual__outer-glow" />
        <circle cx="330" cy="125" r="100" className="jv-visual__outer" />
        <circle cx="330" cy="125" r="87" className="jv-visual__middle" />
        <circle cx="330" cy="125" r="76" className="jv-visual__ring-glow" filter="url(#jv-softglow)" />
        <circle cx="330" cy="125" r="76" className="jv-visual__ring" />
        <circle cx="330" cy="125" r="76" className="jv-visual__arc" />
        <path className="jv-visual__crosshair" d="M330 15V39M330 211V235M218 125H242M418 125H442" />
        <circle cx="330" cy="125" r="45" className="jv-visual__sphere-glow" filter="url(#jv-softglow)" />
        <circle cx="330" cy="125" r="36" fill="url(#jv-sphere)" className="jv-visual__sphere" />
      </svg>
      <button
        type="button"
        className="jv-orbit-hit"
        onClick={onToggle}
        disabled={voice === "processing"}
        aria-pressed={voice === "listening"}
        aria-label={voice === "listening" ? "Parar de ouvir" : voice === "speaking" ? "Parar resposta falada" : "Falar com Kutuzov por voz"}
      />
    </div>
  );
}

export function JarvisLauncher({ whatsapp }: { whatsapp?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const convo = useConversation();
  const recRef = useRef<SpeechRec | null>(null);
  const voiceSession = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const stopVoice = useCallback(() => {
    voiceSession.current += 1;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.stop(); } catch { /* Recognition may already have ended. */ }
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setVoice("idle");
  }, []);

  const close = useCallback(() => {
    stopVoice();
    setChatOpen(false);
    setOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  }, [stopVoice]);

  useEffect(() => {
    const onOpen = () => { returnFocus.current = document.activeElement as HTMLElement; setOpen(true); };
    window.addEventListener(JARVIS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(JARVIS_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (chatOpen) setChatOpen(false); else close();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, chatOpen, close]);

  const speak = (text: string, session: number) => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setVoice("idle");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-PT";
    utterance.onend = () => { if (voiceSession.current === session) setVoice("idle"); };
    utterance.onerror = () => { if (voiceSession.current === session) setVoice("idle"); };
    setVoice("speaking");
    synth.cancel();
    synth.speak(utterance);
  };

  const toggleVoice = () => {
    if (voice === "listening" || voice === "speaking") { stopVoice(); return; }
    if (voice === "processing") return;

    const rec = getRecognition();
    if (!rec) { setVoice("unavailable"); return; }
    stopVoice();
    const session = voiceSession.current;
    recRef.current = rec;
    rec.lang = "pt-PT";
    rec.interimResults = false;
    let heard = "";
    let failed = false;
    rec.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" "); };
    rec.onerror = () => {
      failed = true;
      if (voiceSession.current !== session) return;
      recRef.current = null;
      setVoice("unavailable");
    };
    rec.onend = async () => {
      if (voiceSession.current !== session || failed) return;
      recRef.current = null;
      if (!heard.trim()) { setVoice("idle"); return; }
      setVoice("processing");
      const reply = await convo.send(heard);
      if (voiceSession.current !== session) return;
      if (reply) speak(reply, session);
      else setVoice("unavailable");
    };
    try { rec.start(); setVoice("listening"); }
    catch { recRef.current = null; setVoice("unavailable"); }
  };

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Kutuzov, assistente de IA de Edmundo Kutuzov"
      className="jv-root"
    >
      <div className="jv-atmosphere" aria-hidden="true"><span className="jv-horizon" /></div>
      <div className="jv-frame">
        <header className="jv-header">
          <Link to="/" onClick={close} className="jv-brand" aria-label="Edmundo Kutuzov, página inicial">
            <EKMark className="jv-brand__mark" />
            <span>EDMUNDO KUTUZOV</span>
          </Link>
          <div className="jv-header__actions">
            <span className="jv-header__light" aria-hidden="true" />
            <button type="button" onClick={close} aria-label="Fechar" className="jv-close"><X size={16} strokeWidth={1.4} /></button>
          </div>
        </header>

        <main className="jv-main">
          <section className="jv-panel" aria-labelledby="jv-title">
            <p className="jv-eyebrow">KUTUZOV · IA DE EDMUNDO</p>
            <h1 id="jv-title">Estou por aqui.</h1>
            <p className="jv-description">Fala comigo. Explora o meu trabalho. Abre uma janela para cada ideia.</p>
            <JarvisVoiceVisual voice={voice} onToggle={toggleVoice} />
            <div className="jv-voice-meta">
              <button type="button" className="jv-voice-caption" onClick={toggleVoice} disabled={voice === "processing"}>
                FALAR COM KUTUZOV
              </button>
              <span className="jv-voice-state" role="status" aria-live="polite">
                <span className="jv-voice-state__dot" aria-hidden="true" />
                {VOICE_LABEL[voice]}
              </span>
            </div>
            <button type="button" className="jv-chat-button" onClick={() => setChatOpen(true)}>
              <MessageSquare size={21} strokeWidth={1.5} aria-hidden="true" />
              Abrir conversa escrita
            </button>
          </section>
        </main>

        <footer className="jv-footer">
          <span>PREFERE FALAR COM O EDMUNDO REAL?</span>
          <nav aria-label="Contactos" className="jv-footer__links">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer">WHATSAPP ↗</a>}
            <Link to="/contact" onClick={close}>ENVIAR BRIEFING →</Link>
          </nav>
        </footer>
      </div>

      {chatOpen && (
        <ChatWindow
          convo={convo}
          onClose={() => setChatOpen(false)}
          onCloseAll={close}
          onVoice={() => { setChatOpen(false); toggleVoice(); }}
        />
      )}
    </div>
  );
}

/* ---------- Conversation window ---------- */
function ChatWindow({ convo, onClose, onCloseAll, onVoice }: {
  convo: ReturnType<typeof useConversation>;
  onClose: () => void;
  onCloseAll: () => void;
  onVoice: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [showWorks, setShowWorks] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasHistory = convo.messages.length > 0;

  useEffect(() => { taRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [convo.messages.length, convo.pending]);

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const submit = async (text = draft) => {
    if (!text.trim() || convo.pending) return;
    setShowWorks(false);
    setDraft("");
    requestAnimationFrame(autosize);
    await convo.send(text);
  };

  return (
    <div className="jv-chat-overlay fixed inset-0 z-[80] flex items-stretch justify-center bg-background/70 backdrop-blur-sm md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="jv-chat-title" className="jv-chat-card flex h-[100svh] w-full flex-col overflow-hidden bg-card md:h-[min(86svh,780px)] md:max-w-[880px] md:rounded-2xl md:border md:border-border md:shadow-2xl">
        {/* WINDOW HEADER */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4 pt-[env(safe-area-inset-top)] md:px-5">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" /><span className="h-2.5 w-2.5 rounded-full bg-muted" /><span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          </span>
          <h2 id="jv-chat-title" className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.22em]">Conversa comigo</h2>
          {(hasHistory || showWorks) && (
            <button type="button" onClick={() => { convo.reset(); setShowWorks(false); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Plus className="h-3.5 w-3.5" /> Nova
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Fechar conversa" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* CONTENT */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8">
          {showWorks ? (
            <WorksPanel onPick={onCloseAll} />
          ) : !hasHistory ? (
            <div className="mx-auto flex max-w-[44rem] flex-col gap-6">
              <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" /> Disponível
              </p>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-tight">Olá. Sou o Kutuzov.</h3>
                <p className="max-w-[36rem] text-muted-foreground">Sou a versão IA do Edmundo. Pergunta-me sobre o meu trabalho, as marcas com que colaborei ou como podemos criar juntos.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => (s.prompt ? submit(s.prompt) : setShowWorks(true))}
                    className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-0">{s.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="mx-auto flex max-w-[44rem] flex-col gap-4" aria-live="polite">
              {convo.messages.map((m, i) => (
                <li key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground" : "mr-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-border px-4 py-2.5 text-sm"}>
                  {m.content}
                </li>
              ))}
              {convo.pending && <li className="mr-auto font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">A processar…</li>}
            </ol>
          )}
          {convo.error && <p role="alert" className="mx-auto mt-4 max-w-[44rem] text-sm text-destructive">{convo.error}</p>}
        </div>

        {/* COMPOSER */}
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
          <div className="mx-auto max-w-[44rem] rounded-xl border border-border bg-background/40 focus-within:border-primary">
            <label htmlFor="jv-input" className="sr-only">Mensagem para Kutuzov</label>
            <textarea
              id="jv-input"
              ref={taRef}
              rows={2}
              value={draft}
              maxLength={2000}
              onChange={(e) => { setDraft(e.target.value); autosize(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
              placeholder="Escreva-me uma mensagem…"
              className="block max-h-[180px] w-full resize-none overflow-y-auto bg-transparent px-4 pt-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-2">
              <button type="button" onClick={onVoice} title="Falar por voz" aria-label="Mudar para conversa por voz" className="inline-flex h-9 items-center gap-2 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <Mic className="h-4 w-4" /> Voz
              </button>
              <button type="submit" disabled={!draft.trim() || convo.pending} aria-label={convo.pending ? "A enviar" : "Enviar mensagem"} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {convo.pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function WorksPanel({ onPick }: { onPick: () => void }) {
  return (
    <div className="mx-auto flex max-w-[44rem] flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{jarvisWorks.length} trabalhos do portfólio</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {jarvisWorks.map((w) => (
          <li key={w.slug}>
            <Link to="/work/$slug" params={{ slug: w.slug }} onClick={onPick} className="group block overflow-hidden rounded-lg border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {w.cover_path && <img src={w.cover_path} alt={w.cover_alt ?? w.title} loading="lazy" className="block h-auto w-full transition group-hover:scale-[1.02]" />}
              <span className="flex items-start justify-between gap-2 p-2.5 text-xs">
                <span className="min-w-0"><span className="block truncate">{w.title}</span><span className="block truncate text-muted-foreground">{w.client_label}</span></span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
