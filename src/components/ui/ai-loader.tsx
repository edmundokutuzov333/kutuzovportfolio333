import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import "./ai-loader.css";

/**
 * The supplied circular AI loader adapted into a real, accessible, floating
 * archive link. No full-screen overlay, timers, JavaScript animation loops,
 * image assets, network requests or additional dependencies.
 */
export interface LoaderProps {
  size?: number;
  text?: string;
  label?: string;
  eyebrow?: string;
  href?: string;
  ariaLabel?: string;
}

export const ARCHIVE_EXPERIENCE_URL = "/work/immersive/index.html";

export const Component: React.FC<LoaderProps> = ({
  size = 98,
  text = "ENTER",
  label = "IMMERSIVE ARCHIVE",
  eyebrow = "ENTER THE SPACE",
  href = ARCHIVE_EXPERIENCE_URL,
  ariaLabel = "Explore the immersive archive on this website",
}) => {
  const letters = Array.from(text);
  const orbSize = Number.isFinite(size) ? Math.max(80, Math.min(124, size)) : 98;
  const external = /^https?:\/\//i.test(href);

  return (
    <a
      data-testid="work-immersive-archive-link"
      className="ek-archive-cta"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      data-native-document={external ? undefined : "true"}
      aria-label={ariaLabel}
      data-cursor="Enter"
    >
      <span className="ek-archive-cta__copy" aria-hidden="true">
        <span className="ek-archive-cta__eyebrow">{eyebrow}</span>
        <span className="ek-archive-cta__label">{label}</span>
        <span className="ek-archive-cta__rule" />
      </span>
      <span
        className="ek-archive-cta__orb"
        style={{ "--ek-archive-orb-size": `${orbSize}px` } as React.CSSProperties}
        aria-hidden="true"
      >
        <span className="ek-archive-cta__lens" />
        <span className="ek-archive-cta__letters">
          {letters.map((letter, index) => (
            <span
              key={index}
              className="ek-archive-cta__letter"
              style={{ animationDelay: `${(index * 0.1).toFixed(1)}s` }}
            >
              {letter === " " ? "\u00a0" : letter}
            </span>
          ))}
        </span>
        <ArrowUpRight className="ek-archive-cta__arrow" size={14} strokeWidth={1.6} />
      </span>
    </a>
  );
};

Component.displayName = "ImmersiveArchiveCTA";
