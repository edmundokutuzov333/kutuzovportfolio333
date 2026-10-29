import { useState } from "react";

type SafeAssetImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  loading?: "eager" | "lazy";
};

export function SafeAssetImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = "Image unavailable",
  loading = "lazy",
}: SafeAssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={fallbackClassName ?? className}
        role="img"
        aria-label={`${alt}: ${fallbackLabel}`}
        data-asset-state="unavailable"
      >
        <span className="eyebrow text-muted-foreground">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
