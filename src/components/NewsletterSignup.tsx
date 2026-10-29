import { useState, type FormEvent } from "react";
import { requestNewsletterSubscription } from "@/lib/public-forms";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !consent) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await requestNewsletterSubscription(email, consent);
      if (!result.ok) throw new Error("A subscrição não foi confirmada.");
      if (result.status === "already_confirmed") {
        setMessage({ tone: "success", text: "Este endereço já tem uma subscrição confirmada." });
      } else if (result.status === "pending_confirmation") {
        setMessage({ tone: "success", text: "Pedido registado. A subscrição só fica activa depois de confirmar o email." });
        setEmail("");
      } else if (result.status === "email_provider_not_configured" || result.status === "email_delivery_failed") {
        setMessage({ tone: "info", text: "O pedido ficou pendente, mas o email de confirmação não foi enviado. A subscrição não está activa; tente novamente mais tarde." });
      } else {
        setMessage({ tone: "info", text: "Pedido recebido pelo sistema. Verifique o estado indicado antes de considerar a subscrição activa." });
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
        Receba novidades de projectos e disponibilidade. O endereço só fica activo depois da confirmação por email.
      </p>
      <form onSubmit={submit} className="space-y-4">
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
          <span>Consinto receber comunicações por email e compreendo que posso cancelar a subscrição. O pedido fica pendente até confirmação.</span>
        </label>
        <button type="submit" disabled={pending || !consent || !email.trim()} className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "A registar..." : "Pedir subscrição"}
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
