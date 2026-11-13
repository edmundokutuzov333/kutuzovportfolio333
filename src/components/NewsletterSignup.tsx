import { useEffect, useState, type FormEvent } from "react";
import { requestNewsletterSubscription } from "@/lib/public-forms";
import { useI18n } from "@/lib/i18n";

type NoticeKey = "duplicate" | "subscribed" | "delivery" | "queued" | "failed";
type Notice = { tone: "success" | "error" | "info"; key: NoticeKey; status?: string };

const copy = {
  en: {
    description: "Receive occasional updates on selected work, ideas and availability. Your subscription is active once submitted. Unsubscribe whenever you like.",
    emailLabel: "Newsletter email",
    emailPlaceholder: "Your email",
    consent: "I agree to receive occasional updates by email and understand I can unsubscribe at any time.",
    sending: "Joining…",
    submit: "Join the list",
    duplicate: "This address is already on the list. No duplicate subscription was created.",
    subscribed: "You're subscribed. We've sent an email confirming that you're on the list.",
    delivery: "Your subscription is active, but we couldn't deliver the confirmation email. There's no need to subscribe again.",
    queued: "Your request was recorded. Delivery status: ",
    failed: "We couldn't complete your subscription. Please try again.",
    unknown: "pending confirmation",
  },
  "pt-PT": {
    description: "Receba uma selecção ocasional de projectos, ideias e disponibilidade. A inscrição fica activa no momento do pedido. Pode cancelar quando quiser.",
    emailLabel: "Email para newsletter",
    emailPlaceholder: "O seu email",
    consent: "Consinto receber actualizações ocasionais por email e compreendo que posso cancelar a subscrição a qualquer momento.",
    sending: "A registar...",
    submit: "Entrar na lista",
    duplicate: "Este endereço já faz parte da lista. Não criámos uma inscrição duplicada.",
    subscribed: "Inscrição concluída. Enviámos um email a confirmar que já está na lista.",
    delivery: "A inscrição está activa, mas não conseguimos entregar o email de confirmação. Não precisa de se inscrever novamente.",
    queued: "O pedido foi registado. Estado da entrega: ",
    failed: "Não foi possível registar o pedido. Tente novamente.",
    unknown: "a verificar",
  },
} as const;

export function NewsletterSignup() {
  const { language } = useI18n();
  const t = copy[language];
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => { setClientReady(true); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !consent) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await requestNewsletterSubscription(email, consent);
      if (!result.ok) throw new Error("newsletter_not_confirmed");
      if (result.status === "already_confirmed") {
        setMessage({ tone: "success", key: "duplicate" });
        setEmail("");
      } else if (result.status === "subscribed") {
        setMessage({ tone: "success", key: "subscribed" });
        setEmail("");
      } else if (result.status === "email_delivery_failed") {
        setMessage({ tone: "info", key: "delivery" });
        setEmail("");
      } else {
        setMessage({ tone: "info", key: "queued", status: String(result.status ?? t.unknown) });
      }
    } catch {
      setMessage({ tone: "error", key: "failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0 max-w-xl">
      <p className="mb-4 max-w-xl text-sm leading-6 text-muted-foreground">{t.description}</p>
      <form onSubmit={submit} data-client-ready={clientReady ? "true" : "false"} className="space-y-4">
        <label className="block min-w-0">
          <span className="sr-only">{t.emailLabel}</span>
          <input
            type="email"
            name="newsletter-email"
            autoComplete="email"
            maxLength={320}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.emailPlaceholder}
            className="w-full min-w-0 border-b border-foreground/30 bg-transparent py-3 text-sm outline-none transition focus:border-primary placeholder:text-muted-foreground/60"
          />
        </label>
        <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
          <span>{t.consent}</span>
        </label>
        <button type="submit" disabled={pending || !consent || !email.trim()} className="liquid-glass-button rounded-full px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed">
          {pending ? t.sending : t.submit}
        </button>
      </form>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 text-xs leading-5 ${message.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {t[message.key]}{message.key === "queued" ? (message.status ?? t.unknown) + "." : ""}
        </p>
      )}
    </div>
  );
}
