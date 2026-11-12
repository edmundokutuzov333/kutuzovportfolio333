import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "Cache-Control": "no-store, private" };
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("authorization") !== "Bearer " + secret)
          return new Response(null, { status: 401, headers });
        try {
          const { db } = await import("@/lib/server/jarvis-kb.server");
          const result = await db<{ verified_documents: number; verified_chunks: number }>(
            "rpc/kb_sync_published", { method: "POST", body: {}, timeoutMs: 12000 },
          );
          // Data minimisation: delete only old anonymised JARVIS query logs.
          // Never touch the site's existing CMS or submission tables.
          const configured = Number(process.env["JARVIS_LOG_RETENTION_DAYS"] ?? 60);
          const days = Number.isFinite(configured) ? Math.max(30, Math.min(90, Math.floor(configured))) : 60;
          const threshold = new Date(Date.now() - days * 86_400_000).toISOString();
          await db<null>("kb_query_log?ts=lt." + encodeURIComponent(threshold),
            { method: "DELETE", timeoutMs: 5000 });
          return Response.json({ ok: true, ...result, retentionDays: days }, { headers });
        } catch {
          console.error("JARVIS_SYNC_FAILED");
          return Response.json({ ok: false }, { status: 503, headers });
        }
      },
    },
  },
});
