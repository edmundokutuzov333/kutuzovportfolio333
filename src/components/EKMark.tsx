import { LOGO_H, LOGO_W, logoPolygons } from "./logo-paths";

/** Official EK. monogram rendered from the traced logo polygons. */
export function EKMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} className={className} role="img" aria-label="EK">
      {logoPolygons.map((pts, i) => (
        <polygon key={i} points={pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="currentColor" />
      ))}
    </svg>
  );
}
