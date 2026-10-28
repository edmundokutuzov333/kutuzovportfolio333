import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { LogoMark } from "./LogoMark";

const Scene = lazy(() => import("./Logo3DScene"));

export function Logo3D({ className }: { className?: string }) {
  const fallback = (
    <div className="flex h-full w-full items-center justify-center">
      <LogoMark className="w-1/2 text-foreground/80" />
    </div>
  );
  return (
    <div className={className}>
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <Scene />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
