import { requireAdmin } from "./admin-auth.server";
import { db } from "./jarvis-kb.server";
import type { Fact } from "@/lib/jarvis/facts";

type FactRecord = Fact & { id: string; verified_at: string | null; updated_at: string };
type Revision = { id: number; fact_key: string; locale: string; operation: string;
  changed_at: string; old_fact: Partial<FactRecord> | null; new_fact: Partial<FactRecord> | null };
type Flag = { id: number; ts: string; query_redacted: string | null; flag_reason: string | null;
  answered: boolean | null; tier_used: string | null };
export async function loadKnowledgeAdmin() {
  await requireAdmin();
  const [facts, revisions, flags, state, documents] = await Promise.all([
    db<FactRecord[]>("kb_facts?select=*&order=priority.asc,key.asc&limit=250"),
    db<Revision[]>("kb_fact_revisions?select=*&order=changed_at.desc&limit=45"),
    db<Flag[]>("kb_query_log?select=id,ts,query_redacted,flag_reason,answered,tier_used&or=(answered.eq.false,flagged.eq.true)&order=ts.desc&limit=40"),
    db<Array<{ version: number }>>("kb_state?select=version&id=eq.1"),
    db<Array<{ id: string }>>("kb_documents?select=id&status=eq.verified&limit=250"),
  ]);
  return { facts, revisions, flags, version: state[0]?.version ?? 0, documents: documents.length };
}

export type FactMutation = {
  key: string; locale: "all" | "pt" | "en"; value: string; spoken: string | null;
  status: "verified" | "pending_review" | "rejected" | "deprecated";
  visibility: "public" | "private"; priority: number; source: string;
};

export async function saveKnowledgeFact(input: FactMutation) {
  await requireAdmin();
  if (input.key === "contact.email" && input.status === "verified"
    && input.value !== "contact@edmundokutuzov.art") {
    throw new Error("O email oficial requer aprovação editorial específica.");
  }
  const updated = await db<FactRecord[]>("kb_facts?on_conflict=key%2Clocale", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: [{
      ...input, updated_at: new Date().toISOString(),
      verified_at: input.status === "verified" ? new Date().toISOString() : null,
    }],
  });
  if (!updated[0]) throw new Error("A alteração não foi confirmada.");
  return { ok: true, key: updated[0].key };
}
export async function rollbackKnowledgeFact(revisionId: number) {
  await requireAdmin();
  const revisions = await db<Revision[]>(
    "kb_fact_revisions?select=*&id=eq." + revisionId + "&limit=1",
  );
  const old = revisions[0]?.old_fact;
  if (!old?.key || !old.value || !old.locale || !old.status || !old.visibility)
    throw new Error("Esta revisão não permite reposição automática.");
  return saveKnowledgeFact({
    key: old.key, locale: old.locale, value: old.value, spoken: old.spoken ?? null,
    status: old.status, visibility: old.visibility, priority: old.priority ?? 100,
    source: "rollback:" + revisionId,
  });
}

export async function reindexKnowledge() {
  await requireAdmin();
  return db<{ verified_documents: number; verified_chunks: number }>("rpc/kb_sync_published",{
    method: "POST",body:{},timeoutMs:10000,
  });
}

/** Manually backfill up to 24 approved chunks per invocation (admin-only). */
export async function embedKnowledgeAdmin() {
  await requireAdmin();
  const { embedPendingChunks } = await import("./jarvis-embed.server");
  return embedPendingChunks(24);
}
