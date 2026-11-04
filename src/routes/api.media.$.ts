import { createFileRoute } from "@tanstack/react-router";
import { createBackblazeDownloadUrl, getBackblazeConfig } from "@/lib/server/backblaze.server";

export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const config = getBackblazeConfig();
        const key = params._splat?.replace(/^\/+/, "");
        if (!config || !key || key.includes("..")) return new Response("Not found", { status: 404 });
        const response = await fetch(createBackblazeDownloadUrl(config, key), { cache: "no-store" });
        if (!response.ok) return new Response("Media unavailable", { status: response.status === 404 ? 404 : 502 });
        const headers = new Headers();
        for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
          const value = response.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set("cache-control", "public, max-age=31536000, immutable");
        return new Response(response.body, { status: 200, headers });
      },
    },
  },
});
