import { useEffect, useState, type FormEvent } from "react";
import { requestNewsletterSubscription } from "@/lib/public-forms";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !consent) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await requestNewsletterSubscription(email, consent);
      if (!result.ok) throw new Error("A subscrição não foi confirmada.");
      if (result.status === "already_confirmed") {
        setMessage({ tone: "success", text: "Este endereço já está na lista. Não foi criada uma subscrição duplicada." });
        setEmail("");
      } else if (result.status === "subscribed") {
        setMessage({ tone: "success", text: "Está na lista. Enviámos um email de boas-vindas com os detalhes da subscrição." });
        setEmail("");
      } else if (result.status === "email_delivery_failed") {
        setMessage({ tone: "info", text: "A subscrição já está activa, mas não conseguimos entregar o email de boas-vindas. Não precisa de se inscrever novamente." });
        setEmail("");
      } else {
        setMessage({ tone: "info", text: "O pedido foi registado. Estado da entrega: " + String(result.status ?? "a verificar") + "." });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível registar o pedido. Tente novamente." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl">
      <p className="mb-4 max-w-xl text-sm leading-6 text-muted-foreground">
        Receba uma selecção ocasional de projectos, ideias e disponibilidade. A inscrição fica activa no momento do pedido. Pode cancelar quando quiser.
      </p>
      <form onSubmit={submit} data-client-ready={clientReady ? "true" : "false"} className="space-y-4">
        <label className="block">
          <span className="sr-only">Email para newsletter</span>
          <input
            type="email"
            name="newsletter-email"
            autoComplete="email"
            maxLength={320}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="O seu email"
            className="w-full border-b border-foreground/30 bg-transparent py-3 text-sm outline-none transition focus:border-primary placeholder:text-muted-foreground/60"
          />
        </label>
        <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
          <span>Consinto receber actualizações ocasionais por email e compreendo que posso cancelar a subscrição a qualquer momento.</span>
        </label>
        <button type="submit" disabled={pending || !consent || !email.trim()} className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "A registar..." : "Entrar na lista"}
        </button>
      </form>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 text-xs leading-5 ${message.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
