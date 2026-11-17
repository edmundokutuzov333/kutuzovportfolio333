import * as THREE from "three";
import { BASE_URL } from "./paths";
import { canPreviewVideo } from "./archiveExperience";

/**
 * One muted, off-DOM decoder and one VideoTexture, only for a hovered video.
 * No video bytes are fetched until 350ms of intentional desktop hover.
 */
export class LivingFrames{
  constructor(cloud,scene,{mobile=false,reduced=false}={}){
    this.cloud=cloud;this.scene=scene;this.mobile=mobile;this.reduced=reduced;
    this.saveData=Boolean(navigator.connection?.saveData);
    this.blocked=new Set();this.hover=-1;this.dwell=0;this.active=-1;
    this.disposed=false;this.video=null;this.texture=null;this.material=null;
    this.geometry=new THREE.PlaneGeometry(.8,1);
    this.mesh=null;this.matte=null;this.matteMaterial=null;this.token=0;
    this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();
    this.quaternion=new THREE.Quaternion();this.scale=new THREE.Vector3();
    this.forward=new THREE.Vector3();this.offset=new THREE.Vector3();
  }
  pixelsFor(index,camera,viewportHeight){
    const slot=this.cloud.slot[index];
    if(!slot)return 0;
    this.cloud.meshes[slot.a].getMatrixAt(slot.j,this.matrix);
    this.matrix.decompose(this.position,this.quaternion,this.scale);
    camera.getWorldDirection(this.forward);
    const depth=this.offset.subVectors(this.position,camera.position).dot(this.forward);
    if(depth<=.1)return 0;
    return this.scale.y*viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*depth);
  }
  start(index){
    this.stop();
    if(this.blocked.has(index)||this.disposed)return;
    const item=this.cloud.items[index];
    if(!item?.video)return;
    const token=++this.token;
    const video=document.createElement("video");
    video.muted=true;video.defaultMuted=true;video.loop=true;
    video.playsInline=true;video.preload="metadata";video.crossOrigin="anonymous";
    video.setAttribute("muted","");video.setAttribute("playsinline","");
    this.video=video;this.active=index;
    this.texture=new THREE.VideoTexture(video);
    this.texture.colorSpace=THREE.NoColorSpace;
    this.texture.minFilter=THREE.LinearFilter;
    this.texture.magFilter=THREE.LinearFilter;
    this.texture.generateMipmaps=false;
    this.material=new THREE.MeshBasicMaterial({
      map:this.texture,side:THREE.DoubleSide,depthWrite:false,
      fog:true,toneMapped:false
    });
    // Matte conceals the atlas poster when the live video has a different aspect ratio.
    this.matteMaterial=new THREE.MeshBasicMaterial({
      color:"#08101f",side:THREE.DoubleSide,depthWrite:false
    });
    this.matte=new THREE.Mesh(this.geometry,this.matteMaterial);
    this.matte.renderOrder=2;this.matte.frustumCulled=false;this.matte.visible=false;
    this.scene.add(this.matte);
    this.mesh=new THREE.Mesh(this.geometry,this.material);
    this.mesh.renderOrder=3;this.mesh.visible=false;this.mesh.frustumCulled=false;
    this.scene.add(this.mesh);
    video.onloadeddata=()=>{
      if(this.disposed||token!==this.token)return;
      this.mesh.visible=true;this.matte.visible=true;
      this.updatePose(index);
    };
    video.onerror=()=>{
      if(token===this.token){this.blocked.add(index);this.stop();}
    };
    video.src=`${BASE_URL}/vid/${item.id}.mp4`;
    const promise=video.play();
    promise?.catch?.(()=>{
      if(token===this.token){this.blocked.add(index);this.stop();}
    });
  }
  updatePose(index){
    if(!this.mesh||!this.cloud.slot[index])return;
    const {a,j}=this.cloud.slot[index];
    this.cloud.meshes[a].getMatrixAt(j,this.matrix);
    this.matrix.decompose(this.position,this.quaternion,this.scale);
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);
    this.mesh.scale.copy(this.scale);
    const aspect=(this.video?.videoWidth&&this.video?.videoHeight)
      ?this.video.videoWidth/this.video.videoHeight
      :Number(this.cloud.items[index].ar)||.8;
    this.mesh.scale.x*=Math.max(.35,Math.min(2.2,aspect))/.8;
    this.mesh.translateZ(.019*this.scale.y);
    if(this.matte){
      this.matte.position.copy(this.position);
      this.matte.quaternion.copy(this.quaternion);
      this.matte.scale.copy(this.scale);
      this.matte.translateZ(.013*this.scale.y);
    }
    this.material.color.setScalar(Math.max(.3,
      this.cloud.meshes[a].geometry.attributes.aDim.getX(j)));
  }
  update(dt,{hover=-1,selected=false,camera,viewportHeight=1080}={}){
    if(this.disposed)return;
    if(this.mobile||this.reduced||this.saveData||selected){
      this.stop();this.hover=-1;this.dwell=0;return;
    }
    const item=this.cloud.items[hover];
    if(hover!==this.hover){
      this.hover=hover;this.dwell=0;
      if(hover!==this.active)this.stop();
    }
    if(!item?.video||this.blocked.has(hover)){
      if(this.active>=0)this.stop();
      return;
    }
    const pixels=this.pixelsFor(hover,camera,viewportHeight);
    this.dwell+=Math.max(0,Math.min(dt,.05));
    if(!canPreviewVideo({item,desktop:true,dwell:this.dwell,pixels}))return;
    if(this.active!==hover)this.start(hover);
    if(this.active===hover&&this.mesh)this.updatePose(hover);
  }
  stop(){
    this.token++;
    if(this.video){
      this.video.pause();this.video.onloadeddata=null;this.video.onerror=null;
      this.video.removeAttribute("src");this.video.load();
    }
    this.mesh?.removeFromParent();this.matte?.removeFromParent();
    this.material?.dispose();this.matteMaterial?.dispose();this.texture?.dispose();
    this.video=null;this.texture=null;this.material=null;this.mesh=null;
    this.matte=null;this.matteMaterial=null;this.active=-1;
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.stop();this.geometry.dispose();
  }
}
