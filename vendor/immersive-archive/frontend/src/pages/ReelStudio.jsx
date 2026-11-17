import {useCallback,useEffect,useRef,useState} from "react";
import {Maximize2,Minimize2,LocateFixed,ZoomIn,ZoomOut,Hand,
  MousePointer2,Move,HelpCircle} from "lucide-react";
import {useReel} from "@/hooks/useReel";
import Stage from "@/components/reel/Stage";
import PortalIntro from "@/components/ui/portal-intro";

function Tool({label,onClick,children,active=false}){
  return <button type="button" title={label} aria-label={label}
    onClick={onClick} className={"cinema-tool"+(active?" cinema-tool--active":"")}>
    {children}
  </button>;
}

export default function ReelStudio(){
  const [fullscreen,setFullscreen]=useState(false);
  const [showHelp,setShowHelp]=useState(true);
  const shellRef=useRef(null);
  const r=useReel();
  const {ready,introComplete,selected,setSelected,resetView,pointer}=r;
  const toggleFullscreen=useCallback(()=>{
    if(document.fullscreenElement){document.exitFullscreen?.().catch?.(()=>{});}
    else shellRef.current?.requestFullscreen?.().catch?.(()=>{});
  },[]);

  useEffect(()=>{
    const sync=()=>setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange",sync);
    return ()=>document.removeEventListener("fullscreenchange",sync);
  },[]);

  useEffect(()=>{
    if(!ready)return;
    const onKey=(event)=>{
      const target=event.target;
      if(target&&/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))return;
      if(!introComplete)return;
      if(event.key==="Escape"&&selected){setSelected(null);return;}
      if(event.key.toLowerCase()==="f"){toggleFullscreen();return;}
      if(event.key.toLowerCase()==="r"){resetView();return;}
      if(event.key==="?"||event.key.toLowerCase()==="h"){setShowHelp(v=>!v);return;}
      if(event.key==="+"||event.key==="="){pointer("wheel",0,0,-155);return;}
      if(event.key==="-"){pointer("wheel",0,0,155);return;}
      const arrows={
        ArrowLeft:[-.26,0],ArrowRight:[.26,0],
        ArrowUp:[0,-.19],ArrowDown:[0,.19]
      };
      if(arrows[event.key]){
        event.preventDefault();
        pointer("key",...arrows[event.key]);
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[ready,introComplete,pointer,resetView,selected,setSelected,toggleFullscreen]);

  return <main ref={shellRef} className="cinema-shell" data-testid="immersive-archive">
    <Stage r={r}/>
    {!r.introComplete&&<PortalIntro ready={r.ready} progress={r.progress}/>}
    {r.introComplete&&r.ready&&(
      <>
        <nav aria-label="Navegação do arquivo" className="cinema-toolbar">
          <Tool label="Aproximar" onClick={()=>r.pointer("wheel",0,0,-170)}>
            <ZoomIn size={19}/></Tool>
          <Tool label="Afastar" onClick={()=>r.pointer("wheel",0,0,170)}>
            <ZoomOut size={19}/></Tool>
          <Tool label="Centrar o arquivo" onClick={r.resetView}>
            <LocateFixed size={19}/></Tool>
          <Tool label={fullscreen?"Sair do ecrã inteiro":"Ecrã inteiro"}
            onClick={toggleFullscreen}>
            {fullscreen?<Minimize2 size={19}/>:<Maximize2 size={19}/>}
          </Tool>
        </nav>
        <button className="cinema-hint-toggle" data-testid="toggle-help"
          title={showHelp?"Ocultar instruções":"Mostrar instruções"}
          aria-label={showHelp?"Ocultar instruções":"Mostrar instruções"}
          onClick={()=>setShowHelp(v=>!v)}><HelpCircle size={19}/></button>
        {showHelp&&!r.selected&&<div className="cinema-gesture-guide" aria-label="Instruções de exploração">
          <span><Hand size={17}/><span>Arrastar</span></span>
          <span><ZoomIn size={17}/><span>Zoom</span></span>
          <span><MousePointer2 size={17}/><span>Seleccionar</span></span>
          <span><Move size={17}/><span>Setas</span></span>
        </div>}
      </>
    )}
    {r.error&&<div role="alert" className="cinema-error">
      <p>{r.error}</p>
      <button onClick={()=>window.location.reload()}>Tentar novamente</button>
    </div>}
  </main>;
}
