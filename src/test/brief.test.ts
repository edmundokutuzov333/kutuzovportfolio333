import { describe, expect, it } from "vitest";
import { MAX_TOTAL_FILE_BYTES, emptyBrief, validateStep } from "@/lib/brief";

const ok = { ...emptyBrief, name: "Ana", email: "ana@x.com", type: "Brand Identity", message: "Hello there friend" };

describe("briefing form rules", () => {
  it("requires name and email", () => {
    expect(validateStep(0, { ...ok, name: "" })).not.toBeNull();
    expect(validateStep(0, { ...ok, email: "nope" })).not.toBeNull();
    expect(validateStep(0, ok)).toBeNull();
  });
  it("message must be 10 to 4000 chars", () => {
    expect(validateStep(4, { ...ok, message: "123456789" })).not.toBeNull();
    expect(validateStep(4, { ...ok, message: "a".repeat(4001) })).not.toBeNull();
    expect(validateStep(4, { ...ok, message: "a".repeat(10) })).toBeNull();
  });
  it("allows at most 5 files", () => {
    const f = new File(["x"], "a.png", { type: "image/png" });
    expect(validateStep(4, { ...ok, files: Array(6).fill(f) })).not.toBeNull();
    expect(validateStep(4, { ...ok, files: Array(5).fill(f) })).toBeNull();
  });
  it("accepts PDF references and enforces the total upload budget", () => {
    const pdf = new File(["%PDF-1.7\\n1 0 obj"], "brand-guidelines.pdf", { type: "application/pdf" });
    expect(validateStep(4, { ...ok, files: [pdf] })).toBeNull();

    const eightMb = new File([new Uint8Array(8 * 1024 * 1024)], "reference.png", { type: "image/png" });
    expect(validateStep(4, { ...ok, files: [eightMb, eightMb] })).toBeNull();
    expect(MAX_TOTAL_FILE_BYTES).toBe(17 * 1024 * 1024);
    expect(validateStep(4, { ...ok, files: [eightMb, eightMb, eightMb] })).not.toBeNull();
  });

  it("rejects files over 8 MB and unsupported types", () => {
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "b.png", { type: "image/png" });
    const unsupported = new File(["x"], "a.exe", { type: "application/octet-stream" });
    expect(validateStep(4, { ...ok, files: [big] })).not.toBeNull();
    expect(validateStep(4, { ...ok, files: [unsupported] })).not.toBeNull();
  });

  it("validates the expanded project objective and delivery channels", () => {
    expect(validateStep(1, { ...ok, projectGoal: "Lead generation and sales", channels: ["Social media", "Digital advertising"] })).toBeNull();
    expect(validateStep(1, { ...ok, projectGoal: "Invented objective" })).not.toBeNull();
    expect(validateStep(1, { ...ok, channels: ["Invented channel"] })).not.toBeNull();
  });

  it("accepts supported file extensions when browser MIME metadata is absent", () => {
    const file = new File(["minimal test payload"], "client-reference.pdf", { type: "" });
    expect(validateStep(4, { ...ok, files: [file] })).toBeNull();
    const unsupported = new File(["payload"], "client-reference.exe", { type: "" });
    expect(validateStep(4, { ...ok, files: [unsupported] })).not.toBeNull();
  });

  it("links must be http or https", () => {
    expect(validateStep(4, { ...ok, links: "ftp://x.com" })).not.toBeNull();
    expect(validateStep(4, { ...ok, links: "https://x.com" })).toBeNull();
  });
});
