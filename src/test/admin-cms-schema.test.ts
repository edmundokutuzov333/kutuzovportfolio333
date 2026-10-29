import { describe, expect, it } from "vitest";

import {
  AdminMutationInputSchema,
  validateAdminPayload,
} from "@/lib/admin-cms.schema";

describe("Kutuzov Admin editorial server contracts", () => {
  it("accepts a versioned project publication payload with a safe slug", () => {
    const input = AdminMutationInputSchema.parse({
      entity: "projects",
      action: "publish",
      id: null,
      payload: {
        slug: "case-study-808",
        title: "Case Study 808",
        position: 4,
        status: "draft",
        gallery: ["/__l5e/assets-v1/case/image.webp"],
        gallery_alt: ["Imagem principal do estudo de caso"],
        featured: false,
        hue: 215,
        locale: "pt-MZ",
      },
      expectedUpdatedAt: null,
      note: "Teste de contrato",
    });
    expect(input.entity).toBe("projects");
    expect(validateAdminPayload("projects", input.payload, "publish", { creating: true }).slug).toBe("case-study-808");
  });

  it("rejects slugs with spaces, uppercase characters and path injection", () => {
    for (const invalid of ["Case Study", "bad slug", "../private", "slug?next=admin"]) {
      expect(() => validateAdminPayload("projects", { slug: invalid }, "update")).toThrow();
    }
  });

  it("rejects non-HTTPS and arbitrary code in media fields", () => {
    expect(() => validateAdminPayload("projects", { cover_path: "javascript:alert(1)" }, "update")).toThrow();
    expect(() => validateAdminPayload("projects", { gallery: ["data:text/html,hello"] }, "update")).toThrow();
    expect(() => validateAdminPayload("clients", { logo_path: "http://cdn.example.test/logo.png" }, "update")).toThrow();
  });

  it("requires the validated canonical origin instead of accepting a preview URL", () => {
    expect(() => validateAdminPayload("pages", {
      canonical_url: "https://kutuzovportfolio333.lovable.app/about",
    }, "update")).toThrow(/PUBLIC_SITE_URL/);
    expect(() => validateAdminPayload("pages", {
      canonical_url: "https://preview-123.lovable.app/about",
    }, "update", { publicSiteUrl: "https://kutuzovportfolio333.lovable.app" })).toThrow(/origem definida/);
    expect(validateAdminPayload("pages", {
      canonical_url: "https://kutuzovportfolio333.lovable.app/about",
    }, "update", { publicSiteUrl: "https://kutuzovportfolio333.lovable.app" }).canonical_url).toBe("https://kutuzovportfolio333.lovable.app/about");
  });

  it("rejects arbitrary HTML configurations for a supported Home section", () => {
    expect(() => validateAdminPayload("page_sections", {
      section_type: "hero",
      config: { html: "<script>alert(1)</script>" },
    }, "update")).toThrow();
  });

  it("does not permit mass assignment or unknown section types", () => {
    expect(() => validateAdminPayload("projects", {
      slug: "case-study", service_role: true,
    }, "update")).toThrow();
    expect(() => validateAdminPayload("page_sections", {
      section_type: "raw_html",
      config: { html: "<h1>Injected</h1>" },
    }, "update")).toThrow();
  });

  it("requires key fields for creation and permits a client with no logo", () => {
    expect(() => validateAdminPayload("projects", { slug: "missing-title" }, "publish", { creating: true })).toThrow(/Campos obrigatórios/);
    const client = validateAdminPayload("clients", {
      slug: "brand-without-logo",
      name: "Brand Without Logo",
      logo_path: null,
      logo_alt: null,
      position: 20,
      is_visible: true,
    }, "publish", { creating: true });
    expect(client.logo_path).toBeNull();
  });

  it("validates the mutation envelope against unexpected outer fields", () => {
    expect(AdminMutationInputSchema.safeParse({
      entity: "projects", action: "publish", id: null, payload: {},
      expectedUpdatedAt: null, root_service_key: "not-allowed",
    }).success).toBe(false);
    expect(AdminMutationInputSchema.safeParse({
      entity: "projects", action: "delete", id: null, payload: {},
      expectedUpdatedAt: null,
    }).success).toBe(false);
  });
});
