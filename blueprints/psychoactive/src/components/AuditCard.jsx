import { useEffect, useReducer, useRef, useState } from "react";
import { auditReducer, initialAuditState, mockAudit, normalizePublicUrl } from "../lib/audit.mjs";
import { copy } from "../lib/content";
export function AuditCard({ full = false }) {
  const [state, dispatch] = useReducer(auditReducer, initialAuditState);
  const [input, setInput] = useState("");
  const [scenario, setScenario] = useState("success");
  const [unlocked, setUnlocked] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const current = useRef(null);
  const sequence = useRef(0);
  const resultHeading = useRef(null);
  const busy = ["validating", "loading"].includes(state.status);
  useEffect(() => () => { current.current?.abort(); sequence.current++; }, []);
  useEffect(() => {
    if (state.status === "success") resultHeading.current?.focus();
  }, [state.status]);
  function reset() {
    current.current?.abort(); sequence.current++;
    setUnlocked(false); setShareStatus(""); dispatch({ type: "RESET" });
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    current.current?.abort();
    const request = ++sequence.current;
    dispatch({ type: "VALIDATE" }); setUnlocked(false); setShareStatus("");
    let url;
    try { url = normalizePublicUrl(input); }
    catch (error) { dispatch({ type: "INVALID", error: error.message }); return; }
    const controller = new AbortController();
    current.current = controller;
    dispatch({ type: "START", url });
    try {
      const result = await mockAudit(url, {
        signal: controller.signal, scenario,
        onStage: stage => dispatch({ type: "STAGE", stage }),
      });
      if (request === sequence.current) dispatch({ type: "SUCCESS", result });
    } catch (error) {
      if (request !== sequence.current || error.name === "AbortError") return;
      dispatch({ type: "FAIL", error: error.message, timeout: error.name === "TimeoutError" });
    }
  }
  async function share() {
    const url = new URL(window.location.href);
    url.hash = "/design-audit?url=" + encodeURIComponent(state.url);
    try { await navigator.clipboard.writeText(url.href); setShareStatus("Ligação copiada."); }
    catch { setShareStatus("Não foi possível copiar automaticamente. Copie o endereço da barra do navegador."); }
  }
  return (
    <section className={"audit section " + (full ? "audit-full" : "")} aria-labelledby="audit-heading" data-state={state.status}>
      <div>
        <p className="eyebrow">Auditoria de design com IA · simulação</p>
        <h2 id="audit-heading">{copy.audit.title}</h2>
        <p className="muted">{copy.audit.intro}</p>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <label htmlFor="replica-url">{copy.audit.label}</label>
          <div className="input-row">
            <input id="replica-url" type="text" inputMode="url" autoComplete="url" value={input}
              onChange={event => setInput(event.target.value)} placeholder="exemplo.pt"
              disabled={busy} aria-invalid={state.status === "invalid"} aria-describedby="audit-feedback" />
            <button className="pill primary" disabled={busy}>{busy ? "A analisar…" : copy.audit.run} <span aria-hidden>↗</span></button>
          </div>
        </form>
        <label className="demo-scenario">Cenário da demonstração
          <select value={scenario} disabled={busy} onChange={event => setScenario(event.target.value)}>
            <option value="success">Sucesso</option><option value="error">Falha de rede</option><option value="timeout">Tempo excedido</option>
          </select>
        </label>
        <p id="audit-feedback" role={state.error ? "alert" : "status"}>{state.error || shareStatus}</p>
        {busy && <ol className="audit-steps" aria-live="polite">{copy.audit.steps.map((label,index)=>
          <li key={label} aria-current={index===state.stage ? "step" : undefined} className={index<=state.stage ? "active" : ""}>{label}</li>)}</ol>}
        {state.status !== "idle" && <button className="text-button" onClick={reset}>{busy ? "Cancelar" : copy.audit.reset}</button>}
      </div>
      <div className="audit-preview" aria-live="polite">
        <h3 className="eyebrow" ref={resultHeading} tabIndex={-1}>{state.status === "success" ? "Resultado simulado" : "Pré-visualização ilustrativa"}</h3>
        <div className={"score " + (busy ? "processing" : "")}><strong>{state.result?.score ?? 42}</strong><span>/100</span></div>
        <ul className="ratings">{copy.audit.categories.map((label,index)=>
          <li key={label}><span>{label}</span><meter min="0" max="20" value={state.result?.categories[index].score ?? [9,8,7,10,8][index]} />
            <span>{state.result?.categories[index].score ?? [9,8,7,10,8][index]}/20</span></li>)}</ul>
        {state.status === "success" && <>
          <p className="muted">2 pontos fortes · 6 problemas · 3 oportunidades. Valores fictícios.</p>
          <button className="pill" onClick={share}>Copiar ligação</button>
          {!unlocked ? <form className="unlock" onSubmit={event => { event.preventDefault(); setUnlocked(true); }}>
            <h3>Ver o relatório de exemplo</h3>
            <p>Simulação local: o endereço não é enviado nem guardado.</p>
            <label>Email<input type="email" required autoComplete="off" /></label>
            <label>Nome<input type="text" autoComplete="off" /></label>
            <label>Empresa<input type="text" autoComplete="off" /></label>
            <button className="pill">Mostrar exemplo completo</button>
          </form> : <div className="findings">{copy.audit.categories.map((label,index)=>
            <details key={label}><summary>{label}</summary><p>{copy.audit.details[index]}</p><p className="muted">Exemplo editorial, sem análise do URL introduzido.</p></details>)}</div>}
        </>}
      </div>
    </section>
  );
}
