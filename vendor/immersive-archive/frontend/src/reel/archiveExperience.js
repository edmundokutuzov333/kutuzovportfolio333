import { clamp01, smooth01 } from "./apertureTimeline";

/** Verified catalogue metadata only; never infer a campaign relationship from a title. */
export function sameProject(a,b){
  return Boolean(a?.brand && b?.brand && a.cat===b.cat &&
    a.brand.trim().toLowerCase()===b.brand.trim().toLowerCase());
}

export function projectTransition(a,b){
  if(sameProject(a,b))return "project";
  if(a?.cat && a.cat===b?.cat)return "discipline";
  return "cross";
}

/** Stable, deterministic order. One limited rail; no artificial metadata. */
export function relatedWorks(items,item,limit=4){
  if(!item||!Array.isArray(items)||limit<=0)return [];
  const index=items.findIndex(x=>x.id===item.id);
  return items.filter(x=>x.id!==item.id).map((work,i)=>({
    work,
    rank: (sameProject(item,work)?100:0)+(work.cat===item.cat?30:0)
      - Math.min(25,Math.abs(items.indexOf(work)-index))*.5,
    i
  })).sort((a,b)=>b.rank-a.rank||a.work.id-b.work.id)
    .slice(0,Math.max(0,Math.min(6,limit))).map(x=>x.work);
}

/** No forced orbit while examining a work or interacting with the canvas. */
export function orbitalDrift(dt,{idle=0,hover=-1,dragging=false,selected=false,reduced=false}={}){
  if(reduced||selected||dragging||hover>=0||idle<7)return 0;
  return Math.max(0,Math.min(.05,dt))*.008; // 0.008 radians/s: nearly imperceptible
}

/** Fade distant paintings gently without making any artwork invisible. */
export function depthVisibility(distance){
  return .55+.45*(1-smooth01((Math.max(0,distance)-10)/37));
}

/** Actual spatial neighbours from the current frame, bounded to short links. */
export function spatialPartners(items,positions,index,limit=5){
  const active=items[index],origin=positions[index];
  if(!active||!origin)return [];
  return items.map((it,i)=>{
    if(i===index||it.cat!==active.cat||!positions[i])return null;
    const d=origin.distanceTo(positions[i]);
    if(d>21)return null;
    return {index:i,dist:d,project:sameProject(active,it)};
  }).filter(Boolean)
    .sort((a,b)=>Number(b.project)-Number(a.project)||a.dist-b.dist||a.index-b.index)
    .slice(0,limit).map(x=>x.index);
}

export function canPreviewVideo({item,desktop=true,reduced=false,saveData=false,
  selected=false,dwell=0,pixels=0}={}){
  return Boolean(item?.video&&desktop&&!reduced&&!saveData&&!selected
    &&dwell>=.35&&pixels>=48);
}

/** CSS percentages for atlas cells: avoids requests for missing video thumbnails. */
export function atlasTile(item,cols=10,rows=8){
  if(!item||cols<2||rows<2)return {backgroundSize:"cover",backgroundPosition:"center"};
  return {
    backgroundImage:`url(${process.env.PUBLIC_URL||""}/reel/atlas${item.atlas}.webp)`,
    backgroundSize:`${cols*100}% ${rows*100}%`,
    backgroundPosition:`${(item.cell%cols)/(cols-1)*100}% ${Math.floor(item.cell/cols)/(rows-1)*100}%`
  };
}
