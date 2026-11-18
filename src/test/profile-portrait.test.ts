import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profilePortrait } from "@/lib/profile-portrait";
import { originalCv } from "@/lib/cv-original";

describe("approved portrait relocation", () => {
  it("preserves original JPEG bytes and removes accidental showreel upload", () => {
    const jpeg=readFileSync("public"+profilePortrait);
    expect(createHash("sha256").update(jpeg).digest("hex"))
      .toBe("bdc3366b070891fbe7655093df8e7f7224bd40331a959477fc4cd3800905d0fd");
    expect(existsSync("public/showreelvideo/EDMUNDO KUTUZOV.jpg")).toBe(false);
    expect(jpeg.subarray(0,3).toString("hex")).toBe("ffd8ff");
  });
  it("shares exactly the same portrait across About, CV and PDF engine", () => {
    const about=readFileSync("src/routes/about.tsx","utf8");
    const cv=readFileSync("src/routes/cv.tsx","utf8");
    const engine=readFileSync("scripts/build-cv-pdfs.mjs","utf8");
    expect(originalCv.photo).toBe(profilePortrait);
    expect(about).toContain("const portrait = profilePortrait");
    expect(cv).toContain("src={profilePortrait}");
    expect(engine).toContain('photo:"/portraits/edmundo-kutuzov.jpg"');
  });
});
