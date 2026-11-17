import * as THREE from "three";
import { makePoses, pose, galaxyPose } from "./formations";
import { introPose, artworkReveal } from "./apertureTimeline";
import { depthVisibility, orbitalDrift } from "./archiveExperience";

const ORIGIN = new THREE.Vector3();

/** Archive camera, its discovery snapshot and exact pointer-to-instance picking. */
export class Explore {
  constructor(engine){
    this.e=engine;
    this.items=engine.A.catalog.items;
    this.P=makePoses(this.items.length,11);
    this.o=pose();
    this.positions=this.items.map(()=>new THREE.Vector3());
    this.yaw=.6;this.pitch=.72;this.dist=19;
    this.tYaw=.6;this.tPitch=.72;this.tDist=19;
    this.filter="ALL";this.hover=-1;
    this.ndc=new THREE.Vector2(9,9);
    this.sampleNdc=new THREE.Vector2();
    this.ray=new THREE.Raycaster();
    this.scales=new Float32Array(this.items.length).fill(1);
    this.dims=new Float32Array(this.items.length).fill(.9);
    this.drag=null;this.idle=0;this.time=0;this.hoverClock=0;
    this.lookDirection=new THREE.Vector3();
    this.onHover=null;
    this.selectedIndex=-1;
    this.discoverySnapshot=null;
  }

  pointer(nx,ny){this.ndc.set(nx*2-1,1-ny*2);}

  down(x,y,pointerType="mouse"){
    if(this.selectedIndex>=0)return;
    this.drag={x,y,yaw:this.tYaw,pitch:this.tPitch,
      pointerType,moved:false};
  }
  move(x,y){
    if(!this.drag||this.selectedIndex>=0)return;
    const dx=x-this.drag.x,dy=y-this.drag.y;
    const bounds=this.e.canvas.getBoundingClientRect();
    const distance=Math.hypot(dx*bounds.width,dy*bounds.height);
    const threshold=this.drag.pointerType==="touch"?12:6;
    if(distance>threshold)this.drag.moved=true;
    if(!this.drag.moved)return;
    this.tYaw=this.drag.yaw-dx*5.5;
    this.tPitch=Math.max(-1.2,Math.min(1.35,this.drag.pitch+dy*4.25));
    this.idle=0;
  }
  cancelDrag(){this.drag=null;}

  /** Always raycast the UP position, never trust a throttled hover result. */
  pick(x,y,{touch=false}={}){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return null;
    const cam=this.e.camera,cloud=this.e.cloud;
    cam.updateMatrixWorld(true);
    cloud.group.updateMatrixWorld(true);
    const from=(sx,sy)=>{
      this.sampleNdc.set(sx*2-1,1-sy*2);
      this.ray.setFromCamera(this.sampleNdc,cam);
      const hits=this.ray.intersectObjects(cloud.meshes,false);
      for(const hit of hits){
        const idx=cloud.indexFromHit(hit.object,hit.instanceId);
        const it=this.items[idx];
        if(it && (this.filter==="ALL"||it.cat===this.filter)
          && this.dims[idx]>.24) return it;
      }
      return null;
    };
    const direct=from(x,y);
    if(direct||!touch)return direct;
    // 10px directional tolerance for small touch targets, without guesswork.
    const rect=this.e.canvas.getBoundingClientRect();
    const dx=10/Math.max(1,rect.width),dy=10/Math.max(1,rect.height);
    for(const [ox,oy] of [[dx,0],[-dx,0],[0,dy],[0,-dy]]){
      const hit=from(x+ox,y+oy);
      if(hit)return hit;
    }
    return null;
  }
  up(x,y,pointerType="mouse"){
    const clicked=Boolean(this.drag&&!this.drag.moved);
    this.drag=null;
    if(!clicked||this.selectedIndex>=0)return null;
    this.pointer(x,y);
    const item=this.pick(x,y,{touch:pointerType==="touch"});
    if(item){
      this.hover=this.items.findIndex(it=>it.id===item.id);
      this.onHover?.(item);
    }
    return item;
  }
  wheel(d){
    if(this.selectedIndex>=0)return;
    this.tDist=Math.max(5,Math.min(34,this.tDist*(1+d*.0017)));
    this.idle=0;
  }

