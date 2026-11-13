import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, MessageSquare, Plus, Send, X } from "lucide-react";
import { EKMark } from "./EKMark";
import { askJarvis, transcribeJarvisAudio } from "@/lib/jarvis.functions";
import { cleanJarvisReply } from "@/lib/jarvis-text";
import { spokenJarvisText } from "@/lib/jarvis/speech";
import { choosePortugueseMaleVoice, describeVoiceFallback } from "@/lib/jarvis/voice-selection";
import { buildJarvisHistory } from "@/lib/jarvis/history";
import "./JarvisLauncher.css";

export const JARVIS_OPEN_EVENT = "ek:jarvis-open";
export const JARVIS_CLOSE_EVENT = "ek:jarvis-close";
export const openJarvis = () => window.dispatchEvent(new Event(JARVIS_OPEN_EVENT));

export function JarvisTrigger({ className = "", label = "JARVIS · AI" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={openJarvis} aria-haspopup="dialog" className={"group inline-flex items-center gap-2.5 " + className}>
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
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const VOICE_LABEL: Record<VoiceState, string> = {
  idle: "Disponível para conversar",
  listening: "A ouvir…",
  processing: "A processar…",
  speaking: "A responder…",
  unavailable: "Voz indisponível. Tente novamente.",
};
const SUGGESTIONS = [
  { id: "percurso", label: "Conhecer o meu percurso.", prompt: "Fala-me do teu percurso profissional." },
  { id: "projectos", label: "Explorar os meus projectos.", prompt: null },
  { id: "marcas", label: "Ver as marcas com que trabalhei.", prompt: "Com que marcas já trabalhaste?" },
] as const;
const WAVEFORM = [2, 3, 4, 8, 14, 23, 34, 47, 57, 47, 35, 25, 16, 9, 5, 3, 2];

function getRecognition(): SpeechRec | null {
  const scope = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

/** Only update React when a whole message changes, never for microphone frames. */
function useConversation() {
  const ask = useServerFn(askJarvis);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Msg[]>([]);
  const busy = useRef(false);
  const epoch = useRef(0);

  const streamingController = useRef<AbortController | null>(null);
  const send = useCallback(async (raw: string): Promise<string | null> => {
    const content = raw.trim();
    if (!content || busy.current) return null;
    busy.current = true;
    const version = ++epoch.current;
    const next: Msg[] = [...current.current, { role: "user" as const, content }].slice(-100);
    const modelHistory = buildJarvisHistory(next);
    current.current = next;
    setMessages(next);
    setPending(true);
    setError(null);
    let reply = "";
    let receivedError: string | null = null;
    const controller = new AbortController();
    streamingController.current = controller;
    const addText = (fragment: string) => {
      if (epoch.current !== version || !fragment) return;
      // Sentence-level server chunks are cleaned separately, so restore word
      // spacing between neighbouring sentences in the visible transcript.
      reply += (reply && !/\s$/.test(reply) && !/^[\s.,;!?]/.test(fragment) ? " " : "") + fragment;
      const displayed = [...next, { role: "assistant" as const, content: cleanJarvisReply(reply) }].slice(-100);
      current.current = displayed;
      setMessages(displayed);
    };
    try {
      const response = await fetch("/api/jarvis/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ messages: modelHistory }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("stream_unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let unread = "";
      const parse = (block: string) => {
        const kind = /^event:\s*(\S+)/m.exec(block)?.[1];
        const data = /^data:\s*(.*)$/m.exec(block)?.[1];
        if (!data) return;
        try {
          const message = JSON.parse(data) as { text?: string; message?: string };
          if (kind === "chunk" && typeof message.text === "string") addText(message.text);
          if (kind === "error") receivedError = message.message ?? "Não foi possível obter resposta.";
        } catch { /* Discard invalid server event without exposing raw fragments. */ }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        unread += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const blocks = unread.split("\n\n");
        unread = blocks.pop() ?? "";
        for (const block of blocks) parse(block);
      }
      if (unread.trim()) parse(unread);
      if (epoch.current !== version) return null;
      if (receivedError && !reply) setError(receivedError);
      if (receivedError && reply) setError("A resposta foi interrompida. Pode voltar a tentar.");
      if (reply) return cleanJarvisReply(reply);
      if (receivedError) return null;
      throw new Error("empty_stream");
    } catch {
      if (epoch.current !== version || controller.signal.aborted) return null;
      if (reply) {
        setError("A ligação foi interrompida. Pode voltar a tentar.");
        return cleanJarvisReply(reply);
      }
      // Older browsers / route incompatibilities: preserve original server function.
      try {
        const response = await ask({ data: { messages: modelHistory } });
        if (epoch.current !== version) return null;
        if (response.reply) {
          addText(cleanJarvisReply(response.reply));
          return cleanJarvisReply(reply);
        }
        setError(response.error || "Não foi possível obter resposta. Tente novamente.");
      } catch {
        if (epoch.current === version) setError("Não foi possível contactar o servidor. Tente novamente.");
      }
    } finally {
      if (epoch.current === version) {
        busy.current = false;
        streamingController.current = null;
        setPending(false);
      }
    }
    return null;
  }, [ask]);

  const reset = useCallback(() => {
    streamingController.current?.abort();
    streamingController.current = null;
    epoch.current++;
    busy.current = false;
    current.current = [];
    setMessages([]);
    setError(null);
    setPending(false);
  }, []);

  const remember = useCallback((role: Msg["role"], raw: string) => {
    const content = raw.trim().slice(0, 1900);
    if (!content) return;
    const updated = [...current.current, { role, content }].slice(-100);
    current.current = updated;
    setMessages(updated);
  }, []);

  return { messages, pending, error, send, reset, remember };
}

/** The SVG bars take a real microphone RMS level from the Web Audio API. */
function JarvisVoiceVisual({ voice, onToggle, visualRef }: {
  voice: VoiceState;
  onToggle: () => void;
  visualRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="jv-visual" data-state={voice} ref={visualRef}>
      <svg className="jv-visual__svg" viewBox="0 0 660 250" aria-hidden="true" focusable="false">
        <defs>
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
          {WAVEFORM.map((height, index) => {
            const x = 96 + index * 8;
            const line = "M" + x + " " + (125 - height / 2) + "V" + (125 + height / 2);
            const opposite = "M" + (660 - x) + " " + (125 - height / 2) + "V" + (125 + height / 2);
            return (
              <g key={index}>
                <path className="jv-visual__bar-glow" d={line} filter="url(#jv-waveglow)" />
                <path className="jv-visual__bar" d={line} style={{ animationDelay: index * -0.09 + "s" }} />
                <path className="jv-visual__bar-glow" d={opposite} filter="url(#jv-waveglow)" />
                <path className="jv-visual__bar" d={opposite} style={{ animationDelay: index * -0.09 + "s" }} />
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
      <button type="button" className="jv-orbit-hit" onClick={onToggle} disabled={voice === "processing"}
        aria-pressed={voice === "listening"}
        aria-label={voice === "listening" ? "Parar de ouvir" : voice === "speaking" ? "Parar resposta falada" : "Falar com Kutuzov por voz"} />
    </div>
  );
}

type GalleryWork = {
  slug: string;
  title: string;
  client: string;
  cover: string;
};
let worksCache: GalleryWork[] | null = null;
let worksLoading: Promise<GalleryWork[]> | null = null;

/** Same published CMS data and asset resolution as /work; loaded only on demand. */
async function getJarvisWorks(): Promise<GalleryWork[]> {
  if (worksCache) return worksCache;
  if (!worksLoading) {
    worksLoading = Promise.all([
      import("@/lib/cms/queries"),
      import("@/lib/public-assets"),
    ]).then(async ([cms, assets]) => {
      const projects = await cms.getProjects();
      const works = projects.map((project) => ({
        slug: project.slug,
        title: project.title,
        client: project.client || project.discipline || "",
        cover: assets.resolvePublicAssetUrl(project.cover || project.gallery[0]),
        featured: project.featured,
      }));
      works.sort((a, b) => Number(b.featured) - Number(a.featured));
      worksCache = works.map(({ slug, title, client, cover }) => ({ slug, title, client, cover }));
      return worksCache;
    }).catch((error: unknown) => {
      worksLoading = null;
      throw error;
    });
  }
  return worksLoading;
}

function HologramWork({ work, onPick }: { work: GalleryWork; onPick: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <li>
      <Link to="/work/$slug" params={{ slug: work.slug }} onClick={onPick} className="jv-hologram">
        <span className={"jv-hologram__art" + (!work.cover || broken ? " jv-hologram__art--empty" : "")}>
          {work.cover && !broken
            ? <img src={work.cover} alt={work.title} loading="lazy" decoding="async" onError={() => setBroken(true)} />
            : <EKMark className="jv-hologram__fallback" />}
          <span className="jv-hologram__scan" aria-hidden="true" />
          <ArrowUpRight className="jv-hologram__arrow" size={19} aria-hidden="true" />
        </span>
        <span className="jv-hologram__info">
          <strong>{work.title}</strong>
          {work.client && <small>{work.client}</small>}
        </span>
      </Link>
    </li>
  );
}

function WorksPanel({ onPick }: { onPick: () => void }) {
  const [works, setWorks] = useState<GalleryWork[]>(() => worksCache ?? []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(worksCache ? "ready" : "loading");
  const [count, setCount] = useState(12);
  useEffect(() => {
    let alive = true;
    void getJarvisWorks().then((items) => {
      if (!alive) return;
      setWorks(items);
      setStatus("ready");
    }).catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="jv-works">
      <div className="jv-works__top">
        <span>PROJECTOS</span><span>{status === "ready" ? works.length : "—"}</span>
      </div>
      {status === "loading" && <div className="jv-gallery-loading" role="status" aria-label="A carregar projectos"><i /><i /><i /><i /></div>}
      {status === "error" && <div className="jv-gallery-error" role="alert">Não foi possível carregar o portfólio. <button type="button" onClick={() => { setStatus("loading"); void getJarvisWorks().then((items) => { setWorks(items); setStatus("ready"); }).catch(() => setStatus("error")); }}>Tentar novamente</button></div>}
      {status === "ready" && works.length === 0 && <p className="jv-gallery-error">Não há projectos publicados para mostrar.</p>}
      <ul className="jv-works__grid">
        {works.slice(0, count).map((work) => <HologramWork key={work.slug} work={work} onPick={onPick} />)}
      </ul>
      {status === "ready" && works.length > count &&
        <button type="button" className="jv-more" onClick={() => setCount((n) => n + 12)}>Ver mais projectos <ArrowRight size={17} /></button>}
    </div>
  );
}

export function JarvisLauncher({ whatsapp }: { whatsapp?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const convo = useConversation();
  const transcribe = useServerFn(transcribeJarvisAudio);
  const recRef = useRef<SpeechRec | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const liveRef = useRef<{stop:()=>void} | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const voiceSession = useRef(0);
  const microphone = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const meterFrame = useRef(0);
  const visualRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(meterFrame.current);
    meterFrame.current = 0;
    visualRef.current?.style.removeProperty("--jv-level");
    visualRef.current?.removeAttribute("data-live");
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    const context = audioContext.current;
    audioContext.current = null;
    if (context) void context.close().catch(() => {});
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    const Constructor = window.AudioContext;
    if (!Constructor) return;
    try {
      const context = new Constructor({ latencyHint: "interactive" });
      audioContext.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let previous = 0;
      const frame = (time: number) => {
        if (time - previous > 32) {
          previous = time;
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) {
            const value = (sample - 128) / 128;
            energy += value * value;
          }
          const rms = Math.sqrt(energy / samples.length);
          const level = Math.min(1, Math.max(0.04, rms * 7));
          if (visualRef.current) {
            visualRef.current.style.setProperty("--jv-level", level.toFixed(3));
            visualRef.current.dataset["live"] = "true";
          }
        }
        meterFrame.current = requestAnimationFrame(frame);
      };
      meterFrame.current = requestAnimationFrame(frame);
    } catch {
      // Recognition still works even if the browser refuses audio visualisation.
    }
  }, []);

  const stopVoice = useCallback(() => {
    voiceSession.current += 1;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* Recognition may already have ended. */ }
    }
    liveRef.current?.stop();
    liveRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* Already stopped. */ }
    }
    stopMeter();
    ttsAbortRef.current?.abort();
    ttsAbortRef.current=null;
    ttsAudioRef.current?.pause();
    ttsAudioRef.current=null;
    if(ttsUrlRef.current)URL.revokeObjectURL(ttsUrlRef.current);
    ttsUrlRef.current=null;
    window.speechSynthesis?.cancel();
    setVoice("idle");
    setVoiceMessage(null);
  }, [stopMeter]);

  const close = useCallback(() => {
    stopVoice();
    setChatOpen(false);
    setOpen(false);
    window.dispatchEvent(new Event(JARVIS_CLOSE_EVENT));
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  }, [stopVoice]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>(".jv-chat-button")?.focus());
  }, []);

  useEffect(() => {
    const onOpen = () => {
      returnFocus.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    window.addEventListener(JARVIS_OPEN_EVENT, onOpen);
    document.documentElement.dataset["jarvisReady"] = "true";
    return () => {
      window.removeEventListener(JARVIS_OPEN_EVENT, onOpen);
      delete document.documentElement.dataset["jarvisReady"];
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("jarvis-active");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (chatOpen) dialogRef.current?.querySelector<HTMLTextAreaElement>("#jv-input")?.focus();
    else dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (chatOpen) closeChat(); else close();
        return;
      }
      if (event.key !== "Tab") return;
      const scope = chatOpen
        ? dialogRef.current?.querySelector<HTMLElement>(".jv-chat-card")
        : dialogRef.current;
      if (!scope) return;
      const elements = Array.from(scope.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === scope)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.classList.remove("jarvis-active");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, chatOpen, close, closeChat]);

  useEffect(() => () => {
    voiceSession.current += 1;
    recRef.current?.abort();
    liveRef.current?.stop();
    liveRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMeter();
    ttsAbortRef.current?.abort();
    ttsAudioRef.current?.pause();
    if(ttsUrlRef.current)URL.revokeObjectURL(ttsUrlRef.current);
    window.speechSynthesis?.cancel();
  }, [stopMeter]);

  const speak = async (text: string, session: number) => {
    const speech=window.speechSynthesis;
    let voices=speech?.getVoices()??[];
    if(speech && !voices.length){
      await new Promise<void>(resolve=>{
        const done=()=>{speech.removeEventListener?.("voiceschanged",done);resolve();};
        speech.addEventListener?.("voiceschanged",done,{once:true});
        window.setTimeout(done,450);
      });
      voices=speech.getVoices();
    }
    if(voiceSession.current!==session)return;
    const selected=choosePortugueseMaleVoice(voices);
    if(selected && speech && typeof SpeechSynthesisUtterance!=="undefined"){
      const utterance=new SpeechSynthesisUtterance(spokenJarvisText(text));
      utterance.voice=selected;
      utterance.lang=selected.lang;
      utterance.rate=1.02;
      utterance.pitch=.91;
      utterance.onend=()=>{if(voiceSession.current===session)setVoice("idle");};
      utterance.onerror=()=>{if(voiceSession.current===session){
        setVoice("unavailable");setVoiceMessage("Não foi possível reproduzir a resposta em voz.");
      }};
      speech.cancel();
      setVoice("speaking");speech.speak(utterance);
      return;
    }
    // Male PT/MZ speech unavailable locally: use the verified Google Orus
    // audio endpoint. Preserve text-only graceful fallback on unsupported devices.
    const controller=new AbortController();
    ttsAbortRef.current=controller;
    setVoice("processing");
    try{
      const response=await fetch("/api/jarvis/tts",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:text.slice(0,650)}),signal:controller.signal,
      });
      if(!response.ok)throw Error("tts_unavailable");
      const audioBlob=await response.blob();
      if(voiceSession.current!==session||controller.signal.aborted)return;
      if(audioBlob.type!=="audio/wav"||audioBlob.size<44)throw Error("invalid_tts_audio");
      const objectUrl=URL.createObjectURL(audioBlob);
      ttsUrlRef.current=objectUrl;
      const audio=new Audio(objectUrl);
      ttsAudioRef.current=audio;
      audio.onended=()=>{
        if(ttsUrlRef.current===objectUrl){URL.revokeObjectURL(objectUrl);ttsUrlRef.current=null;}
        if(voiceSession.current===session){setVoice("idle");ttsAudioRef.current=null;}
      };
      audio.onerror=()=>{
        if(voiceSession.current===session){setVoice("unavailable");
          setVoiceMessage("Não foi possível reproduzir o áudio. Pode continuar por escrito.");}
      };
      await audio.play();
      if(voiceSession.current===session)setVoice("speaking");
    }catch{
      if(voiceSession.current===session && !controller.signal.aborted){
        setVoice("unavailable");
        setVoiceMessage(describeVoiceFallback(voices)??"Não foi possível obter voz masculina neste momento. A resposta está na conversa escrita.");
      }
    }finally {
      if(ttsAbortRef.current===controller)ttsAbortRef.current=null;
    }
  };

  const handleSpeech = async (text: string, session: number) => {
    stopMeter();
    if (voiceSession.current !== session) return;
    if (!text.trim()) { setVoice("idle"); return; }
    setVoice("processing");
    const response = await convo.send(text.trim());
    if (voiceSession.current !== session) return;
    if (response) void speak(response, session);
    else {
      setVoice("unavailable");
      setVoiceMessage("Não foi possível obter resposta. Abra a conversa escrita para tentar novamente.");
    }
  };

  const startVoice = async () => {
    if (voice === "listening") {
      if (liveRef.current) { stopVoice(); return; }
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      } else {
        recRef.current?.stop();
      }
      return;
    }
    if (voice === "speaking") { stopVoice(); return; }
    if (voice === "processing") return;

    stopVoice();
    const session = voiceSession.current;
    setVoiceMessage(null);
    setVoice("listening");
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoice("unavailable");
      setVoiceMessage("Este navegador não permite aceder ao microfone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (voiceSession.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone.current = stream;
      startMeter(stream);

      // Native Gemini Live is an opt-in transport. A 404 or provider issue falls
      // through to the proven browser speech / transcription path without losing
      // the microphone or disturbing the visual design.
      const live = import.meta.env["VITE_JARVIS_LIVE_ENABLED"] === "true"
        ? await import("@/lib/jarvis/live-browser")
        .then(({ connectJarvisLive }) => connectJarvisLive(stream, {
          onState: (next) => { if (voiceSession.current === session) setVoice(next); },
          onUserTranscript: (text) => {
            if (voiceSession.current === session) convo.remember("user", text);
          },
          onAssistantTranscript: (text) => {
            if (voiceSession.current === session) convo.remember("assistant", text);
          },
          onError: (message) => {
            if (voiceSession.current !== session) return;
            liveRef.current?.stop();
            liveRef.current = null;
            stopMeter();
            setVoice("unavailable");
            setVoiceMessage(message);
          },
        })).catch(() => null) : null;
      if (voiceSession.current !== session) {
        live?.stop(); stream.getTracks().forEach(track => track.stop()); return;
      }
      if (live) { liveRef.current = live; return; }

      const recognition = getRecognition();
      if (recognition) {
        recRef.current = recognition;
        recognition.lang = "pt-PT";
        recognition.interimResults = false;
        recognition.continuous = false;
        let transcript = "";
        let errored = false;
        recognition.onresult = (event) => {
          transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ");
        };
        recognition.onerror = (event) => {
          errored = true;
          recRef.current = null;
          stopMeter();
          if (voiceSession.current !== session) return;
          setVoice("unavailable");
          setVoiceMessage(event.error === "not-allowed" ? "Autorize o microfone nas definições do navegador." : "Reconhecimento de voz indisponível. Tente novamente.");
        };
        recognition.onend = () => {
          if (voiceSession.current !== session || errored) return;
          recRef.current = null;
          void handleSpeech(transcript, session);
        };
        try { recognition.start(); return; }
        catch { recRef.current = null; }
      }

      // MediaRecorder + server-side Gemini transcription for browsers without SpeechRecognition.
      if (typeof MediaRecorder === "undefined") throw new Error("recording-not-supported");
      const supported = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!supported) throw new Error("recording-not-supported");
      const recorder = new MediaRecorder(stream, { mimeType: supported, audioBitsPerSecond: 64000 });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes > 2_500_000 && recorder.state === "recording") recorder.stop();
        }
      };
      recorder.onstop = async () => {
        recorderRef.current = null;
        stopMeter();
        if (voiceSession.current !== session) return;
        if (bytes === 0 || bytes > 2_500_000) {
          setVoice("unavailable");
          setVoiceMessage("Gravação inválida ou demasiado longa. Tente novamente.");
          return;
        }
        setVoice("processing");
        const blob = new Blob(chunks, { type: supported });
        const mimeType = supported.split(";")[0] || "audio/webm";
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(new Error("read-failed"));
            reader.readAsDataURL(blob);
          });
          if (voiceSession.current !== session) return;
          const result = await transcribe({
            data: { base64, mimeType: mimeType as "audio/webm" | "audio/mp4" | "audio/ogg" },
          });
          if (voiceSession.current !== session) return;
          if (result.transcript) void handleSpeech(result.transcript, session);
          else {
            setVoice("unavailable");
            setVoiceMessage(result.error || "Não foi possível reconhecer a fala.");
          }
        } catch {
          if (voiceSession.current === session) {
            setVoice("unavailable");
            setVoiceMessage("A transcrição falhou. Tente novamente.");
          }
        }
      };
      recorder.start(250);
      window.setTimeout(() => {
        if (voiceSession.current === session && recorder.state === "recording") recorder.stop();
      }, 15_000);
    } catch {
      stopMeter();
      if (voiceSession.current !== session) return;
      setVoice("unavailable");
      setVoiceMessage("Não foi possível utilizar o microfone. Verifique as permissões.");
    }
  };

  if (!open) return null;
  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
      aria-label="Kutuzov, assistente de IA de Edmundo Kutuzov" className="jv-root">
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
            <p className="jv-eyebrow">ASSISTENTE DE IA DO E. KUTUZOV</p>
            <h1 id="jv-title">Estou por aqui.</h1>
            <p className="jv-description">Fala comigo. Explora o meu trabalho. Abre uma janela para cada ideia.</p>
            <JarvisVoiceVisual voice={voice} onToggle={() => { void startVoice(); }} visualRef={visualRef} />
            <div className="jv-voice-meta">
              <button type="button" className="jv-voice-caption" onClick={() => { void startVoice(); }} disabled={voice === "processing"}>FALAR COM KUTUZOV</button>
              <span className="jv-voice-state" role="status" aria-live="polite">
                <span className="jv-voice-state__dot" aria-hidden="true" />
                {voice === "unavailable" ? (voiceMessage || convo.error || VOICE_LABEL[voice]) : VOICE_LABEL[voice]}
              </span>
            </div>
            <button type="button" className="jv-chat-button" onClick={() => { stopVoice(); setChatOpen(true); }}>
              <MessageSquare size={21} strokeWidth={1.5} aria-hidden="true" />
              Abrir conversa escrita
            </button>
          </section>
        </main>
        <footer className="jv-footer">
          <span>PREFERE FALAR COM O KUTUZOV REAL?</span>
          <nav aria-label="Contactos" className="jv-footer__links">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer">WHATSAPP ↗</a>}
            <Link to="/contact" onClick={close}>ENVIAR BRIEFING →</Link>
          </nav>
        </footer>
      </div>
      {chatOpen && <ChatWindow convo={convo} onClose={closeChat} onCloseAll={close} />}
    </div>
  );
}

