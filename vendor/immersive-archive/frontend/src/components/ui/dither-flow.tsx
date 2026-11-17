"use client";

import {useEffect,useRef,type CSSProperties,type ReactNode} from "react";
import "./dither-flow-utils/dither-flow.css";

/** Adapted from the supplied Dither Flow shader: ordered Bayer halftones and
 * slowly folded light, transformed into an accelerating 2-second depth tunnel.
 */
export type DitherFlowPalette=[string,string,string,string];
type Props={
  palette?:DitherFlowPalette;
  cell?:number;
  speed?:number;
  motion?:"full"|"reduced";
  durationMs?:number;
  className?:string;
  style?:CSSProperties;
  children?:ReactNode;
};
const DEFAULT_PALETTE:DitherFlowPalette=["#060a13","#2948b4","#8bbcf4","#edf7ff"];

const FRAG=`
precision highp float;
uniform vec2 uRes;
uniform float uProgress,uTime,uCell,uReduced;
uniform vec2 uMouse;
uniform vec3 uC0,uC1,uC2,uC3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.0-2.0*f);
 return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),
            mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
 float v=0.,a=.5;
 for(int i=0;i<3;i++){v+=a*n(p);p=p*2.03+11.7;a*=.5;}
 return v;
}
float bayer4(vec2 c){
 vec2 m=mod(c,4.0);
 int idx=int(m.x+m.y*4.0);
 float b[16];
 b[0]=0.;b[1]=8.;b[2]=2.;b[3]=10.;
 b[4]=12.;b[5]=4.;b[6]=14.;b[7]=6.;
 b[8]=3.;b[9]=11.;b[10]=1.;b[11]=9.;
 b[12]=15.;b[13]=7.;b[14]=13.;b[15]=5.;
 float v=0.;
 for(int k=0;k<16;k++){if(k==idx)v=b[k];}
 return (v+.5)/16.;
}
void main(){
 vec2 cell=floor(gl_FragCoord.xy/uCell);
 vec2 p=(cell*uCell+.5*uCell-.5*uRes)/uRes.y;
 p.x*=1.04;
 float g=clamp(uProgress,0.,1.);
 float accel=g*g*(3.0-2.0*g);
 float t=uReduced>.5?0.:uTime;
 vec2 target=(uMouse-.5*uRes)/uRes.y;
 p+=target*.065*(1.-accel);
 float r=max(length(p),.001);
 float ang=atan(p.y,p.x);
 float z=2.6/(r+.095)-20.0*accel;
 float folds=fbm(vec2(ang*1.6+z*.06,z*.15-t*.32));
 float torque=ang+sin(z*.35+t*2.0)*(.12+.16*folds);
 float ring=pow(.5+.5*cos(z*3.1+sin(torque*7.)*.65),13.);
 float rail=pow(max(0.,cos(torque*11.0+z*.33)),22.);
 float helical=pow(max(0.,sin(ang*6.0+z*.75-t*8.)),14.);
 float vignette=exp(-r*r*1.3);
 float tunnel= (.19+.58*folds+.7*ring+.36*rail+.17*helical)*vignette;
 float throat=exp(-r*r*(34.0-18.0*accel));
 float gateRadius=mix(.32,.065,accel);
 float aperture=exp(-pow((r-gateRadius)*12.0,2.0))*(.33+.8*accel);
 float sparks=pow(max(0.,sin(ang*28.+z*1.9+t*7.)),22.)*ring*.35;
 float intensity=clamp(tunnel+.56*throat+aperture+sparks,0.,1.);
 float value=intensity*3.;
 float base=floor(value);
 float index=clamp(base+step(bayer4(cell),value-base),0.,3.);
 vec3 col=index<.5?uC0:index<1.5?uC1:index<2.5?uC2:uC3;
 col+=uC2*pow(max(0.,1.-r*8.),4.)*(accel*.2);
 float bloom=smoothstep(.79,1.,g);
 col=mix(col,uC3,bloom*bloom*.93);
 gl_FragColor=vec4(col,1.);
}`;
const VERT=`attribute vec2 a; void main(){gl_Position=vec4(a,0.,1.);}`;

