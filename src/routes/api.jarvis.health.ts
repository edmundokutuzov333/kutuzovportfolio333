import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/health")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        try {
          const { getVerifiedFacts } = await import("@/lib/server/jarvis-kb.server");
          const { getContact } = await import("@/lib/jarvis/facts");
          const facts = await getVerifiedFacts();
          const contact = getContact(facts);
          if (!contact.email) throw new Error("unverified_contact");
          // No credentials, IPs, user questions, or private facts are exposed.
          return Response.json({ status: "ready", facts: facts.length, kb: "verified",
            latencyMs: Date.now() - start }, {
            headers: { "Cache-Control": "no-store, private" },
          });
        } catch {
          return Response.json({ status: "unavailable" }, {
            status: 503, headers: { "Cache-Control": "no-store, private" },
          });
        }
      },
    },
  },
});
