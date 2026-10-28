import { LOGO_H, LOGO_W, logoSvgPath } from "./logo-paths";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} className={className} role="img" aria-label="Edmundo Kutuzov">
      <path d={logoSvgPath} fill="currentColor" />
    </svg>
  );
}
