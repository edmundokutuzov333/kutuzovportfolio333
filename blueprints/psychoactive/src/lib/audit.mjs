export const initialAuditState = { status: "idle", url: "", error: "", result: null, stage: 0 };
export function normalizePublicUrl(input) {
  const value = input.trim();
  if (!value) throw new Error("Introduza o endereço do site.");
  if (value.length > 2048 || /\s/.test(value)) throw new Error("O endereço contém espaços ou é demasiado longo.");
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : "https://" + value); }
  catch { throw new Error("Introduza um endereço válido, por exemplo exemplo.pt."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Use um endereço HTTP ou HTTPS sem credenciais.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") ||
      host.endsWith(".internal") || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":") ||
      url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Use um domínio público sem uma porta personalizada.");
  }
  url.hash = "";
  return url.href;
}
export function auditReducer(state, event) {
  switch (event.type) {
    case "RESET": return { ...initialAuditState };
    case "VALIDATE": return { ...initialAuditState, status: "validating" };
    case "INVALID": return { ...state, status: "invalid", error: event.error };
    case "START": return { ...initialAuditState, status: "loading", url: event.url };
    case "STAGE": return state.status === "loading" ? { ...state, stage: event.stage } : state;
    case "SUCCESS": return state.status === "loading" ? { ...state, status: "success", result: event.result } : state;
    case "FAIL": return state.status === "loading" ? { ...state, status: event.timeout ? "timeout" : "error", error: event.error } : state;
    default: return state;
  }
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const cancel = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function mockAudit(url, { signal, onStage = () => {}, scenario = "success", delayMs = 600 }) {
  for (let stage = 0; stage < 3; stage++) { onStage(stage); await delay(delayMs, signal); }
  if (scenario === "timeout") throw new DOMException("O serviço excedeu o tempo de espera.", "TimeoutError");
  if (scenario === "error") throw new Error("O serviço está temporariamente indisponível.");
  const response = mockAuditResponse(url);
  return toAuditView(response);
}
export function mockAuditResponse(url) {
  const keys = ["value_proposition", "conversion_architecture", "content_craft", "structural_hierarchy", "credibility_trust"];
  const scores = [9, 8, 7, 10, 8];
  return {
    auditId: "mock-v1", url, cached: false, cachedAgeMs: 0, heroImageUrl: null, pageTitle: "Demonstração",
    report: {
      summary: "Relatório simulado para demonstrar a interface.", overall_score: 42,
      page_title: "Demonstração", hero_image_url: null,
      categories: Object.fromEntries(keys.map((key,index)=>[key,{
        score:scores[index],
        findings:[{text:"Observação de exemplo, sem analisar o endereço.",type:"issue",quote:null}],
        next_action:"Defina uma melhoria concreta e volte a medir.",
      }])),
    },
  };
}
export function toAuditView(response) {
  const mapping = [
    ["clarity","value_proposition"],["conversion","conversion_architecture"],
    ["copy","content_craft"],["structure","structural_hierarchy"],["trust","credibility_trust"],
  ];
  return {
    id: response.auditId, url: response.url, score: response.report.overall_score, maxScore: 100, mock: true,
    categories: mapping.map(([key,source])=>({key,score:response.report.categories[source].score})),
    counts: {wins:0,issues:5,opportunities:0},
  };
}
