import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cvSections, normaliseCvPhone, originalCv } from "@/lib/cv-original";

describe("native CV — exact information contract", () => {
  it("retains the original PDF byte for byte", () => {
    const bytes = readFileSync("public/edmundo-kutuzov-cv-2026.pdf");
    expect(bytes.length).toBe(238751);
    expect(createHash("sha256").update(bytes).digest("hex"))
      .toBe("4ebf841282ac47b386c8dab6e4f37dfc09950704aa925bd563ac08efb7ce9e37");
  });

  it("uses precisely the portrait already supplied on the About page", () => {
    const about = readFileSync("src/routes/about.tsx","utf8");
    expect(about).toContain('"/edmundo-kutuzov-foto.jpg"');
    expect(originalCv.photo).toBe("/edmundo-kutuzov-foto.jpg");
  });

  it("preserves the original name, role, every career step and exact dates", () => {
    expect(originalCv.name).toEqual(["EDMUNDO","KUTUZOV."]);
    expect(originalCv.role).toEqual(["VISUAL COMMUNICATION DESIGNER","& ART DIRECTOR"]);
    expect(originalCv.experience.items).toEqual([
      { company:"Agência Creer", period:"2020 - 2023", role:"Designer Gráfico" },
      { company:"Imperial Seguros", period:"2023 - 2023", role:"Assistente de Marketing & Gestor de Redes Sociais" },
      { company:"Ikigai Moçambique", period:"2023 - 2023", role:"Designer Gráfico" },
      { company:"SPOT Comunicação", period:"2023 - 2024", role:"Director de Arte" },
      { company:"WEBMASTERS Limitada", period:"2024 - Presente", role:"Director de Arte & Criador de Conteúdo" },
    ]);
    expect(originalCv.education).toEqual({
      heading:"EDUCAÇÃO", school:"Escola Secundária Quisse Mavota", level:"12a Classe", year:"2019",
    });
  });

  it("preserves original career bio, all named collaborators, contacts and reference", () => {
    expect(originalCv.about.text).toBe(
      "Criativo de 23 anos, iniciei a carreira aos 17 em agências de referência. Colaborei com marcas como Absa, Pernod Ricard Moçambique, Nissan Moçambique, Galp, TotalEnergies, MultiChoice, Vodacom, Toyota, KitKat Moçambique e GIZ, entregando soluções visuais sólidas e coerentes."
    );
    expect(originalCv.contact.phone).toBe("+258 87 601 312 1");
    expect(originalCv.contact.email).toBe("edmundokutuzov.mz@gmail.com");
    expect(originalCv.contact.address).toEqual(["Magoanine “C”","Maputo, Moçambique"]);
    expect(originalCv.reference).toEqual({
      heading:"REFERÊNCIA",name:"Ferrão Chico",
      role:"Director de Arte - SPOT Comunicação",
      phoneLine:"Celular: +258 84 579 2106",
      phone:"+258 84 579 2106",
    });
    expect(normaliseCvPhone(originalCv.contact.phone)).toBe("tel:+258876013121");
  });

  it("preserves every original proficiency without correction or invented values", () => {
    expect(originalCv.skills.items).toEqual([
      { name:"Adobe Potoshop",value:95 },
      { name:"Adobe Illustrator",value:75 },
      { name:"Adobe Premiere",value:55 },
      { name:"Adobe InDesign",value:55 },
      { name:"Inteligência Artificial",value:95 },
    ]);
  });

  it("contains only source headings and uses HTML rather than an embedded PDF viewer", () => {
    expect(cvSections.map(x=>x.heading)).toEqual([
      "Sobre Mim","EXPERIÊNCIA","EDUCAÇÃO","SKILLS","CONTACTO","REFERÊNCIA"
    ]);
    const route=readFileSync("src/routes/cv.tsx","utf8");
    const about=readFileSync("src/routes/about.tsx","utf8");
    const css=readFileSync("src/routes/cv.css","utf8");
    expect(route).not.toMatch(/<iframe|<embed|<object|pdfjs-dist|react-pdf/i);
    expect(route).toContain('download="Edmundo-Kutuzov-CV-2026.pdf"');
    expect(route).toContain('to="/about"');
    expect(route).toContain("originalCv.photo");
    expect(route).toContain('role="meter"');
    expect(about).toContain('to="/cv"');
    expect(about).not.toContain('target="_blank"');
    expect(css).toContain("@media print");
    expect(css).toContain("@media(prefers-reduced-motion: reduce)");
  });
});
