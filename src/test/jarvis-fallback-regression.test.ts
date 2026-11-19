import { describe, expect, it } from "vitest";
import { answerContactQuestion, getContact, validateContacts } from "@/lib/jarvis/facts";
import { acquireEmergencyQuota, publishedJarvisFacts } from "@/lib/server/jarvis-resilience.server";

describe("Jarvis fallback", () => {
  const facts = publishedJarvisFacts();
  it("uses published facts and the approved email", () => {
    expect(facts.length).toBeGreaterThan(25);
    expect(facts.every(f => f.status === "verified" && f.visibility === "public")).toBe(true);
    expect(getContact(facts, "en").email).toBe("contact@edmundokutuzov.art");
    expect(getContact(facts, "pt").facebook).toBe(null);
  });
  it("answers Portuguese and English contact questions without calling the model", () => {
    const pt = answerContactQuestion("Qual é o teu contacto oficial?", facts, "pt");
    const en = answerContactQuestion("What are your official contact details?", facts, "en");
    expect(pt).toContain("contact@edmundokutuzov.art");
    expect(en).toContain("contact@edmundokutuzov.art");
  });

  it("never publishes unknown contacts", () => {
    const result = validateContacts("Use fake@example.org and https://example.org", facts, "en");
    expect(result.flagged).toBe(true);
    expect(result.text).not.toContain("fake@example.org");
    expect(result.text).not.toContain("example.org");
  });
  it("enforces emergency limits", () => {
    const bucket = "a".repeat(64), now = 123_450_000;
    expect(acquireEmergencyQuota("invalid", now)).toBe(false);
    for (let i = 0; i < 12; i++) expect(acquireEmergencyQuota(bucket, now)).toBe(true);
    expect(acquireEmergencyQuota(bucket, now)).toBe(false);
    expect(acquireEmergencyQuota(bucket, now + 61_000)).toBe(true);
  });
});
