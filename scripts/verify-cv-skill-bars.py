"""PDF raster regression gate: every skill must have the same filled-bar thickness.

At 180 DPI, the five A4 competency meters are sampled in their right-column
printing region. A misplaced or fractional-height meter creates unequal bands.
The test works on *rendered* PDFs, not merely the CSS rules.
"""
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

PDF_DIR = Path(__file__).resolve().parents[1] / "public" / "cv"


def bar_heights(pdf: Path) -> list[int]:
    with tempfile.TemporaryDirectory(prefix="ek-skills-pdf-") as folder:
        output = Path(folder) / "page"
        subprocess.run(
            ["pdftoppm", "-f", "1", "-l", "1", "-r", "180",
             "-singlefile", "-png", str(pdf), str(output)],
            check=True, capture_output=True, timeout=90,
        )
        image = Image.open(output.with_suffix(".png")).convert("RGB")
        width, height = image.size

        # The A4 print stylesheet places five blue meters in the right column.
        x0, x1 = int(width * .54), int(width * .94)
        y0, y1 = int(height * .30), int(height * .90)
        minimum_blue_pixels = int((x1 - x0) * .50)

        filled_rows = []
        for y in range(y0, y1):
            count = 0
            for x in range(x0, x1):
                red, green, blue = image.getpixel((x, y))
                if blue > 135 and blue > red * 1.4 and blue > green * 1.3:
                    count += 1
            if count > minimum_blue_pixels:
                filled_rows.append(y)

        groups: list[list[int]] = []
        for y in filled_rows:
            if groups and y <= groups[-1][-1] + 1:
                groups[-1].append(y)
            else:
                groups.append([y])
        return [len(group) for group in groups]


for language in ("EN", "PT"):
    pdf = PDF_DIR / f"Edmundo-Kutuzov-CV-{language}.pdf"
    heights = bar_heights(pdf)
    assert len(heights) == 5, (
        f"{language}: expected 5 filled meter bands, got {len(heights)}: {heights}"
    )
    assert min(heights) >= 4 and max(heights) <= 8, (
        f"{language}: skill bars are not a sufficiently visible fixed stroke: {heights}"
    )
    assert len(set(heights)) == 1, (
        f"{language}: uneven skill bar thickness: {heights}"
    )
    print(f"{language}: five equal, {heights[0]}-pixel skill fills at 180 DPI")
