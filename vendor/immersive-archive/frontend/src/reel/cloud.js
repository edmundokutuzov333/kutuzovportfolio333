import * as THREE from "three";
import { C } from "./core";

const VS = `
attribute vec2 aCell; attribute float aDim;
uniform vec2 uGrid; uniform float uFogNear, uFogFar;
varying vec2 vUv; varying float vDim; varying float vFog;
void main(){
  vec2 cuv = uv * 0.985 + 0.0075;
  vUv = (vec2(aCell.x, uGrid.y - 1.0 - aCell.y) + cuv) / uGrid;
  vDim = aDim;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vFog = smoothstep(uFogNear, uFogFar, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D map; uniform vec3 uBg; uniform float uOpacity;
varying vec2 vUv; varying float vDim; varying float vFog;
void main(){
  vec3 c = texture2D(map, vUv).rgb * vDim;
  gl_FragColor = vec4(mix(c, uBg, vFog), uOpacity);
}`;

export class Cloud {
  constructor(catalog, atlases) {
    this.items = catalog.items;
    this.n = this.items.length;
    this.group = new THREE.Group();
    this.meshes = atlases.map((tex, a) => {
      const count = this.items.filter((it) => it.atlas === a).length;
      const geo = new THREE.PlaneGeometry(0.8, 1.0);
      const cells = new Float32Array(count * 2);
      geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 2));
      geo.setAttribute("aDim", new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: tex },
          uGrid: { value: new THREE.Vector2(catalog.cols, catalog.rows) },
          uFogNear: { value: 10 },
          uFogFar: { value: 60 },
          uBg: { value: new THREE.Color(C.bg) },
          uOpacity: { value: 1 },
        },
        vertexShader: VS,
        fragmentShader: FS,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.frustumCulled = false;
      // Stable broadphase volume: no costly per-frame sphere recalculation.
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(),150);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      return mesh;
    });
    const slotCounters=new Int32Array(atlases.length);
    this.slot = this.items.map((it) => {
      const a = it.atlas;
      const j = slotCounters[a]++;
      const cells = this.meshes[a].geometry.attributes.aCell;
      cells.setXY(j, it.cell % catalog.cols, Math.floor(it.cell / catalog.cols));
      return { a, j };
    });
    this.meshes.forEach((m) => { m.geometry.attributes.aCell.needsUpdate = true; });
    this.reverseSlots=this.meshes.map((m)=>new Int32Array(m.count));
    this.slot.forEach(({a,j},i)=>{this.reverseSlots[a][j]=i;});
    this.m = new THREE.Matrix4();
    this.s = new THREE.Vector3();
  }

  set(k, p, q, s, d) {
    const { a, j } = this.slot[k];
    this.s.set(s, s, s);
    this.m.compose(p, q, this.s);
    this.meshes[a].setMatrixAt(j, this.m);
    this.meshes[a].geometry.attributes.aDim.setX(j, d);
  }

  commit(fog) {
    this.meshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      m.geometry.attributes.aDim.needsUpdate = true;
      m.material.uniforms.uFogNear.value = fog.near;
      m.material.uniforms.uFogFar.value = fog.far;
    });
  }

  indexFromHit(mesh, instanceId) {
    const a = this.meshes.indexOf(mesh);
    return a<0||instanceId==null?-1:this.reverseSlots[a][instanceId];
  }
}

