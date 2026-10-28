import { describe, expect, it } from "vitest";
import { emptyBrief, validateStep } from "@/lib/brief";

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
  it("rejects files over 8 MB and non-image types", () => {
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "b.png", { type: "image/png" });
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(validateStep(4, { ...ok, files: [big] })).not.toBeNull();
    expect(validateStep(4, { ...ok, files: [pdf] })).not.toBeNull();
  });
  it("links must be http or https", () => {
    expect(validateStep(4, { ...ok, links: "ftp://x.com" })).not.toBeNull();
    expect(validateStep(4, { ...ok, links: "https://x.com" })).toBeNull();
  });
});
