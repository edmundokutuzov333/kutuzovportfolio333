import {forwardRef,useRef} from "react";
import ExploreOverlay from "@/components/reel/ExploreOverlay";

const Stage=forwardRef(function Stage({r},ref){
  const pinch=useRef(null);
  const pos=(event)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX-rect.left)/Math.max(1,rect.width),
      (event.clientY-rect.top)/Math.max(1,rect.height)
    ];
  };
  return <section ref={ref} data-testid="reel-stage"
    className="cinema-stage cinema-stage--explore"
    aria-label="Exploração interactiva do arquivo de arte"
    onPointerMove={e=>{if(!pinch.current)r.pointer("move",...pos(e));}}
    onPointerDown={e=>{
      if(!r.introComplete||pinch.current||!e.isPrimary||(e.button!==undefined&&e.button!==0))return;
      if(e.target.tagName!=="CANVAS"&&e.target!==e.currentTarget)return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      r.pointer("down",...pos(e),e.pointerType);
    }}
    onPointerUp={e=>{
      if(!r.introComplete||!e.isPrimary)return;
      if(pinch.current)r.pointer("leave",0,0);
      else r.pointer("up",...pos(e),e.pointerType);
      if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }}
    onPointerCancel={()=>r.pointer("leave",0,0)}
    onPointerLeave={()=>r.pointer("leave",0,0)}
    onWheel={e=>{if(r.introComplete){e.preventDefault();r.pointer("wheel",0,0,e.deltaY);}}}
    onTouchStart={e=>{
      if(e.touches.length===2){
        pinch.current=Math.hypot(
          e.touches[0].clientX-e.touches[1].clientX,
          e.touches[0].clientY-e.touches[1].clientY);
        r.pointer("leave",0,0); // pinch must never be interpreted as a tap
      }
    }}
    onTouchMove={e=>{
      if(e.touches.length!==2||!pinch.current||!r.introComplete)return;
      const distance=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY);
      r.pointer("wheel",0,0,(pinch.current-distance)*2);
      pinch.current=distance;
    }}
    onTouchEnd={()=>{pinch.current=null;}}
  >
    <canvas ref={r.canvasRef} data-testid="reel-canvas" className="cinema-canvas"/>
    {r.introComplete&&<ExploreOverlay r={r}/>}
  </section>;
});
export default Stage;