function rgb(hex:string):[number,number,number]{
  const v=parseInt(hex.slice(1),16);
  return [((v>>16)&255)/255,((v>>8)&255)/255,(v&255)/255];
}
export function DitherFlow({
 palette=DEFAULT_PALETTE,cell=2,speed=1,motion="full",
 durationMs=2000,className="",style,children
}:Props){
 const host=useRef<HTMLDivElement>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
   const el=host.current,cv=canvas.current;
   if(!el||!cv)return;
   const gl=cv.getContext("webgl",{antialias:false,alpha:false,powerPreference:"high-performance"});
   if(!gl){el.dataset.fallback="";return;}
   const reduced=motion==="reduced"||window.matchMedia("(prefers-reduced-motion:reduce)").matches;
   const shader=(type:number,source:string)=>{
     const sh=gl.createShader(type);
     if(!sh)throw Error("WebGL shader not supported");
     gl.shaderSource(sh,source);gl.compileShader(sh);
     if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))
       throw Error(gl.getShaderInfoLog(sh)||"Shader compilation failed");
     return sh;
   };
   let program:WebGLProgram|null=null,vertex:WebGLShader|null=null,
       fragment:WebGLShader|null=null,buffer:WebGLBuffer|null=null;
   let raf=0,alive=true,start=performance.now(),sizeObserver:ResizeObserver|null=null;
   const mouse={x:0,y:0,tx:0,ty:0};
   const move=(e:PointerEvent)=>{
     const rect=el.getBoundingClientRect();
     mouse.tx=(e.clientX-rect.left)*cv.width/Math.max(1,rect.width);
     mouse.ty=(rect.bottom-e.clientY)*cv.height/Math.max(1,rect.height);
   };
   try{
     vertex=shader(gl.VERTEX_SHADER,VERT);
     fragment=shader(gl.FRAGMENT_SHADER,FRAG);
     program=gl.createProgram();
     if(!program)throw Error("WebGL unavailable");
     gl.attachShader(program,vertex);gl.attachShader(program,fragment);
     gl.bindAttribLocation(program,0,"a");gl.linkProgram(program);
     if(!gl.getProgramParameter(program,gl.LINK_STATUS))
       throw Error(gl.getProgramInfoLog(program)||"Unable to link shader");
     gl.useProgram(program);
     buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
     gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
     gl.enableVertexAttribArray(0);
     gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
     const uniform=(name:string)=>gl.getUniformLocation(program!,name);
     const uRes=uniform("uRes"),uProgress=uniform("uProgress");
     const uTime=uniform("uTime"),uCell=uniform("uCell");
     const uMouse=uniform("uMouse"),uReduced=uniform("uReduced");
     palette.forEach((color,i)=>gl.uniform3f(uniform("uC"+i),...rgb(color)));
     gl.uniform1f(uReduced,reduced?1:0);
     const resize=()=>{
       const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);
       // One short-lived shader at <= 1280x800; no full-resolution extra pass.
       const ratio=Math.min(window.devicePixelRatio||1,1,1280/w,800/h);
       cv.width=Math.max(2,Math.round(w*ratio));
       cv.height=Math.max(2,Math.round(h*ratio));
       gl.viewport(0,0,cv.width,cv.height);
       gl.uniform2f(uRes,cv.width,cv.height);
       gl.uniform1f(uCell,Math.max(1,Math.round(cell)));
       mouse.x=mouse.tx=cv.width*.5;
       mouse.y=mouse.ty=cv.height*.5;
     };
     resize();
     sizeObserver=new ResizeObserver(resize);
     sizeObserver.observe(el);
     el.addEventListener("pointermove",move,{passive:true});
     const frame=(now:number)=>{
       if(!alive)return;
       const progress=Math.min(1,(now-start)/durationMs);
       gl.uniform1f(uProgress,progress);
       gl.uniform1f(uTime,reduced?0:progress*speed*2.0);
       mouse.x+=(mouse.tx-mouse.x)*.12;
       mouse.y+=(mouse.ty-mouse.y)*.12;
       gl.uniform2f(uMouse,mouse.x,mouse.y);
       gl.drawArrays(gl.TRIANGLES,0,3);
       if(progress<1)raf=requestAnimationFrame(frame);
     };
     raf=requestAnimationFrame(frame);
   }catch(error){
     el.dataset.fallback="";
   }
   return ()=>{
     alive=false;
     cancelAnimationFrame(raf);
     el.removeEventListener("pointermove",move);
     sizeObserver?.disconnect();
     if(buffer)gl.deleteBuffer(buffer);
     if(program)gl.deleteProgram(program);
     if(vertex)gl.deleteShader(vertex);
     if(fragment)gl.deleteShader(fragment);
     gl.getExtension("WEBGL_lose_context")?.loseContext();
   };
 },[palette,cell,speed,motion,durationMs]);
 return <div ref={host} className={`dfl ${className}`} style={{...style}}>
   <canvas ref={canvas} className="dfl__canvas" aria-hidden="true"/>
   {children&&<div className="dfl__content">{children}</div>}
 </div>;
}
export default DitherFlow;
