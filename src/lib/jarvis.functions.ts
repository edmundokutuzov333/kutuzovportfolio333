import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
}).strict();
const Input = z.object({ messages: z.array(Message).min(1).max(24) }).strict();
const Audio = z.object({
  base64: z.string().min(100).max(4_100_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.enum(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"]),
}).strict();

export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Input.parse(value))
  .handler(async ({ data }) => {
    const { answerJarvis } = await import("@/lib/server/jarvis-kb.server");
    return answerJarvis(data.messages);
  });

export const transcribeJarvisAudio = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Audio.parse(value))
  .handler(async ({ data }) => {
    const { transcribeJarvis } = await import("@/lib/server/jarvis-kb.server");
    const result = await transcribeJarvis(data.base64, data.mimeType);
    return { transcript: result.reply, error: result.error };
  });
