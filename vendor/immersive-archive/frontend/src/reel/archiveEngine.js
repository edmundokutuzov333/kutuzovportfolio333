import * as THREE from "three";
import { C } from "./core";
import { Cloud } from "./cloud";
import { Explore } from "./explore";
import { HighResLayer } from "./highResLayer";
import { ApertureSequence } from "./apertureSequence";
import { SpatialAccents } from "./spatialAccents";
import { LivingFrames } from "./livingFrames";
import { introDuration, clamp01 } from "./apertureTimeline";

/**
 * Standalone, single-pass WebGL archive. No film timeline, score,
 * post-processing targets or high-resolution film assets.
 */
/**
 * Cap physical pixels without reducing a 4K desktop to a 1600px canvas.
 * Values are physical backbuffer pixels, not CSS layout dimensions.
 */
export function getRenderSize(width, height, devicePixelRatio=1, mobile=false) {
  const dpr = Math.min(Math.max(1, devicePixelRatio || 1), 2);
  const maxWidth = mobile ? 2400 : 4096;
  const maxHeight = mobile ? 2600 : 2304;
  const ratio = Math.min(dpr, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(2, Math.round(width * ratio)),
    height: Math.max(2, Math.round(height * ratio))
  };
}

export class ArchiveEngine {
  constructor(canvas, assets, { returning=false } = {}) {
    this.canvas=canvas;
    this.A=assets;
    this.renderer=new THREE.WebGLRenderer({
      canvas, alpha:false, antialias:true, powerPreference:"high-performance",
      preserveDrawingBuffer:false
    });
    this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(C.bg);
    this.scene.fog=new THREE.Fog(C.bg,8,70);
    this.camera=new THREE.PerspectiveCamera(42,1,.1,300);
    this.cloud=new Cloud(assets.catalog,assets.atlases);
    this.scene.add(this.cloud.group);
    this.details=new HighResLayer(this.cloud,this.scene);
    this.explore=new Explore(this);
    this.explore.dist=19;
    this.explore.tDist=19;
    this.explore.pitch=.72;
    this.explore.yaw=.6;
    this.mobile=window.matchMedia("(pointer:coarse)").matches;
    this.reduced=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    this.accents=new SpatialAccents(this.scene,{mobile:this.mobile,reduced:this.reduced});
    this.living=new LivingFrames(this.cloud,this.scene,{mobile:this.mobile,reduced:this.reduced});
    this.aperture=new ApertureSequence(this.scene,this.camera);
    this.introDuration=introDuration({returning,reduced:this.reduced});
    this.introElapsed=this.reduced?this.introDuration:0;
    this.introComplete=false;
    this.onIntroComplete=null;
    this.onHover=null;
    this.disposed=false;
    this.frameHandle=0;
    this.lastFrame=0;
    this.running=false;
    this.resize=()=>{
      if(this.disposed)return;
      const bounds=this.canvas.getBoundingClientRect();
      const width=Math.max(1,bounds.width),height=Math.max(1,bounds.height);
      // The canvas uses an explicit physical size; avoid double-applying DPR.
      const size=getRenderSize(width,height,window.devicePixelRatio,this.mobile);
      this.renderer.setSize(size.width,size.height,false);
      this.camera.aspect=width/height;
      this.camera.updateProjectionMatrix();
    };
    this.observer=new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
    this.onVisibility=()=>{
      if(!document.hidden && !this.disposed){this.lastFrame=0;this.start();}
      else this.stop();
    };
    document.addEventListener("visibilitychange",this.onVisibility);
  }

  start() {
    if(this.running||this.disposed||document.hidden)return;
    this.running=true;
    const budget=this.reduced?1000/30:this.mobile?1000/45:1000/60;
    const loop=(now)=>{
      if(!this.running||this.disposed)return;
      this.frameHandle=requestAnimationFrame(loop);
      if(now-this.lastFrame<budget-.5)return;
      const dt=Math.min(.05,Math.max(.001,(now-(this.lastFrame||now-16))/1000));
      this.lastFrame=now;
      if(!this.introComplete)this.introElapsed=Math.min(this.introDuration,this.introElapsed+dt);
      const progress=this.introComplete?1:clamp01(this.introElapsed/this.introDuration);
      this.explore.frame(dt,progress);
      if(!this.introComplete)this.aperture.update(progress,this.introElapsed);
      this.renderer.render(this.scene,this.camera);
      if(!this.introComplete&&progress>=1){
        // The final cinematic frame is the explorer's first frame.
        this.introComplete=true;
        this.aperture.finish();
        this.onIntroComplete?.();
      }
    };
    this.frameHandle=requestAnimationFrame(loop);
  }
  stop(){this.running=false;cancelAnimationFrame(this.frameHandle);this.frameHandle=0;}
  dispose(){
    if(this.disposed)return;
    this.stop();this.disposed=true;
    this.observer.disconnect();
    document.removeEventListener("visibilitychange",this.onVisibility);
    this.living.dispose();
    this.accents.dispose();
    this.details.dispose();
    this.aperture.dispose();
    this.cloud.meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});
    this.A.atlases.forEach(t=>t.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
