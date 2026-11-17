import * as THREE from "three";
import { spatialPartners } from "./archiveExperience";

/**
 * Subtle environment-only light: portfolio pixels remain unaltered.
 * One soft halo + up to five segments; no shadow maps or post-processing.
 */
export class SpatialAccents{
  constructor(scene,{mobile=false,reduced=false}={}){
    this.scene=scene;this.mobile=mobile;this.reduced=reduced;
    this.opacity=0;this.elapsed=0;this.disposed=false;
    this.tmp=new THREE.Vector3();
    this.forward=new THREE.Vector3();
    this.halo=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:{uIntensity:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        precision mediump float;
        varying vec2 vUv;
        uniform float uIntensity;
        void main(){
          vec2 d=(vUv-.5)*2.;
          float rad=length(d);
          float glow=pow(max(0.,1.-smoothstep(.07,1.,rad)),2.3);
          gl_FragColor=vec4(.15,.35,.86,glow*uIntensity*.19);
        }`,
      transparent:true,depthTest:true,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide
    }));
    this.halo.visible=false;this.halo.renderOrder=-1;
    scene.add(this.halo);
    const max=5;
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute("position",new THREE.BufferAttribute(
      new Float32Array(max*2*3),3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0,0);
    this.links=new THREE.LineSegments(this.geometry,new THREE.LineBasicMaterial({
      color:"#90b9ff",transparent:true,opacity:0,depthTest:true,depthWrite:false,
      blending:THREE.AdditiveBlending
    }));
    this.links.frustumCulled=false;this.links.renderOrder=1;this.links.visible=false;
    scene.add(this.links);
  }
  update(dt,items,positions,camera,index,selected){
    if(this.disposed)return;
    this.elapsed+=dt;
    const valid=index>=0&&!!positions[index];
    const destination=valid?(selected?1:.74):0;
    const speed=1-Math.exp(-Math.max(0,dt)*7);
    this.opacity+=(destination-this.opacity)*speed;
    const shown=this.opacity>.012&&valid;
    this.halo.visible=shown;
    if(!shown){this.links.visible=false;return;}
    this.tmp.copy(positions[index]);
    camera.getWorldDirection(this.forward);
    this.halo.position.copy(this.tmp).addScaledVector(this.forward,.22);
    this.halo.quaternion.copy(camera.quaternion);
    const wave=this.reduced?1:1+Math.sin(this.elapsed*1.65)*.035;
    const scale=(selected?4.1:3.3)*wave;
    this.halo.scale.set(scale,scale,1);
    this.halo.material.uniforms.uIntensity.value=this.opacity;
    const partners=spatialPartners(items,positions,index,this.mobile?3:5);
    const attr=this.geometry.attributes.position;
    for(let i=0;i<partners.length;i++){
      const end=positions[partners[i]];
      // Keep each connection behind billboard surfaces so original pixels
      // remain unobscured, including when passing through an artwork.
      const back=.075;
      attr.setXYZ(i*2,
        this.tmp.x+this.forward.x*back,
        this.tmp.y+this.forward.y*back,
        this.tmp.z+this.forward.z*back);
      attr.setXYZ(i*2+1,
        end.x+this.forward.x*back,
        end.y+this.forward.y*back,
        end.z+this.forward.z*back);
    }
    this.geometry.setDrawRange(0,partners.length*2);
    attr.needsUpdate=true;
    this.links.material.opacity=this.opacity*(selected?.3:.18);
    this.links.visible=partners.length>0;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.halo.geometry.dispose();this.halo.material.dispose();this.halo.removeFromParent();
    this.geometry.dispose();this.links.material.dispose();this.links.removeFromParent();
  }
}
