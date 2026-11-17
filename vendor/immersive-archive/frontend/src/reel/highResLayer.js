import * as THREE from "three";
import { BASE_URL } from "./paths";

/**
 * Progressive, full-resolution artwork layer.
 *
 * The atlas remains a fast initial preview. When an artwork is large enough
 * on screen, load its individual 1280px+ asset and draw it over the atlas
 * instance at the exact same animated world transform. No extra image
 * requests are made for video-only items, and all failures retain the atlas.
 */
export class HighResLayer {
  constructor(cloud, scene) {
    this.cloud = cloud;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geometry = new THREE.PlaneGeometry(0.8, 1);
    this.active = new Map();
    this.cache = new Map();
    this.pending = new Map();
    this.failed = new Set();
    this.wanted = new Set();
    this.tick = 0;
    this.lastScan = 0;
    this.lastHover = -1;
    this.disposed = false;
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.offset = new THREE.Vector3();
  }

  readTransform(index) {
    const { a, j } = this.cloud.slot[index];
    this.cloud.meshes[a].getMatrixAt(j, this.matrix);
    this.matrix.decompose(this.position, this.quaternion, this.scale);
    return { a, j };
  }

  positionMesh(index, mesh) {
    const { a, j } = this.readTransform(index);
    mesh.position.copy(this.position);
    mesh.quaternion.copy(this.quaternion);
    // The original atlas cards are 0.8:1. Restore the artwork's actual
    // aspect ratio instead of distorting square or panoramic compositions.
    const aspect = Number(this.cloud.items[index].ar) || 0.8;
    mesh.scale.copy(this.scale);
    mesh.scale.x *= aspect / 0.8;
    // Push toward the viewing side of the billboard to prevent z-fighting.
    mesh.translateZ(0.012 * this.scale.y);
    mesh.material.color.setScalar(
      Math.max(0, this.cloud.meshes[a].geometry.attributes.aDim.getX(j))
    );
  }

  attach(index) {
    if (this.disposed || this.active.has(index)) return;
    const item = this.cache.get(index);
    if (!item) return;
    const mat = new THREE.MeshBasicMaterial({
      map: item.texture, side: THREE.DoubleSide,
      depthWrite: false, fog: true, toneMapped: false
    });
    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.active.set(index, mesh);
    this.positionMesh(index, mesh);
  }

  load(index) {
    if (this.pending.has(index) || this.cache.has(index) ||
        this.failed.has(index) || this.disposed) return;
    const item = this.cloud.items[index];
    if (!item || item.video) return;
    const image = new Image();
    image.decoding = "async";
    this.pending.set(index, image);
    image.onload = () => {
      this.pending.delete(index);
      if (this.disposed) return;
      const texture = new THREE.Texture(image);
      // Match the archive shader's existing colour pipeline.
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      this.cache.set(index, { texture, used: ++this.tick });
      if (this.wanted.has(index)) this.attach(index);
    };
    image.onerror = () => {
      this.pending.delete(index);
      this.failed.add(index);
    };
    image.src = `${BASE_URL}/img/${String(item.id).padStart(3,"0")}.webp`;
  }

  scan(camera, hover, mobile, viewportHeight) {
    const now = Date.now();
    if (now - this.lastScan < 250 && hover === this.lastHover) return;
    this.lastScan = now;
    this.lastHover = hover;
    camera.getWorldDirection(this.forward);
    const candidates = [];
    const focal = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const minPixels = mobile ? 75 : 85;
    for (let i = 0; i < this.cloud.n; i++) {
      const item = this.cloud.items[i];
      if (item.video) continue;
      const { a, j } = this.readTransform(i);
      if (this.cloud.meshes[a].geometry.attributes.aDim.getX(j) < 0.3 && i !== hover) continue;
      const depth = this.offset.subVectors(this.position, camera.position).dot(this.forward);
      if (depth <= 0.2) continue;
      this.projected.copy(this.position).project(camera);
      if (Math.abs(this.projected.x) > 1.18 || Math.abs(this.projected.y) > 1.18) continue;
      const pixels = this.scale.y * focal / depth;
      if (pixels >= minPixels || i === hover) candidates.push({index:i, score:pixels});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const limit = mobile ? 6 : 14;
    const chosen = [];
    if (hover >= 0 && !this.cloud.items[hover]?.video) chosen.push(hover);
    for (const {index} of candidates) {
      if (chosen.length >= limit) break;
      if (!chosen.includes(index)) chosen.push(index);
    }
    this.wanted = new Set(chosen);
    for (const [index,mesh] of this.active) {
      if (!this.wanted.has(index)) {
        this.group.remove(mesh);
        mesh.material.dispose();
        this.active.delete(index);
      }
    }
    for (const index of chosen) {
      const entry=this.cache.get(index);
      if (entry) {
        entry.used = ++this.tick;
        this.attach(index);
      } else if (this.pending.size < 4) {
        this.load(index);
      }
    }
    // Bound GPU memory; never dispose textures currently displayed.
    const maxCached = mobile ? 10 : 24;
    if (this.cache.size > maxCached) {
      const evictable = [...this.cache.entries()]
        .filter(([index])=>!this.wanted.has(index))
        .sort((a,b)=>a[1].used-b[1].used);
      while (this.cache.size > maxCached && evictable.length) {
        const [index, entry] = evictable.shift();
        entry.texture.dispose();
        this.cache.delete(index);
      }
    }
  }

  frame(camera, hover, mobile, viewportHeight) {
    if (this.disposed) return;
    this.scan(camera, hover, mobile, Math.max(1, viewportHeight));
    for (const [index,mesh] of this.active) this.positionMesh(index, mesh);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const image of this.pending.values()) {
      image.onload = null;
      image.onerror = null;
      image.src = "";
    }
    this.pending.clear();
    for (const mesh of this.active.values()) {
      this.group.remove(mesh);
      mesh.material.dispose();
    }
    this.active.clear();
    for (const entry of this.cache.values()) entry.texture.dispose();
    this.cache.clear();
    this.geometry.dispose();
    this.group.removeFromParent();
  }
}
