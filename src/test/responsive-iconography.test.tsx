import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { DirectionIcon } from "@/components/DirectionIcon";

describe("responsive SVG iconography", () => {
  for (const direction of ["back", "forward", "external", "down"] as const) {
    it(`renders the ${direction} affordance as an accessible, font-independent SVG`, () => {
      const html = renderToStaticMarkup(<DirectionIcon direction={direction} />);
      expect(html).toContain("<svg");
      expect(html).toContain(`data-site-icon="${direction}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('focusable="false"');
      expect(html).not.toMatch(/[↗→←↓✓]/);
    });
  }

  it("uses SVGs rather than potentially emoji-rendered text arrows in public interfaces", () => {
    for (const path of [
      "src/components/Shell.tsx",
      "src/components/Intro.tsx",
      "src/components/JarvisLauncher.tsx",
      "src/routes/index.tsx",
      "src/routes/contact.tsx",
      "src/lib/jarvis/locale.ts",
      "src/lib/i18n.tsx",
    ]) {
      const content = readFileSync(path, "utf8");
      expect(content, path).not.toMatch(/[↗→←↓✓]/);
    }
  });

  it("retains the real link destinations and the existing footer CTA behavior", () => {
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    const jarvis = readFileSync("src/components/JarvisLauncher.tsx", "utf8");
    expect(shell).toContain("mailto:${profile.email}");
    expect(shell).toContain("href={social.href}");
    expect(shell).toContain("trailingIcon />");
    expect(jarvis).toContain("onClick={openJarvis}");
    expect(jarvis).toContain('direction="external"');
    expect(jarvis).toContain('direction="forward"');
  });
});
