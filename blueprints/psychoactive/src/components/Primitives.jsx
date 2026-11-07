import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { resolvePublicAssetUrl } from "../../../../src/lib/public-assets";
import { copy } from "../lib/content";
export function Reveal({ children, className = "" }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -5% 0px" }}
    transition={{ duration: .45, ease: [.16, 1, .3, 1] }}>{children}</motion.div>;
}
export function OriginalMark({ className = "", label = "Símbolo geométrico original" }) {
  const id = useId().replace(/:/g, "");
  return <svg className={className} viewBox="0 0 400 400" role="img" aria-labelledby={id}>
    <title id={id}>{label}</title>
    <defs><radialGradient id={id+"-g"}><stop stopColor="#71cff7"/><stop offset="1" stopColor="#136df4"/></radialGradient>
      <pattern id={id+"-p"} width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.5" fill="white"/></pattern>
      <mask id={id+"-m"}><rect width="400" height="400" fill={"url(#"+id+"-p)"}/></mask></defs>
    <circle cx="200" cy="200" r="165" fill={"url(#"+id+"-g)"} mask={"url(#"+id+"-m)"}/>
    <ellipse cx="200" cy="200" rx="184" ry="62" fill="none" stroke="currentColor" opacity=".3" transform="rotate(-30 200 200)"/>
    <circle cx="360" cy="110" r="5" fill="currentColor"/>
  </svg>;
}
export function SafeImage({ source, alt = "", className = "", priority = false }) {
  const url = resolvePublicAssetUrl(source);
  const [failed, setFailed] = useState("");
  if (!url || failed === url) return <div className={"asset-placeholder "+className} role="img" aria-label={alt || copy.assetUnavailable}>
    <OriginalMark/><span>{copy.assetUnavailable}</span></div>;
  return <img className={className} src={url} alt={alt} loading={priority ? "eager" : "lazy"}
    decoding="async" fetchPriority={priority ? "high" : "auto"} onError={()=>setFailed(url)} />;
}
export function BadgePlaceholder({ label }) {
  return <div className="badge-placeholder" role="img" aria-label={label+" — lugar reservado"}>
    <svg viewBox="0 0 64 64" aria-hidden><path d="M32 5 39 22 57 24 43 36 47 54 32 44 17 54 21 36 7 24 25 22Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
    <span>{label}</span><small>por confirmar</small>
  </div>;
}
