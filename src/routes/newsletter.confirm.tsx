import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { consumeNewsletterToken } from "@/lib/public-forms";

export const Route = createFileRoute("/newsletter/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }, { title: "Confirm newsletter subscription" }] }),
  component: NewsletterConfirm,
});

function NewsletterConfirm() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<{ tone: "loading" | "success" | "error"; text: string }>({
    tone: "loading", text: "A validar a confirmação...",
  });

  useEffect(() => {
    let active = true;
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setState({ tone: "error", text: "Este link é inválido ou está incompleto." });
      return () => { active = false; };
    }
    void consumeNewsletterToken("confirm", token)
      .then((result) => {
        if (!active) return;
        setState(result.ok
          ? { tone: "success", text: result.status === "already_confirmed" ? "A subscrição já estava confirmada." : "Email confirmado. A subscrição está activa." }
          : { tone: "error", text: "O link expirou, já foi utilizado ou a subscrição foi cancelada." });
      })
      .catch((error: unknown) => {
        if (active) setState({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível confirmar a subscrição." });
      });
    return () => { active = false; };
  }, [token]);

  return <main className="min-h-[60vh] px-6 py-32 md:px-12"><div className="mx-auto max-w-2xl"><p className="eyebrow">Newsletter</p><h1 className="mt-5 font-display text-4xl font-bold">{state.tone === "loading" ? "A confirmar..." : state.tone === "success" ? "Confirmação concluída" : "Não foi possível confirmar"}</h1><p role={state.tone === "error" ? "alert" : "status"} className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{state.text}</p><a href="/" className="mt-8 inline-flex rounded-full border border-border px-5 py-3 text-xs uppercase tracking-widest hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Voltar ao portfólio</a></div></main>;
}
