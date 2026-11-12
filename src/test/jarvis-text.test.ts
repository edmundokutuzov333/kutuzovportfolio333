import { describe, expect, it } from "vitest";
import { cleanJarvisReply } from "@/lib/jarvis-text";

describe("JARVIS readable answers", () => {
  it("removes Markdown list markers, emphasis and headings", () => {
    expect(cleanJarvisReply("## Projectos\n- **Diga YES:** direcção de arte.\n- **Água é vida:** campanha."))
      .toBe("Projectos\nDiga YES: direcção de arte.\nÁgua é vida: campanha.");
  });

  it("preserves natural paragraphs, numbers, URLs and ordinary punctuation", () => {
    const input = "Olá! **Bem-vindo.**\n\nVeja 2 trabalhos em https://edmundokutuzov.art/work.\n\nTudo bem?";
    expect(cleanJarvisReply(input))
      .toBe("Olá! Bem-vindo.\n\nVeja 2 trabalhos em https://edmundokutuzov.art/work.\n\nTudo bem?");
  });

  it("removes fences, inline backticks and link markup without losing content", () => {
    expect(cleanJarvisReply("```txt\n**Experiência**\n```\nVisite [o site](https://edmundokutuzov.art)."))
      .toBe("Experiência\nVisite o site (https://edmundokutuzov.art).");
  });

  it("does not alter identifiers and natural words with underscores", () => {
    expect(cleanJarvisReply("Conheça projeto_2026 e contact@edmundokutuzov.art."))
      .toBe("Conheça projeto_2026 e contact@edmundokutuzov.art.");
  });
});
