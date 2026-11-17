import {useCallback,useEffect,useRef,useState} from "react";
import {ArchiveEngine} from "@/reel/archiveEngine";
import {loadArchiveAssets} from "@/reel/archiveAssets";
import {projectTransition,relatedWorks} from "@/reel/archiveExperience";

const SEEN_KEY="kutuzov-immersive-archive-entered-v2";
function readSeen(){
  try{return window.localStorage.getItem(SEEN_KEY)==="1";}
  catch{return false;}
}
function markSeen(){
  try{window.localStorage.setItem(SEEN_KEY,"1");}catch{/* optional storage */}
}

export function useReel(){
  const canvasRef=useRef(null);
  const engineRef=useRef(null);
  const selectedRef=useRef(null);
  const [returning]=useState(readSeen);
  const [assets,setAssets]=useState(null);
  const [ready,setReady]=useState(false);
  const [introComplete,setIntroComplete]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [hover,setHover]=useState(null);
  const [selected,setSelectedState]=useState(null);
  const [transition,setTransition]=useState("cross");
  const [filter,setFilterState]=useState("ALL");

  useEffect(()=>{
    let alive=true;
    loadArchiveAssets(p=>alive&&setProgress(p))
      .then(data=>alive&&setAssets(data))
      .catch(e=>alive&&setError(e?.message||"Falha ao abrir o arquivo."));
    return ()=>{alive=false;};
  },[]);

  useEffect(()=>{
    if(!assets||!canvasRef.current)return;
    let alive=true,engine;
    try{
      engine=new ArchiveEngine(canvasRef.current,assets,{returning});
      engineRef.current=engine;
      engine.explore.onHover=it=>{if(alive)setHover(it);};
      engine.onIntroComplete=()=>{
        if(!alive)return;
        markSeen();setIntroComplete(true);
      };
      engine.start();setReady(true);
    }catch(e){
      if(engine){engine.dispose();engineRef.current=null;}
      if(alive)setError(e?.message||"Não foi possível iniciar a exploração 3D.");
    }
    return ()=>{
      alive=false;
      if(engine){engine.dispose();engineRef.current=null;}
    };
  },[assets,returning]);

  const setSelected=useCallback(item=>{
    const engine=engineRef.current;
    if(!engine||!engine.introComplete)return;
    const next=item||null;
    setTransition(projectTransition(selectedRef.current,next));
    engine.explore.select(next);
    selectedRef.current=next;
    setSelectedState(next);
  },[]);

  const setFilter=useCallback(next=>{
    const engine=engineRef.current;
    if(!engine||!engine.introComplete)return;
    if(selectedRef.current){
      engine.explore.select(null);
      selectedRef.current=null;setSelectedState(null);
    }
    engine.explore.filter=next;setFilterState(next);
  },[]);

  const resetView=useCallback(()=>{
    const engine=engineRef.current,ex=engine?.explore;
    if(!ex||!engine.introComplete)return;
    ex.select(null);
    selectedRef.current=null;setSelectedState(null);
    ex.tYaw=.6;ex.tPitch=.72;ex.tDist=19;ex.idle=0;
    setFilterState("ALL");ex.filter="ALL";
  },[]);

  const pointer=useCallback((type,x,y,extra)=>{
    const engine=engineRef.current;
    if(!engine)return;
    if(type==="move")engine.aperture.pointer(x,y);
    if(!engine.introComplete||selectedRef.current)return;
    const ex=engine.explore;
    if(type==="move"){ex.pointer(x,y);ex.move(x,y);}
    else if(type==="down"){ex.pointer(x,y);ex.down(x,y,extra);}
    else if(type==="up"){
      const item=ex.up(x,y,extra);
      if(item){
        setTransition("cross");
        ex.select(item);selectedRef.current=item;setSelectedState(item);
      }
    }
    else if(type==="leave"){ex.pointer(9,9);ex.cancelDrag();}
    else if(type==="wheel")ex.wheel(extra);
    else if(type==="key"){
      ex.tYaw+=x;
      ex.tPitch=Math.max(-1.2,Math.min(1.35,ex.tPitch+y));
      ex.idle=0;
    }
  },[]);

  const items=assets?.catalog?.items||[];
  const suggestions=relatedWorks(items,selected,4);
  const navigateSelected=useCallback(direction=>{
    if(!selectedRef.current||!assets?.catalog?.items)return;
    const source=assets.catalog.items;
    const same=source.filter(x=>x.cat===selectedRef.current.cat);
    if(!same.length)return;
    const i=same.findIndex(x=>x.id===selectedRef.current.id);
    const next=same[(i+direction+same.length)%same.length];
    setSelected(next);
  },[assets,setSelected]);

  return {canvasRef,ready,introComplete,returning,progress,error,
    hover,selected,setSelected,filter,setFilter,resetView,pointer,mode:"explore",
    suggestions,navigateSelected,transition,items,
    atlasColumns:assets?.catalog?.cols||10,atlasRows:assets?.catalog?.rows||8};
}
