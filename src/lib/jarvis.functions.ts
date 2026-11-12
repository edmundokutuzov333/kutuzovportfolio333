import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { clients, experience, profile } from "@/lib/content";
import { worksDigest } from "@/lib/jarvis-works";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
const Input = z.object({
  messages: z.array(MessageSchema).min(1).max(24),
});
const AudioInput = z.object({
  base64: z.string().min(100).max(4_100_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.enum(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"]),
});

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};
type GeminiResult = { reply: string | null; error: string | null };

const ALLOWED_MODELS = new Set([
  "gemini-3.5-flash-lite", "gemini-3.5-flash",
  "gemini-2.5-flash-lite", "gemini-2.5-flash",
]);

function instructions(): string {
  return [
    "És o Kutuzov, assistente virtual de " + profile.name + ", Director de Arte em Maputo.",
    "Responde sempre na língua do visitante, em português de Moçambique por defeito.",
    "Fala na primeira pessoa como o Edmundo, mas esclarece que és uma IA quando perguntarem.",
    "Frases curtas, humanas e úteis, sem promessas inventadas.",
    "Nunca inventes clientes, prémios ou resultados; para orçamentos convida a enviar um briefing.",
    "Percurso: " + experience.map((e) => [e.company, e.role, e.period].join(" | ")).join("; "),
    "Marcas: " + clients.map((c) => c.name).join(", "),
    "Trabalhos conhecidos do portfólio (o visitante pode abrir a galeria visual para ver imagens):",
    worksDigest(80),
  ].join("\n");
}

function classifyApiFailure(status: number): string {
  if (status === 401 || status === 403) return "A chave da IA precisa de verificação na configuração do servidor.";
  if (status === 429) return "O serviço de IA atingiu o limite de pedidos. Tente novamente dentro de instantes.";
  if (status >= 500) return "O serviço de IA está temporariamente indisponível. Tente novamente.";
  return "Não foi possível obter a resposta da IA. Tente novamente.";
}

async function requestGemini(
  payload: Record<string, unknown>,
  timeoutMs = 12_000,
): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.error("JARVIS_CONFIG_MISSING_GEMINI_KEY");
    return { reply: null, error: "O assistente está em configuração. Tente novamente mais tarde." };
  }

  const configured = process.env.JARVIS_GEMINI_MODEL?.trim();
  const primary = configured && ALLOWED_MODELS.has(configured) ? configured : "gemini-3.5-flash-lite";
  const fallbacks = primary === "gemini-3.5-flash-lite" ? ["gemini-3.5-flash"] : [];
  for (const model of [primary, ...fallbacks]) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        if ((response.status === 404 || response.status === 400) && model === primary && fallbacks.length) {
          console.warn("JARVIS_MODEL_UNAVAILABLE", model, response.status);
          continue;
        }
        console.error("JARVIS_PROVIDER_HTTP", response.status, model);
        return { reply: null, error: classifyApiFailure(response.status) };
      }
      const data = await response.json() as GeminiResponse;
      const reply = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "").join("").trim() ?? "";
      return reply
        ? { reply, error: null }
        : { reply: null, error: "A IA não devolveu uma resposta. Reformule a pergunta." };
    } catch (error) {
      console.error("JARVIS_PROVIDER_NETWORK", error instanceof Error ? error.name : "unknown");
      return { reply: null, error: "Não foi possível contactar a IA. Verifique a ligação e tente novamente." };
    }
  }
  return { reply: null, error: "Modelo de IA indisponível. Tente novamente." };
}

export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Input.parse(value))
  .handler(async ({ data }) => {
    const recent = data.messages.slice(-12);
    return requestGemini({
      systemInstruction: { parts: [{ text: instructions() }] },
      contents: recent.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 350,
      },
    });
  });

/** Server-side speech recognition fallback when Web Speech is unavailable.
 * The Gemini API key is never exposed to the browser.
 */
export const transcribeJarvisAudio = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => AudioInput.parse(value))
  .handler(async ({ data }) => {
    const result = await requestGemini({
      contents: [{
        role: "user",
        parts: [
          { text: "Transcreve fielmente apenas as palavras ditas neste áudio, na língua original. Não inventes palavras. Se não houver fala inteligível, responde com uma string vazia." },
          { inline_data: { mime_type: data.mimeType, data: data.base64 } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 360 },
    }, 17_000);
    return { transcript: result.reply, error: result.error };
  });
