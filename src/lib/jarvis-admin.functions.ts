import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FactInput = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_.-]{1,90}$/),
  locale: z.enum(["all", "pt", "en"]),
  value: z.string().trim().min(1).max(2000),
  spoken: z.string().max(500).nullable(),
  status: z.enum(["verified","pending_review","rejected","deprecated"]),
  visibility: z.enum(["public","private"]),
  priority: z.number().int().min(1).max(500),
  source: z.string().min(3).max(160),
}).strict();

export const loadKnowledgeFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadKnowledgeAdmin } = await import("./server/jarvis-admin.server");
  return loadKnowledgeAdmin();
});
export const saveKnowledgeFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => FactInput.parse(raw))
  .handler(async ({ data }) => {
    const { saveKnowledgeFact } = await import("./server/jarvis-admin.server");
    return saveKnowledgeFact(data);
  });
export const rollbackKnowledgeFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.number().int().positive() }).strict().parse(raw))
  .handler(async ({ data }) => {
    const { rollbackKnowledgeFact } = await import("./server/jarvis-admin.server");
    return rollbackKnowledgeFact(data.id);
  });
export const reindexKnowledgeFn = createServerFn({ method: "POST" }).handler(async () => {
  const { reindexKnowledge } = await import("./server/jarvis-admin.server");
  return reindexKnowledge();
});
