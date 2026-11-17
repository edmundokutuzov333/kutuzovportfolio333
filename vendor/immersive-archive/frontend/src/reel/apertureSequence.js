import * as THREE from "three";
import {clamp01,smooth01,introPose} from "./apertureTimeline";

/**
 * The portal and the archive share a camera and a WebGL renderer.
 * No replacement canvas, second WebGL scene or white transition frame.
 */
export class ApertureSequence {
  constructor(scene,camera){
    this.scene=scene;this.camera=camera;this.pointerX=0;this.pointerY=0;this.disposed=false;
    this.group=new THREE.Group();this.group.name="the-aperture";
    camera.add(this.group);scene.add(camera);
    this.rings=[];
    const colors=["#4169bc","#9acaff","#5379da","#cadfff"];
    for(let i=0;i<4;i++){
      const geometry=new THREE.TorusGeometry(2.4+i*.23,i===1?.025:.012,8,128);
      const material=new THREE.MeshBasicMaterial({
        color:colors[i],transparent:true,opacity:0,blending:THREE.AdditiveBlending,
        depthWrite:false,depthTest:false,side:THREE.DoubleSide
      });
      const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=12+i;
      this.group.add(mesh);this.rings.push(mesh);
    }
    this.halo=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:{uProgress:{value:0},uStrength:{value:0},uPointer:{value:new THREE.Vector2()},uAspect:{value:1}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        precision mediump float;
        varying vec2 vUv;
        uniform float uProgress,uStrength,uAspect;
        uniform vec2 uPointer;
        void main(){
          vec2 q=(vUv-.5)*vec2(uAspect,1.)-uPointer*.014;
          float r=length(q);
          float radius=mix(.05,.42,smoothstep(0.,.75,uProgress));
          float edge=exp(-pow((r-radius)/.008,2.));
          float penumbra=exp(-pow((r-radius)/.105,2.));
          float filaments=pow(max(0.,cos(atan(q.y,q.x)*16.+uProgress*9.)),30.);
          float light=edge*.42+penumbra*.095+filaments*edge*.24;
          vec3 cobalt=vec3(.18,.36,.84),ice=vec3(.60,.78,1.);
          gl_FragColor=vec4(mix(cobalt,ice,clamp(light*1.5,0.,1.)),clamp(light*uStrength,0.,.46));
        }`,
      transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending
    }));
    this.halo.renderOrder=11;this.halo.position.z=-9;this.group.add(this.halo);
    const count=360;
    this.seed=new Float32Array(count*3);
    const positions=new Float32Array(count*3),colorsArray=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const j=i*3,a=i*2.399963229728653,r=.35+Math.sqrt((i+.5)/count)*10;
      this.seed[j]=Math.cos(a)*r;this.seed[j+1]=Math.sin(a*.47)*r*.32;this.seed[j+2]=Math.sin(a)*r;
      const bright=i%23===0;
      colorsArray[j]=bright?.79:.27;colorsArray[j+1]=bright?.91:.49;colorsArray[j+2]=1;
    }
    this.particleGeometry=new THREE.BufferGeometry();
    this.particleGeometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    this.particleGeometry.setAttribute("color",new THREE.BufferAttribute(colorsArray,3));
    this.particles=new THREE.Points(this.particleGeometry,new THREE.PointsMaterial({
      size:.13,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0,
      depthWrite:false,blending:THREE.AdditiveBlending
    }));
    this.particles.frustumCulled=false;this.particles.renderOrder=2;scene.add(this.particles);
  }
  pointer(nx,ny){
    this.pointerX=Math.max(-1,Math.min(1,nx*2-1));
    this.pointerY=Math.max(-1,Math.min(1,1-ny*2));
  }
  update(progress,elapsed){
    if(this.disposed)return;
    const p=clamp01(progress),state=introPose(p,this.pointerX,this.pointerY);
    const strength=state.iris;
    this.group.visible=strength>.001;
    this.group.rotation.y=this.pointerX*(1-smooth01(p/.9))*.018;
    this.group.rotation.x=this.pointerY*(1-smooth01(p/.9))*.013;
    const planeHalfHeight=Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*9;
    this.halo.scale.set(planeHalfHeight*this.camera.aspect,planeHalfHeight,1);
    this.halo.material.uniforms.uProgress.value=p;
    this.halo.material.uniforms.uStrength.value=strength;
    this.halo.material.uniforms.uAspect.value=this.camera.aspect;
    this.halo.material.uniforms.uPointer.value.set(this.pointerX,this.pointerY);
    this.rings.forEach((mesh,i)=>{
      mesh.visible=strength>.001;
      mesh.position.z=-12-i*1.2+smooth01(p)*15;
      mesh.rotation.z=elapsed*(i%2?-.09:.07)+i*.18;
      mesh.scale.setScalar(.45+smooth01(p)*(2.5+i*.2));
      mesh.material.opacity=(i===1?.54:.19)*strength;
    });
    const light=smooth01(p/.18)*(1-smooth01((p-.57)/.4));
    this.particles.visible=light>.001;
    this.particles.material.opacity=light*.72;
    if(this.particles.visible){
      const attr=this.particleGeometry.attributes.position;
      const spread=.08+1.14*smooth01(p/.87);
      for(let i=0;i<attr.count;i++){
        const j=i*3,wobble=1+.035*Math.sin(elapsed*1.9+i*.6);
        attr.setXYZ(i,this.seed[j]*spread*wobble,this.seed[j+1]*spread,this.seed[j+2]*spread*wobble);
      }
      attr.needsUpdate=true;
    }
  }
  finish(){
    this.update(1,0);
    this.group.visible=false;this.particles.visible=false;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.rings.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});
    this.halo.geometry.dispose();this.halo.material.dispose();
    this.particleGeometry.dispose();this.particles.material.dispose();
    this.group.removeFromParent();this.particles.removeFromParent();this.rings.length=0;
  }
}
