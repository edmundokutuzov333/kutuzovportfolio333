import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cvContactEmail } from "@/lib/cv-content";

describe("single-sheet CV export", () => {
  it("keeps the public CV email independent of the untouched archival CV", () => {
    const cv = readFileSync("src/routes/cv.tsx","utf8");
    expect(cvContactEmail).toBe("contact@edmundokutuzov.art");
    expect(cv).toContain("mailto:\${cvContactEmail}");
    expect(cv).toContain('import "./cv-print.css"');
  });

  it("applies the editorial grid only for A4 printing", () => {
    const css=readFileSync("src/routes/cv-print.css","utf8");
    expect(css.trimStart().startsWith("/*")).toBe(true);
    expect(css).toContain("@media print");
    expect(css).toContain("@page { size: A4; margin: 0; }");
    expect(css).toContain(".cv-section--experience");
    expect(css).toContain(".cv-document__duo--end");
    expect(css).not.toContain("display: none !important;\n  .cv-cover__portrait");
  });

  it("rejects old addresses and multi-page exports at build time", () => {
    const script=readFileSync("scripts/build-cv-pdfs.mjs","utf8");
    expect(script).toContain("if(pages!==1)");
    expect(script).toContain("validatePdf(output,locale)");
    expect(script).toContain("renameSync(item.output");
    expect(script).toContain("contact@edmundokutuzov.art");
  });
  it("renders fixed-thickness skills on screen and paper, without fractional print bars", () => {
    const screen=readFileSync("src/routes/cv.css","utf8");
    const print=readFileSync("src/routes/cv-print.css","utf8");
    expect(screen).toContain("height: 3px;");
    expect(screen).toContain("min-height: 3px;");
    expect(screen).toContain("max-height: 3px;");
    expect(screen).toContain("position: absolute;");
    expect(print).toContain("height: 3px !important;");
    expect(print).toContain("min-height: 3px !important;");
    expect(print).toContain("max-height: 3px !important;");
    expect(print).not.toContain("height: 1.5px");
    expect(screen).not.toContain("height:2px!important");
  });

});
