import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Mic, MessageSquare, Plus, Send, X } from "lucide-react";
import { EKMark } from "./EKMark";
import { askJarvis } from "@/lib/jarvis.functions";
import { jarvisWorks } from "@/lib/jarvis-works";

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

export function JarvisLauncher({ whatsapp }: { whatsapp?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const convo = useConversation();
  const recRef = useRef<SpeechRec | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    recRef.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setChatOpen(false);
    setOpen(false);
    setVoice("idle");
    returnFocus.current?.focus?.();
  }, []);

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

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) { setVoice("idle"); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-PT";
    u.onend = () => setVoice("idle");
    u.onerror = () => setVoice("idle");
    setVoice("speaking");
    synth.speak(u);
  };

  const toggleVoice = () => {
    if (voice === "listening") { recRef.current?.stop(); return; }
    if (voice === "speaking") { window.speechSynthesis?.cancel(); setVoice("idle"); return; }
    if (voice === "processing") return;
    const rec = getRecognition();
    if (!rec) { setVoice("unavailable"); return; }
    recRef.current = rec;
    rec.lang = "pt-PT";
    rec.interimResults = false;
    let heard = "";
    rec.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" "); };
    rec.onerror = () => setVoice("unavailable");
    rec.onend = async () => {
      if (!heard.trim()) { setVoice((v) => (v === "listening" ? "idle" : v)); return; }
      setVoice("processing");
      const reply = await convo.send(heard);
      if (reply) speak(reply); else setVoice("unavailable");
    };
    setVoice("listening");
    try { rec.start(); } catch { setVoice("unavailable"); }
  };

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Kutuzov, assistente de IA de Edmundo Kutuzov"
      className="jv-root fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-background text-foreground outline-none"
    >
      {/* Layer 0–1: background + technical grid (decorative) */}
      <div aria-hidden className="jv-grid pointer-events-none fixed inset-0" />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-[1440px] grid-rows-[auto_minmax(0,1fr)_auto] px-[clamp(1rem,4vw,3rem)] pt-[max(env(safe-area-inset-top),0px)] pb-[env(safe-area-inset-bottom)]">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 py-5">
          <Link to="/" onClick={close} className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <EKMark className="h-5 w-auto shrink-0 text-foreground" />
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.22em]">Edmundo Kutuzov</span>
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <span aria-hidden className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
            <button type="button" onClick={close} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* MAIN HERO */}
        <main className="flex flex-col items-center justify-center gap-[clamp(1.25rem,3svh,2.25rem)] py-[clamp(1rem,4svh,3rem)] text-center">
          {/* Orbital visual system — decorative, own container */}
          <div aria-hidden className="jv-orbit pointer-events-none relative aspect-square w-[clamp(160px,24vw,340px)] shrink-0" data-state={voice}>
            <span className="jv-ring absolute inset-0 rounded-full" />
            <span className="jv-ring jv-ring-2 absolute inset-[12%] rounded-full" />
            <span className="jv-ring jv-ring-3 absolute inset-[-10%] rounded-full" />
            <span className="jv-core absolute inset-[26%] rounded-full" />
          </div>

          <div className="flex max-w-[34rem] flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Kutuzov · IA de Edmundo</p>
            <h2 className="font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-tight">Estou por aqui.</h2>
            <p className="max-w-[28rem] text-[clamp(0.95rem,1.4vw,1.05rem)] leading-relaxed text-muted-foreground">
              Fala comigo. Explora o meu trabalho. Abre uma janela para cada ideia.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voice === "listening"}
              aria-label={voice === "listening" ? "Parar de ouvir" : "Falar com Kutuzov por voz"}
              className="jv-voice group relative grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-primary/50 bg-card transition hover:border-primary active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              data-state={voice}
            >
              <span aria-hidden className="flex h-7 items-center gap-[3px]">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} className="jv-bar w-[3px] rounded-full bg-primary" style={{ animationDelay: `${i * 0.09}s` }} />)}
              </span>
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">Falar com Kutuzov</span>
            <span role="status" aria-live="polite" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{VOICE_LABEL[voice]}</span>
          </div>

          <button type="button" onClick={() => setChatOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <MessageSquare className="h-4 w-4" /> Abrir conversa escrita
          </button>
        </main>

        {/* FOOTER */}
        <footer className="flex flex-col gap-3 border-t border-border py-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Prefere falar com o Edmundo real?</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary">WhatsApp ↗</a>}
            <Link to="/contact" onClick={close} className="text-foreground hover:text-primary">Enviar briefing →</Link>
          </div>
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
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-background/70 backdrop-blur-sm md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="jv-chat-title" className="flex h-[100svh] w-full flex-col overflow-hidden bg-card md:h-[min(86svh,780px)] md:max-w-[880px] md:rounded-2xl md:border md:border-border md:shadow-2xl">
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
