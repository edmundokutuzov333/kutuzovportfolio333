import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/live-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store, private" };
        if (process.env["JARVIS_LIVE_ENABLED"] !== "true") return new Response(null, { status: 404, headers });
        const origin = request.headers.get("origin");
        const fetchSite = request.headers.get("sec-fetch-site");
        if (!origin || new URL(origin).origin !== new URL(request.url).origin
          || fetchSite === "cross-site") return new Response(null, { status: 403, headers });
        try {
          const { acquireQuota } = await import("@/lib/server/jarvis-kb.server");
          if (!await acquireQuota()) return new Response(null, { status: 429, headers });
          const key = process.env["GEMINI_API_KEY"];
          if (!key) return new Response(null, { status: 503, headers });
          const model = "models/gemini-3.1-flash-live-preview";
          const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
            method: "POST",
            headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
            body: JSON.stringify({
              uses: 1,
              newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
              expireTime: new Date(Date.now() + 10 * 60_000).toISOString(),
              liveConnectConstraints: {
                model,
                config: { responseModalities: ["AUDIO"], sessionResumption: {} },
              },
            }),
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          });
          if (!response.ok) return new Response(null, { status: 503, headers });
          const token = await response.json() as { name?: string };
          if (!token.name) return new Response(null, { status: 503, headers });
          return Response.json({ token: token.name, model: model.replace(/^models\//, ""),
            expiresInSeconds: 60 }, { headers });
        } catch {
          return new Response(null, { status: 503, headers });
        }
      },
    },
  },
});
