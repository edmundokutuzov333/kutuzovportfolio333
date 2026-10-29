import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_PRESENTATION,
  FooterSettingSchema,
  NavigationSettingSchema,
  PresentationSettingSchema,
} from "@/lib/cms/types";
import { validateSiteSettingValue } from "@/lib/admin-cms.schema";

describe("editable public presentation settings", () => {
  it("accepts the existing public navigation routes and labels", () => {
    expect(NavigationSettingSchema.parse(DEFAULT_PUBLIC_PRESENTATION.navigation)).toHaveLength(7);
    expect(() => validateSiteSettingValue("navigation", [{ to: "javascript:alert(1)", label: "Inject" }])).toThrow();
    expect(() => validateSiteSettingValue("navigation", [{ to: "https://attacker.example", label: "Off-site" }])).toThrow();
  });

  it("requires footer links to remain within implemented routes", () => {
    expect(FooterSettingSchema.parse(DEFAULT_PUBLIC_PRESENTATION.footer).cta_path).toBe("/contact");
    expect(() => validateSiteSettingValue("footer", {
      ...DEFAULT_PUBLIC_PRESENTATION.footer,
      cta_path: "https://attacker.example",
    })).toThrow();
  });

  it("validates menu labels and presentation copy", () => {
    expect(PresentationSettingSchema.parse(DEFAULT_PUBLIC_PRESENTATION.presentation).open_menu_label).toBe("Menu");
    expect(() => validateSiteSettingValue("presentation", {
      ...DEFAULT_PUBLIC_PRESENTATION.presentation,
      close_menu_label: "",
    })).toThrow();
  });

  it("only accepts known setting keys and forbids hiding required public copy", () => {
    expect(() => validateSiteSettingValue("unknown_key", {})).toThrow(/não tem um esquema/);
    expect(validateSiteSettingValue("capabilities", ["Art Direction", "Brand Identity"])).toEqual(["Art Direction", "Brand Identity"]);
  });
});
