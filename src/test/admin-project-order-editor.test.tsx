import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectOrderEditor } from "@/components/admin/ProjectOrderEditor";
import type { ProjectOrderRecord } from "@/lib/admin-project-order";

const rows: ProjectOrderRecord[] = Array.from({ length: 155 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
  title: index === 139 ? "A Depressão é Real" : `Trabalho n.º ${index + 1}`,
  slug: `project-${index + 1}`,
  discipline: index >= 130 ? "Campaign design" : "Social Media",
  position: index,
  status: "published",
}));

describe("Admin order editor SSR / accessible static content", () => {
  it("renders the complete published order and all move controls without touching Admin auth", () => {
    const html = renderToStaticMarkup(
      <ProjectOrderEditor records={rows} saving={false} savedOrder={null}
        onPublish={async () => { throw new Error("No API calls during render"); }}
        onClose={() => {}} />,
    );
    expect(html).toContain("Organizar trabalhos");
    expect(html).toContain("155 trabalhos publicados");
    expect(html).toContain('data-order-position="1"');
    expect(html).toContain('data-order-position="155"');
    expect(html).toContain("A Depressão é Real");
    expect(html).toContain("Guardar e publicar ordem");
    expect(html).toContain('aria-label="Pesquisar trabalhos para organizar"');
    expect(html).toContain('aria-label="Filtrar trabalhos por categoria"');
    expect(html.match(/data-project-sort-id=/g)).toHaveLength(155);
    expect(html).not.toContain("Confirmar e publicar");
  });

  it("never includes archived works in the order or exposes the PIN/login", () => {
    const html = renderToStaticMarkup(
      <ProjectOrderEditor records={[...rows, { ...rows[0]!, id: "archived-row", status: "archived", position: 0 }]}
        saving={false} savedOrder={null} onPublish={async () => {}} onClose={() => {}} />,
    );
    expect(html).not.toContain('data-project-sort-id="archived-row"');
    expect(html).not.toContain("Código de acesso");
    expect(html.match(/data-project-sort-id=/g)).toHaveLength(155);
  });
});