function ChatWindow({ convo, onClose, onCloseAll }: {
  convo: ReturnType<typeof useConversation>;
  onClose: () => void;
  onCloseAll: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [showWorks, setShowWorks] = useState(false);
  const [lead, setLead] = useState({name:"",contact:"",brief:"",deadline:"",budget:"",consent:false});
  const [leadSending,setLeadSending] = useState(false);
  const [leadReference,setLeadReference] = useState<string|null>(null);
  const [leadError,setLeadError] = useState("");

  const textarea = useRef<HTMLTextAreaElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const hasMessages = convo.messages.length > 0;
  const wantsLead = convo.messages.some(message => message.role==="user"
    && /(?:contratar|orçamento|orcamento|briefing|hire|iniciar (?:um )?projecto|quero trabalhar com)/i.test(message.content));
  const submitLead = async () => {
    if(leadSending||!lead.consent)return;
    setLeadSending(true);setLeadError("");
    try{
      const reply=await fetch("/api/jarvis/lead",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(lead),
      });
      const data=await reply.json() as {ok?:boolean;reference?:string;error?:string};
      if(!reply.ok||data.ok!==true||!data.reference)throw Error(data.error||"Sem confirmação da base de dados.");
      setLeadReference(data.reference);
    }catch(error){setLeadError(error instanceof Error?error.message:"Falha ao enviar. Tente novamente.");}
    finally{setLeadSending(false);}
  };

  useEffect(() => { textarea.current?.focus(); }, []);

  // Switching to projects must always start at the first artwork, never at the
  // bottom of the old conversation. Focus makes native keyboard scrolling work.
  useLayoutEffect(() => {
    const scrollArea = content.current;
    if (!scrollArea) return;
    if (showWorks) {
      scrollArea.scrollTop = 0;
      scrollArea.focus({ preventScroll: true });
    } else if (!hasMessages) {
      scrollArea.scrollTop = 0;
    }
  }, [showWorks, hasMessages]);

  // Only the transcript auto-follows new messages. Never move the gallery.
  useEffect(() => {
    const scrollArea = content.current;
    if (showWorks || !hasMessages || !scrollArea) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [convo.messages.length, convo.messages.at(-1)?.content, convo.pending, showWorks, hasMessages]);

  const resize = () => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 148) + "px";
  };

  const submit = async (text = draft) => {
    if (!text.trim() || convo.pending) return;
    // A direct gallery request is resolved instantly with published site artwork.
    if (/^(?:mostra(?:-me)?|mostrar|ver|explorar|show|see)\s+(?:(?:os|meus|the|some)\s+)?(?:trabalhos|projectos|projects|portfolio)(?:\s+(?:do site|de arte|criativos))?[.!?]*$/i.test(text.trim())) {
      setDraft("");
      setShowWorks(true);
      return;
    }
    setShowWorks(false);
    setDraft("");
    requestAnimationFrame(resize);
    await convo.send(text);
  };

  return (
    <div className="jv-chat-overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="jv-chat-title" className="jv-chat-card">
        <header className="jv-chat-head">
          <span aria-hidden="true" className="jv-window-lights"><i /><i /><i /></span>
          <h2 id="jv-chat-title">CONVERSA COMIGO</h2>
          <div className="jv-chat-head__actions">
            {(hasMessages || showWorks) && <button type="button" className="jv-chat-reset" onClick={() => { convo.reset(); setShowWorks(false); }}
              aria-label="Nova conversa" title="Nova conversa"><Plus size={20} /></button>}
            <button type="button" onClick={onClose} aria-label="Fechar conversa" className="jv-chat-close"><X size={23} strokeWidth={1.7} /></button>
          </div>
        </header>

        <div
          ref={content}
          className={"jv-chat-content" + (showWorks ? " jv-chat-content--gallery" : "")}
          tabIndex={showWorks ? 0 : undefined}
          role={showWorks ? "region" : undefined}
          aria-label={showWorks ? "Galeria de projectos" : undefined}
          data-lenis-prevent={showWorks ? "" : undefined}
        >
          {showWorks ? (
            <WorksPanel onPick={onCloseAll} />
          ) : !hasMessages ? (
            <div className="jv-chat-welcome">
              <p className="jv-chat-available"><span /> DISPONÍVEL</p>
              <h3>Olá. Sou o JARVIS.</h3>
              <p className="jv-chat-intro">Sou a versão IA do Kutuzov. Pergunta-me sobre o meu trabalho, as marcas com que colaborei ou como podemos criar juntos.</p>
              <div className="jv-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion.id} type="button" disabled={convo.pending}
                    onClick={() => suggestion.prompt ? void submit(suggestion.prompt) : setShowWorks(true)}>
                    <span>{suggestion.label}</span><ArrowRight size={22} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="jv-chat-messages" aria-live="polite" aria-relevant="additions">
              {convo.messages.map((message, index) => (
                <li key={index} className={"jv-chat-message jv-chat-message--" + message.role}>
                  {message.role === "assistant" && <span className="jv-chat-avatar"><EKMark className="jv-chat-avatar__logo" /></span>}
                  <p>{message.content}</p>
                </li>
              ))}
              {convo.pending && <li className="jv-chat-message jv-chat-message--assistant">
                <span className="jv-chat-avatar"><EKMark className="jv-chat-avatar__logo" /></span>
                <span className="jv-chat-typing" aria-label="A responder…" role="status"><i /><i /><i /></span>
              </li>}
            </ol>
          )}
          {convo.error && !showWorks && <p className="jv-chat-error" role="alert">{convo.error}</p>}
          {wantsLead && !showWorks && (
            <section className="jv-lead" aria-label="Pedir projecto com consentimento">
              {leadReference ? (
                <p className="jv-lead__success" role="status">Pedido recebido e confirmado. Referência: {leadReference.slice(0,8).toUpperCase()}.</p>
              ) : (
                <form className="jv-lead__form" onSubmit={event=>{event.preventDefault();void submitLead();}}>
                  <p className="jv-lead__eyebrow">NOVO PROJECTO</p>
                  <h3>Tem uma ideia? Vamos dar-lhe forma.</h3>
                  <p className="jv-lead__intro">Deixe os dados do briefing. O envio só acontece após a sua autorização.</p>
                  <div className="jv-lead__grid">
                    <label>Nome<input required minLength={2} maxLength={120} value={lead.name}
                      onChange={event=>setLead(value=>({...value,name:event.target.value}))}
                      placeholder="Como devemos tratar?" /></label>
                    <label>Email ou WhatsApp<input required minLength={5} maxLength={160} value={lead.contact}
                      onChange={event=>setLead(value=>({...value,contact:event.target.value}))}
                      placeholder="Contacto para resposta" /></label>
                    <label>Prazo (opcional)<input maxLength={100} value={lead.deadline}
                      onChange={event=>setLead(value=>({...value,deadline:event.target.value}))}
                      placeholder="Quando pretende iniciar?" /></label>
                    <label>Orçamento (opcional)<input maxLength={100} value={lead.budget}
                      onChange={event=>setLead(value=>({...value,budget:event.target.value}))}
                      placeholder="Intervalo estimado" /></label>
                  </div>
                  <label className="jv-lead__brief">Resumo do projecto<textarea required minLength={10} maxLength={2000}
                    value={lead.brief} onChange={event=>setLead(value=>({...value,brief:event.target.value}))}
                    placeholder="O que pretende criar?" rows={3}/></label>
                  <label className="jv-lead__consent">
                    <input type="checkbox" checked={lead.consent}
                      onChange={event=>setLead(value=>({...value,consent:event.target.checked}))} required/>
                    <span>Autorizo a guardar estes dados para contacto profissional sobre este projecto.</span>
                  </label>
                  <button className="jv-lead__submit" type="submit" disabled={leadSending||!lead.consent}>
                    {leadSending?"A enviar…":"Enviar briefing"} <ArrowRight size={16} aria-hidden="true"/>
                  </button>
                  {leadError && <p className="jv-lead__error" role="alert">{leadError}</p>}
                </form>
              )}
            </section>
          )}
        </div>

        <form className="jv-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="jv-chat-composer__stack">
          <div className="jv-chat-input-wrap">
            <label htmlFor="jv-input" className="sr-only">Mensagem para Kutuzov</label>
            <textarea id="jv-input" ref={textarea} rows={1} maxLength={2000} value={draft}
              onChange={(event) => { setDraft(event.target.value); resize(); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault(); void submit();
                }
              }}
              placeholder="Escreva-me uma mensagem…" />
            <button type="submit" className="jv-chat-send" aria-label="Enviar mensagem"
              disabled={!draft.trim() || convo.pending}>
              {convo.pending ? <span className="jv-chat-spinner" /> : <Send size={22} strokeWidth={1.8} />}
            </button>
          </div>
          </div>
        </form>
      </section>
    </div>
  );
}
