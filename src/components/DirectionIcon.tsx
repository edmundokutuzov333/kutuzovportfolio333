import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

type Direction = "back" | "forward" | "external";

/** Inline SVG affordance: never rely on Unicode arrows or platform emoji fonts. */
export function DirectionIcon({ direction = "forward", className = "" }: {
  direction?: Direction;
  className?: string;
}) {
  const Icon = direction === "external" ? ArrowUpRight : direction === "back" ? ArrowLeft : ArrowRight;
  return (
    <Icon
      size={16}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      data-site-icon={direction}
      className={"inline-block h-4 w-4 shrink-0 " + className}
    />
  );
}
