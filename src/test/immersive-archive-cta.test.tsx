import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

import { ARCHIVE_EXPERIENCE_URL, Component as ArchiveLauncher } from "@/components/ui/ai-loader";

describe("Work immersive archive floating launcher", () => {
  it("opens the real independently hosted immersive archive without navigating away from Work", () => {
    const html = renderToStaticMarkup(<ArchiveLauncher />);
    expect(ARCHIVE_EXPERIENCE_URL).toBe("https://showreel-kutuzov-v2.vercel.app/");
    expect(html).toContain('data-testid="work-immersive-archive-link"');
    expect(html).toContain('href="https://showreel-kutuzov-v2.vercel.app/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Explore the immersive archive (opens in a new tab)"');
    expect(html).not.toContain('fixed inset-0');
  });

  it("animates each character with a deterministic offset, not a JS interval", () => {
    const html = renderToStaticMarkup(<ArchiveLauncher text="ENTER" size={100} />);
    expect(html.match(/ek-archive-cta__letter"/g)).toHaveLength(5);
    for (let index = 0; index < 5; index++) {
      expect(html).toContain(`animation-delay:${(index * 0.1).toFixed(1)}s`);
    }
    expect(html).toContain("--ek-archive-orb-size:100px");
  });

  it("keeps the supplied CSS orb and letter animations scoped and accessible", () => {
    const css = readFileSync("src/components/ui/ai-loader.css", "utf8");
    expect(css).toContain("@keyframes ekArchiveCircle");
    expect(css).toContain("@keyframes ekArchiveLetter");
    expect(css).toContain("@keyframes ekArchiveFloat");
    expect(css).toContain("5s linear infinite");
    expect(css).toContain("3s ease-in-out infinite");
    expect(css).toContain("position: fixed");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).not.toContain("inset: 0;\n  z-index: 50;");
  });

  it("supports bilingual copy without duplicating the page or introducing a dependency", () => {
    const html = renderToStaticMarkup(
      <ArchiveLauncher
        text="ENTRAR"
        label="ARQUIVO IMERSIVO"
        eyebrow="ENTRE NO UNIVERSO"
        ariaLabel="Explorar o arquivo imersivo numa nova aba"
      />
    );
    expect(html).toContain("ARQUIVO IMERSIVO");
    expect(html).toContain("ENTRE NO UNIVERSO");
    expect(html).toContain("Explorar o arquivo imersivo numa nova aba");
    expect(html).toContain(ARCHIVE_EXPERIENCE_URL);
  });

  it("does not inject a full-screen blocker on unrelated routes", () => {
    const work = readFileSync("src/routes/work.index.tsx", "utf8");
    expect(work).toContain("Component as ImmersiveArchiveCTA");
    expect(work).toContain("<ImmersiveArchiveCTA");
    expect(work).toContain('<ProjectCard project={project} index={index} />');
    expect(work).toContain("setFilter(value)");
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    expect(shell).not.toContain("ImmersiveArchiveCTA");
  });
});
