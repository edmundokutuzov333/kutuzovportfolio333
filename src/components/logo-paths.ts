// EK monogram traced from the official logo file (viewBox 1920 x 815).
export const LOGO_W = 1920;
export const LOGO_H = 815;

export const logoPolygons: [number, number][][] = [
  // E
  [
    [0, 145], [145, 0], [925, 0], [743, 182], [235, 182], [235, 318], [715, 318], [538, 497],
    [235, 497], [235, 632], [743, 632], [925, 815], [145, 815], [0, 670], [0, 548], [143, 408], [0, 265],
  ],
  // K chevron
  [[1192, 0], [1715, 0], [1497, 220], [1278, 220], [1115, 382], [1548, 815], [1225, 815], [812, 382]],
  // full stop
  [[1713, 608], [1920, 608], [1920, 815], [1713, 815]],
];

export const logoSvgPath = logoPolygons
  .map((poly) => "M" + poly.map(([x, y]) => `${x} ${y}`).join(" L") + " Z")
  .join(" ");
