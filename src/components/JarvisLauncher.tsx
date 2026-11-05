import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const JARVIS_URL = "https://kutuzov-jarvis.vercel.app";
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

export function JarvisLauncher({ whatsapp }: { whatsapp?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onOpen = () => { setLoaded(false); setOpen(true); };
    window.addEventListener(JARVIS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(JARVIS_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-background/85 backdrop-blur-md md:items-center md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="JARVIS, assistente de IA de Edmundo Kutuzov"
      onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
    >
      <div className="relative flex h-[92svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-primary/30 bg-card shadow-2xl md:h-[min(88svh,860px)] md:rounded-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-primary blur-[4px]" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground">JARVIS // AI Twin</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Assistente de IA treinado sobre o trabalho de Edmundo</p>
            </div>
          </div>
          <button type="button" aria-label="Fechar JARVIS" onClick={() => setOpen(false)} className="liquid-glass-button rounded-full px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground">
            Esc · Fechar
          </button>
        </div>

        <div className="relative flex-1">
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <span className="h-10 w-10 animate-pulse rounded-full bg-primary/40 blur-md" />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">A estabelecer ligação…</p>
            </div>
          )}
          <iframe
            title="JARVIS — assistente de IA de Edmundo Kutuzov"
            src={JARVIS_URL}
            allow="microphone; autoplay"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full border-0 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:px-6">
          <span>Prefere falar com o Edmundo real?</span>
          <div className="flex gap-4">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary">WhatsApp ↗</a>}
            <Link to="/contact" onClick={() => setOpen(false)} className="text-foreground hover:text-primary">Enviar briefing →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
