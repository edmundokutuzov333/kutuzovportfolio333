import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeAssetImage } from "@/components/SafeAssetImage";

describe("SafeAssetImage", () => {
  it("reports the failure instead of leaving a broken image or a fabricated replacement", () => {
    const { getByRole } = render(
      <SafeAssetImage
        src="/__l5e/assets-v1/missing/cover.webp"
        alt="Original project cover"
        fallbackLabel="Cover unavailable"
      />,
    );

    fireEvent.error(getByRole("img", { name: "Original project cover" }));

    const fallback = getByRole("img", { name: "Original project cover: Cover unavailable" });
    expect(fallback.getAttribute("data-asset-state")).toBe("unavailable");
    expect(fallback.textContent).toContain("Cover unavailable");
  });
});
