import { forwardRef, useRef } from "react";
import ExploreOverlay from "@/components/reel/ExploreOverlay";

/**
 * Pointer Events are the single source of gesture truth on desktop and mobile.
 * One contact or mouse = orbit / accurate tap selection.
 * Two contacts = camera dolly (pinch-to-zoom), never an accidental selection.
 * The selected artwork is a separate scrollable DOM sheet.
 */
const Stage = forwardRef(function Stage({r},ref){
  const contacts = useRef(new Map());
  const previousPinch = useRef(null);
  const relative = event => {
    const box=event.currentTarget.getBoundingClientRect();
    return [(event.clientX-box.left)/Math.max(1,box.width),
      (event.clientY-box.top)/Math.max(1,box.height)];
  };
  const distance = () => {
    const values=[...contacts.current.values()];
    return values.length<2 ? 0 :
      Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
  };
  const down = event => {
    if(!r.introComplete || (event.button!==undefined&&event.button!==0))return;
    if(event.target.tagName!=="CANVAS")return;
    const point=relative(event);
    contacts.current.set(event.pointerId,{x:event.clientX,y:event.clientY,p:point});
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* browser may revoke capture */}
    if(contacts.current.size===1){
      previousPinch.current=null;
      r.pointer("down",...point,event.pointerType);
    }else{
      previousPinch.current=distance();
      r.pointer("leave",0,0); // never select during a two-finger gesture
    }
  };
  const move = event => {
    const point=relative(event);
    if(contacts.current.has(event.pointerId)){
      contacts.current.set(event.pointerId,{x:event.clientX,y:event.clientY,p:point});
    }
    if(contacts.current.size>=2){
      const current=distance();
      if(previousPinch.current!==null && current>1){
        const delta=previousPinch.current-current;
        // Fine, proportional dolly control; the engine clamps its own camera range.
        r.pointer("wheel",0,0,delta*2.2);
      }
      previousPinch.current=current;
    }else{
      r.pointer("move",...point);
    }
  };
  const end = (event,cancelled=false) => {
    const old=contacts.current.size;
    const hadPinch=previousPinch.current!==null || old>=2;
    const point=relative(event);
    contacts.current.delete(event.pointerId);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId)){
      try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* capture already gone */}
    }
    if(hadPinch){
      r.pointer("leave",0,0);
      if(contacts.current.size===1){
        previousPinch.current=null;
        const remaining=[...contacts.current.values()][0];
        r.pointer("down",...remaining.p,"touch"); // smooth resume without ghost tap
      }else if(contacts.current.size>=2){
        previousPinch.current=distance();
      }else previousPinch.current=null;
      return;
    }
    if(cancelled)r.pointer("leave",0,0);
    else r.pointer("up",...point,event.pointerType);
    if(contacts.current.size===0)previousPinch.current=null;
  };
  return <section ref={ref} data-testid="reel-stage"
    className="cinema-stage cinema-stage--explore"
    aria-label="Exploração interactiva do arquivo de arte"
    onPointerDown={down}
    onPointerMove={move}
    onPointerUp={event=>end(event)}
    onPointerCancel={event=>end(event,true)}
    onPointerLeave={()=>{if(!contacts.current.size)r.pointer("leave",0,0);}}
    onWheel={event=>{if(r.introComplete)r.pointer("wheel",0,0,event.deltaY);}}
  >
    <canvas ref={r.canvasRef} data-testid="reel-canvas" className="cinema-canvas" />
    {r.introComplete&&<ExploreOverlay r={r}/>}
  </section>;
});
export default Stage;
