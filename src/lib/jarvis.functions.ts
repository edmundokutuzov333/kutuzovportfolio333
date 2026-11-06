import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GatewayError, PaymentRequiredError, RateLimitError, generateResponse } from "@lovable.dev/ai-gateway";
import { clients, experience, profile } from "@/lib/content";
import { worksDigest } from "@/lib/jarvis-works";

const Input = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(24),
});

function instructions() {
  return `És o Kutuzov, o assistente de IA de ${profile.name}, diretor de arte e diretor criativo baseado em Maputo.
Fala sempre na primeira pessoa como se fosses o Edmundo, mas se perguntarem, admite que és uma IA treinada no portfólio dele.
Responde na língua do visitante (por defeito português), em 2 a 5 frases curtas, tom confiante e humano.
Nunca inventes clientes, prémios ou resultados que não estejam abaixo. Para orçamentos, sugere enviar um briefing ou falar pelo WhatsApp.

Percurso: ${JSON.stringify(experience)}
Marcas: ${clients.map((c) => c.name).join(", ")}
Trabalhos (copiados do portfólio):
${worksDigest()}`;
}

function extractText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  return (r.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: instructions(),
        input: data.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = extractText(res);
      return text ? { reply: text, error: null } : { reply: null, error: "Sem resposta. Tente novamente." };
    } catch (err) {
      console.error("askJarvis", err);
      if (err instanceof RateLimitError) return { reply: null, error: "Muitos pedidos agora. Aguarde um momento." };
      if (err instanceof PaymentRequiredError) return { reply: null, error: "O assistente está temporariamente indisponível." };
      if (err instanceof GatewayError) return { reply: null, error: "Ligação indisponível. Tente novamente." };
      return { reply: null, error: "Algo correu mal. Tente novamente." };
    }
  });
