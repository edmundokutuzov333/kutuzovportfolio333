import { describe, it, expect } from "vitest";
import { spokenJarvisText } from "@/lib/jarvis/speech";
describe("JARVIS voice contact articulation", () => {
  it("speaks email components and leaves the displayed original unchanged", () => {
    const input = "Contacto: contact@edmundokutuzov.art";
    expect(spokenJarvisText(input)).toBe("Contacto: contact arroba edmundokutuzov ponto art");
    expect(input).toContain("@");
  });
  it("reads WhatsApp digits individually, not as a huge number", () => {
    expect(spokenJarvisText("https://wa.me/258876013121"))
      .toBe("WhatsApp, 2 5 8 8 7 6 0 1 3 1 2 1");
  });
  it("does not narrate lengthy non-contact URLs", () => {
    expect(spokenJarvisText("Veja https://example.org/work/a longa"))
      .toBe("Veja ligação disponível na conversa escrita longa");
  });
});
