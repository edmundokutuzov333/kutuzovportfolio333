import { CmsContentError } from "./queries";
import type { PageSection } from "./types";

export type HeroSection = Extract<PageSection, { section_type: "hero" }>;
export type RichTextSection = Extract<PageSection, { section_type: "rich_text" }>;

export function requireHeroSection(sections: PageSection[]): HeroSection {
  const section = sections.find((item): item is HeroSection => item.section_type === "hero");
  if (!section) throw new CmsContentError("The published page is missing its hero section.");
  return section;
}

export function requireRichTextSection(sections: PageSection[], key: string): RichTextSection {
  const section = sections.find(
    (item): item is RichTextSection => item.section_type === "rich_text" && item.section_key === key,
  );
  if (!section) throw new CmsContentError(`The published page is missing its ${key} content section.`);
  return section;
}
