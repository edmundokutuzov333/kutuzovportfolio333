import { useEffect, useState } from "react";

const JARVIS_URL = "https://kutuzov-jarvis.vercel.app";

export function JarvisLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir JARVIS"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="liquid-glass-button fixed bottom-5 right-5 z-[55] flex items-center gap-3 rounded-full px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-bone shadow-2xl md:bottom-8 md:right-8"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
        </span>
        Falar com Edmundo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-3 backdrop-blur-md md:items-center md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="JARVIS, assistente pessoal de Edmundo Kutuzov"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="relative h-[min(88svh,860px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-bone/20 bg-[#061225] shadow-2xl">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-bone/10 bg-[#07172e]/90 px-4 py-3 backdrop-blur-xl">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ember">Edmundo Kutuzov / JARVIS</p>
                <p className="mt-1 text-xs text-bone/60">Conversa visual e voz em tempo real</p>
              </div>
              <button type="button" aria-label="Fechar JARVIS" onClick={() => setOpen(false)} className="liquid-glass-button rounded-full px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-bone">Fechar</button>
            </div>
            <iframe
              title="JARVIS — assistente pessoal de Edmundo Kutuzov"
              src={JARVIS_URL}
              allow="microphone; autoplay"
              className="h-full w-full border-0 pt-16"
            />
          </div>
        </div>
      )}
    </>
  );
}
