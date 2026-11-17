"use client";

type Props={ready:boolean;progress:number};

/** Loading curtain only; no shortcut controls, no second WebGL renderer. */
export default function PortalIntro({ready,progress}:Props){
  return <>
    <div className={"portal-boot"+(ready?" portal-boot--release":"")}
      data-testid="archive-portal" aria-hidden={ready}>
      <div className="portal-boot__core" aria-hidden="true"><i/><i/><i/></div>
      {!ready&&<div className="portal-boot__status" role="status" aria-live="polite">
        A PREPARAR O ARQUIVO
        <span className="portal-boot__progress" aria-label={`${Math.round(progress*100)}% carregado`}/>
      </div>}
    </div>
    <div className="portal-hud" aria-label="Entrada cinematográfica">
      <span className="portal-hud__brand">EK <span> / </span> IMMERSIVE ARCHIVE</span>
    </div>
  </>;
}
