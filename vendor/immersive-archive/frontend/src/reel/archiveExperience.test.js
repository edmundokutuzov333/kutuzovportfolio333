import * as THREE from "three";
import {sameProject,projectTransition,relatedWorks,orbitalDrift,
  depthVisibility,spatialPartners,canPreviewVideo,atlasTile} from "./archiveExperience";
import {Explore} from "./explore";
import {SpatialAccents} from "./spatialAccents";
import {LivingFrames} from "./livingFrames";

const items=[
 {id:1,title:"A",cat:"CAMPAIGN",brand:"ALPHA",atlas:0,cell:0},
 {id:2,title:"B",cat:"CAMPAIGN",brand:"ALPHA",atlas:0,cell:1},
 {id:3,title:"C",cat:"CAMPAIGN",brand:"BETA",atlas:0,cell:2},
 {id:4,title:"D",cat:"DESIGN",brand:"",atlas:0,cell:3},
 {id:5,title:"E",cat:"VIDEO",brand:"",atlas:1,cell:70,video:true},
 {id:6,title:"F",cat:"DESIGN",brand:"",atlas:0,cell:4},
];

describe("nine approved archive improvements",()=>{
  test("03: true related works connect by real metadata, not invented campaign titles",()=>{
    expect(sameProject(items[0],items[1])).toBe(true);
    expect(sameProject(items[0],items[2])).toBe(false);
    expect(relatedWorks(items,items[0],2).map(x=>x.id)).toEqual([2,3]);
    const positions=items.map((_,i)=>new THREE.Vector3(i*2,0,0));
    expect(spatialPartners(items,positions,0,5)).toEqual([1,2]);
    expect(spatialPartners(items,positions,4,5)).toEqual([]);
  });
  test("04: spatial accents are independent disposable scene objects",()=>{
    const scene=new THREE.Scene(),before=scene.children.length;
    const accents=new SpatialAccents(scene);
    expect(scene.children.length).toBe(before+2);
    accents.update(.016,items,items.map((_,i)=>new THREE.Vector3(i,0,0)),
      new THREE.PerspectiveCamera(),0,false);
    expect(accents.halo.visible).toBe(true);
    expect(accents.geometry.drawRange.count).toBe(4);
    accents.dispose();
    expect(scene.children.length).toBe(before);
  });
  test("06: automatic orbit is paused while focused, hovered, dragged or reduced motion",()=>{
    const idle={idle:12};
    expect(orbitalDrift(1/60,idle)).toBeGreaterThan(0);
    expect(orbitalDrift(1/60,{...idle,selected:true})).toBe(0);
    expect(orbitalDrift(1/60,{...idle,hover:0})).toBe(0);
    expect(orbitalDrift(1/60,{...idle,dragging:true})).toBe(0);
    expect(orbitalDrift(1/60,{...idle,reduced:true})).toBe(0);
    expect(orbitalDrift(1/60,{idle:3})).toBe(0);
    expect(orbitalDrift(1/60,idle)).toBeLessThan(.0002);
  });
  test("07: distance attenuates smoothly but never hides a painting",()=>{
    const depths=[0,10,20,40,90].map(depthVisibility);
    expect(depths[0]).toBe(1);
    expect(depths[4]).toBeGreaterThanOrEqual(.55);
    depths.forEach((d,i)=>{if(i)expect(d).toBeLessThanOrEqual(depths[i-1]);});
  });
  test("08: a video preview requires deliberate, visible, unrestricted desktop hover",()=>{
    const item=items[4];
    expect(canPreviewVideo({item,dwell:.4,pixels:72})).toBe(true);
    expect(canPreviewVideo({item,dwell:.2,pixels:72})).toBe(false);
    expect(canPreviewVideo({item,dwell:.4,pixels:12})).toBe(false);
    expect(canPreviewVideo({item,dwell:.4,pixels:72,desktop:false})).toBe(false);
    expect(canPreviewVideo({item,dwell:.4,pixels:72,saveData:true})).toBe(false);
    expect(canPreviewVideo({item,dwell:.4,pixels:72,reduced:true})).toBe(false);
    expect(canPreviewVideo({item,dwell:.4,pixels:72,selected:true})).toBe(false);
    expect(canPreviewVideo({item:items[0],dwell:.4,pixels:72})).toBe(false);
    const preview=new LivingFrames({items,slot:[]},new THREE.Scene(),{mobile:true});
    preview.dispose();
  });
  test("13: transitions distinguish the same project from discipline and cross-category",()=>{
    expect(projectTransition(items[0],items[1])).toBe("project");
    expect(projectTransition(items[0],items[2])).toBe("discipline");
    expect(projectTransition(items[0],items[3])).toBe("cross");
  });
  test("15: opening and leaving a work preserves the exact discovery snapshot",()=>{
    const ex=new Explore({A:{catalog:{items}},canvas:{
      getBoundingClientRect:()=>({width:1280,height:720})}});
    ex.yaw=1.2;ex.pitch=.45;ex.dist=14;ex.time=5.5;
    ex.tYaw=1.3;ex.tPitch=.5;ex.tDist=13;
    ex.select(items[0]);
    expect(ex.selectedIndex).toBe(0);
    ex.select(items[1]);
    expect(ex.discoverySnapshot.time).toBe(5.5);
    ex.yaw=9;ex.time=99;
    ex.select(null);
    expect(ex.selectedIndex).toBe(-1);
    expect(ex.yaw).toBe(1.2);
    expect(ex.pitch).toBe(.45);
    expect(ex.dist).toBe(14);
    expect(ex.time).toBe(5.5);
    expect(ex.discoverySnapshot).toBeNull();
  });
  test("17: tap/click computes selection at release with larger touch threshold",()=>{
    const ex=new Explore({A:{catalog:{items}},canvas:{
      getBoundingClientRect:()=>({width:1000,height:800})}});
    const pick=jest.spyOn(ex,"pick").mockReturnValue(items[4]);
    ex.down(.3,.4,"touch");
    ex.move(.306,.4); // 6px: valid tap
    expect(ex.up(.305,.405,"touch")).toEqual(items[4]);
    expect(pick).toHaveBeenCalledWith(.305,.405,{touch:true});
    pick.mockClear();
    ex.down(.3,.4,"mouse");
    ex.move(.32,.4); // 20px: drag, never a click
    expect(ex.up(.32,.4,"mouse")).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });
  test("20: archive rail uses actual atlas cells even for videos without images",()=>{
    const thumb=atlasTile(items[4],10,8);
    expect(thumb.backgroundImage).toContain("atlas1.webp");
    expect(thumb.backgroundSize).toBe("1000% 800%");
    expect(thumb.backgroundPosition).toContain("100%");
    expect(relatedWorks(items,items[4],4)).toHaveLength(4);
  });
});
