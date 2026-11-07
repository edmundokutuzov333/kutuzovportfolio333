import { useState } from "react";
import { isVideoSource } from "@/lib/project-media";
import { resolvePublicAssetUrl } from "@/lib/public-assets";
import { SafeAssetImage } from "./SafeAssetImage";

type ProjectMediaProps = {
  src: string;
  alt: string;
  className?: string;
  controls?: boolean;
  loading?: "eager" | "lazy";
};

export function ProjectMedia(props: ProjectMediaProps) {
  const source = resolvePublicAssetUrl(props.src);
  return <MediaContent key={source} {...props} src={source} />;
}

function MediaContent({ src, alt, className, controls = false, loading = "lazy" }: ProjectMediaProps) {
  const [failed, setFailed] = useState(false);
  if (!isVideoSource(src)) return <SafeAssetImage src={src} alt={alt} className={className ?? ""} loading={loading} />;
  if (failed) return <div className={className} role="img" aria-label={alt} data-asset-state="unavailable" />;
  return <video src={src} aria-label={alt} className={className} controls={controls}
    muted={!controls} playsInline preload="metadata" onError={() => setFailed(true)} data-media-kind="video" />;
}
