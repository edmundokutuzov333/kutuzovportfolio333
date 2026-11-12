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
          return Response.json({ ok: true, ...result }, { headers });
        } catch {
          console.error("JARVIS_SYNC_FAILED");
          return Response.json({ ok: false }, { status: 503, headers });
        }
      },
    },
  },
});
