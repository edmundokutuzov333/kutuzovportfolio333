import { SUPABASE_API_KEY, SUPABASE_URL } from "@/lib/cms/public-client";

type PublicFormResponse =
  | { ok: true; submissionId?: string; attachmentCount?: number; notification?: string; receipt?: string; status?: string }
  | { ok: false; error?: string; status?: string };

async function requestPublicForm(action: string, body: FormData | Record<string, unknown>): Promise<PublicFormResponse> {
  const headers = new Headers({ apikey: SUPABASE_API_KEY, Authorization: "Bearer " + SUPABASE_API_KEY });
  let requestBody: BodyInit;
  if (body instanceof FormData) {
    requestBody = body;
  } else {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(SUPABASE_URL + "/functions/v1/public-forms?action=" + encodeURIComponent(action), {
      method: "POST", headers, body: requestBody, cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível contactar o serviço de formulários. Verifique a ligação e tente novamente.");
  }
  const result = await response.json().catch(() => null) as PublicFormResponse | null;
  if (!result || typeof result !== "object") {
    throw new Error("O serviço não devolveu uma confirmação válida. Os dados não são apresentados como enviados.");
  }
  if (!response.ok || result.ok !== true) {
    const code = "error" in result && typeof result.error === "string" ? result.error : result.status;
    const messages: Record<string, string> = {
      rate_limited: "Foram recebidos demasiados pedidos desta ligação. Aguarde antes de tentar novamente.",
      invalid_email: "Introduza um endereço de email válido.",
      invalid_project_type: "O tipo de projecto deixou de estar disponível. Actualize a página e tente novamente.",
      invalid_message: "A mensagem deve ter entre 10 e 4.000 caracteres.",
      file_size_limit: "Cada ficheiro pode ter até 8 MB e o conjunto não pode exceder 40 MB.",
      too_many_files: "Pode anexar no máximo cinco imagens.",
      unsupported_image_type: "Os anexos devem ser imagens PNG, JPG ou WEBP válidas.",
      invalid_image_content_or_dimensions: "Uma das imagens está danificada ou excede as dimensões permitidas.",
      invalid_links: "Verifique os links. São permitidos apenas URLs HTTP ou HTTPS válidos.",
      invalid_or_unsupported_file: "Cada anexo deve ser uma imagem PNG, JPG, WEBP ou um PDF válido.",
      invalid_project_stage: "Escolha uma fase de projecto válida.",
      invalid_industry: "Escolha uma indústria válida.",
      invalid_deliverables: "Reveja os entregáveis seleccionados.",
      duplicate_project_service: "O serviço principal não deve repetir-se nos serviços adicionais.",
      already_unsubscribed: "Este endereço foi cancelado anteriormente. Não foi reactivado automaticamente.",
      public_site_url_not_configured: "A confirmação por email ainda não está configurada. A subscrição não foi activada.",
      submission_unavailable: "Não foi possível confirmar a gravação. Os dados não foram apresentados como enviados.",
      service_unavailable: "O serviço está temporariamente indisponível. Tente novamente.",
      invalid_or_expired: "O link é inválido, expirou ou já foi utilizado.",
    };
    throw new Error(messages[code ?? ""] ?? "O pedido foi rejeitado pelo serviço. Reveja os dados e tente novamente.");
  }
  return result;
}

export function submitContactForm(body: FormData) {
  return requestPublicForm("contact", body);
}

export function requestNewsletterSubscription(email: string, consent: boolean) {
  return requestPublicForm("subscribe", { email, consent });
}

export function consumeNewsletterToken(action: "confirm" | "unsubscribe", token: string) {
  return requestPublicForm("token", { action, token });
}
