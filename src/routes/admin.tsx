import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { useEffect, useState, type FormEvent } from "react";

import {
  getAdminSessionFn,
  loginAdminFn,
  logoutAdminFn,
} from "@/lib/admin-auth.functions";

type AdminSession = { id: string; email: string };
type StatusMessage = { tone: "error" | "info"; text: string } | null;

export const Route = createFileRoute("/admin")({
  component: AdminEntryPage,
});

function AdminEntryPage() {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  useEffect(() => {
    let active = true;
    void getAdminSessionFn()
      .then((result) => {
        if (active) setSession(result);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const result = await loginAdminFn({ data: { pin } });
      if (!result.ok) {
        setStatus({
          tone: "error",
          text:
            result.error === "rate_limited"
              ? "Demasiadas tentativas. Aguarde antes de tentar novamente."
              : result.error === "unavailable"
                ? "O serviço de autenticação não está configurado ou está temporariamente indisponível."
                : "Não foi possível validar o acesso. Verifique os dados e tente novamente.",
        });
        return;
      }
      const currentSession = await getAdminSessionFn();
      if (!currentSession) {
        setStatus({
          tone: "error",
          text: "A sessão administrativa não pôde ser confirmada. Verifique a configuração de identidade autorizada.",
        });
        return;
      }
      setSession(currentSession);
      setPin("");
      setStatus(null);
    } catch {
      setStatus({
        tone: "error",
        text: "Não foi possível concluir o acesso. Tente novamente mais tarde.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    setSubmitting(true);
    try {
      await logoutAdminFn();
      setSession(null);
      setPin("");
      setStatus({ tone: "info", text: "Sessão terminada." });
    } catch {
      setStatus({ tone: "error", text: "Não foi possível terminar a sessão neste momento." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!checkingSession && session) {
    return <AdminWorkspace email={session.email} onLogout={() => void logout()} />;
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-12 text-[#f4f2ee] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col justify-between">
        <header className="flex items-center justify-between border-b border-white/15 pb-5">
          <a href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-white/65">
            Kutuzov / Admin
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            Protected workspace
          </span>
        </header>

        <section className="grid gap-12 py-16 md:grid-cols-[1fr_420px] md:items-center">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#d7ff64]">
              Portfolio control
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
              Acesso administrativo.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/60">
              Área privada para gerir o portfólio. A entrada é validada no servidor com um código de três dígitos.
            </p>
          </div>

          <div className="border border-white/15 bg-white/[0.03] p-6 sm:p-8">
            {checkingSession ? (
              <p className="text-sm text-white/65" role="status">A verificar sessão segura...</p>
            ) : (
              <form onSubmit={submitLogin} className="space-y-5">
                <div>
                  <label htmlFor="admin-pin" className="mb-2 block text-xs text-white/70">
                    Código de acesso
                  </label>
                  <input
                    id="admin-pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{3}"
                    minLength={3}
                    maxLength={3}
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 3))}
                    required
                    aria-describedby="admin-pin-help"
                    className="w-full border border-white/20 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#d7ff64]"
                  />
                  <p id="admin-pin-help" className="mt-2 text-xs text-white/40">
                    O código é validado no servidor e não é persistido no browser.
                  </p>
                </div>
                {status && (
                  <p
                    role={status.tone === "error" ? "alert" : "status"}
                    className={status.tone === "error" ? "text-sm text-red-300" : "text-sm text-white/65"}
                  >
                    {status.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting || pin.length !== 3}
                  className="w-full bg-[#d7ff64] px-4 py-3 text-sm font-semibold text-[#11130a] transition hover:bg-[#e4ff9b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "A validar..." : "Entrar no Admin"}
                </button>
                <p className="text-xs leading-5 text-white/40">
                  Sessão assinada no servidor, expiração automática e limitação persistente de tentativas.
                </p>
              </form>
            )}
            {!checkingSession && !session && status === null && (
              <p className="mt-4 text-xs leading-5 text-white/35">
                As credenciais nunca são registadas em logs. As tentativas são limitadas no servidor.
              </p>
            )}
            {status && !session && (
              <p className="mt-3 text-xs leading-5 text-white/35">
                Por segurança, o sistema não revela o motivo exacto de uma tentativa rejeitada.
              </p>
            )}
          </div>
        </section>

        <footer className="border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
          Kutuzov Admin · Fase 1 · Secure foundation
        </footer>
      </div>
    </main>
  );
}