  /** Do not move the gallery while an artwork is open; return to this exact pose. */
  select(item){
    if(item){
      if(!this.discoverySnapshot){
        this.discoverySnapshot={yaw:this.yaw,pitch:this.pitch,dist:this.dist,
          tYaw:this.tYaw,tPitch:this.tPitch,tDist:this.tDist,
          time:this.time,filter:this.filter};
      }
      this.selectedIndex=this.items.findIndex(x=>x.id===item.id);
      this.hover=-1;
      this.onHover?.(null);
    }else{
      const s=this.discoverySnapshot;
      if(s){
        Object.assign(this,s);
        this.filter=s.filter;
      }
      this.discoverySnapshot=null;this.selectedIndex=-1;
      this.hover=-1;
      this.idle=0;this.onHover?.(null);
    }
  }

  frame(dt,introProgress=1){
    const e=this.e,entering=introProgress<1;
    const focused=this.selectedIndex>=0;
    if(!focused){
      this.time+=dt*(entering?.42:1);
      if(!entering)this.idle+=dt;
    }
    this.hoverClock+=dt;
    if(!entering){
      this.tYaw+=orbitalDrift(dt,{
        idle:this.idle,hover:this.hover,dragging:Boolean(this.drag),
        selected:focused,reduced:e.reduced
      });
    }
    const k=1-Math.exp(-dt*10);
    if(!entering&&!focused){
      this.yaw+=(this.tYaw-this.yaw)*k;
      this.pitch+=(this.tPitch-this.pitch)*k;
      this.dist+=(this.tDist-this.dist)*k;
    }
    const cam=e.camera;
    const intro=introPose(introProgress,e.aperture.pointerX,e.aperture.pointerY);
    const yaw=entering?intro.yaw:this.yaw;
    const pitch=entering?intro.pitch:this.pitch;
    const distance=entering?intro.distance:this.dist;
    const cp=Math.cos(pitch);
    cam.position.set(Math.sin(yaw)*cp*distance,Math.sin(pitch)*distance,
      Math.cos(yaw)*cp*distance);
    cam.lookAt(0,0,0);
    if(cam.fov!==42){cam.fov=42;cam.updateProjectionMatrix();}
    e.scene.fog.near=8;e.scene.fog.far=70;
    const cloud=e.cloud;
    this.items.forEach((it,i)=>{
      galaxyPose(this.P[i],this.time*.5,cam.quaternion,this.o,ORIGIN);
      const match=this.filter==="ALL"||it.cat===this.filter;
      const target=i===this.selectedIndex?i:this.hover;
      const active=i===target;
      const depth=depthVisibility(cam.position.distanceTo(this.o.p));
      const ts=active?1.48:match?.94+.06*depth:.55;
      const td=active?1.07:match?.92*depth:.16;
      this.scales[i]+=(ts-this.scales[i])*(1-Math.exp(-dt*9));
      this.dims[i]+=(td-this.dims[i])*(1-Math.exp(-dt*8));
      if(entering){
        const appear=artworkReveal(introProgress,this.P[i].rnd2);
        this.o.p.multiplyScalar(appear).addScaledVector(this.P[i].dir,
          (1-appear)*(.18+this.P[i].rnd));
        this.o.s*=Math.max(.001,appear);
        this.o.d*=appear;
      }else if(i===target){
        this.o.p.addScaledVector(cam.getWorldDirection(this.lookDirection),-.34);
      }
      this.positions[i].copy(this.o.p);
      cloud.set(i,this.o.p,this.o.q,this.o.s*this.scales[i],this.o.d*(this.dims[i]/.92));
    });
    cloud.commit(e.scene.fog);
    cam.updateMatrixWorld(true);
    cloud.group.updateMatrixWorld(true);
    const anchor=focused?this.selectedIndex:this.hover;
    e.accents?.update(dt,this.items,this.positions,cam,entering?-1:anchor,focused);
    if(introProgress>.86)e.details.frame(cam,entering?-1:anchor,e.mobile,
      e.canvas.getBoundingClientRect().height);
    if(!entering)e.living?.update(dt,{
      hover:this.hover,selected:focused,camera:cam,
      viewportHeight:e.canvas.getBoundingClientRect().height
    });
    if(entering||focused||this.hoverClock<1/30)return;
    this.hoverClock=0;
    const h=this.pick((this.ndc.x+1)/2,(1-this.ndc.y)/2);
    const idx=h?this.items.findIndex(it=>it.id===h.id):-1;
    if(idx!==this.hover){this.hover=idx;this.onHover?.(h);}
  }
}
