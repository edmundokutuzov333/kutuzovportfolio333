import * as THREE from "three";

THREE.ColorManagement.enabled = false;

export const W = 1920;
export const H = 1080;
export const DUR = 60;
export const BEAT = 0.5;
export const PX = 6.3 / 1080;
export const C = {
  bg: "#0a0d15",
  card: "#121829",
  primary: "#4466ff",
  ember: "#9cc6f5",
  bone: "#e8eef6",
  muted: "#8a94ab",
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  lin: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
};

export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const p = ease[e || "inOut"]((t - t0) / (t1 - t0 || 1));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : lerp(v0, v1, p);
    }
  }
  return keys[keys.length - 1][1];
}

export const bell = (t, a, b) => {
  const p = seg(t, a, b);
  return Math.sin(p * Math.PI);
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function textCanvas({ text, font = "Syne", weight = 800, size = 200, color = C.bone, tracking = 0, stroke = 0, lineHeight = 1.0, align = "left" }) {
  const lines = String(text).split("\n");
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const fontStr = `${weight} ${size}px "${font}"`;
  const setup = () => {
    g.font = fontStr;
    g.letterSpacing = `${tracking * size}px`;
    g.textBaseline = "middle";
  };
  setup();
  const pad = Math.ceil(size * 0.22);
  const widths = lines.map((l) => g.measureText(l).width);
  c.width = Math.ceil(Math.max(...widths, 1) + pad * 2);
  c.height = Math.ceil(lines.length * size * lineHeight + pad * 2);
  setup();
  lines.forEach((l, i) => {
    const x = align === "center" ? (c.width - widths[i]) / 2 : align === "right" ? c.width - pad - widths[i] : pad;
    const y = pad + (i + 0.5) * size * lineHeight;
    if (stroke) {
      g.strokeStyle = color;
      g.lineWidth = stroke;
      g.strokeText(l, x, y);
    } else {
      g.fillStyle = color;
      g.fillText(l, x, y);
    }
  });
  return { canvas: c, pad };
}

export function makeText(opts) {
  const { unit = PX, anchor = "left", opacity = 1 } = opts;
  const { canvas, pad } = textCanvas(opts);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  const w = canvas.width * unit;
  const h = canvas.height * unit;
  const geo = new THREE.PlaneGeometry(w, h);
  const dx = anchor === "left" ? w / 2 - pad * unit : anchor === "right" ? -w / 2 + pad * unit : 0;
  geo.translate(dx, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.size = { w, h };
  return mesh;
}

export class DynText {
  constructor(opts) {
    this.opts = opts;
    this.canvas = document.createElement("canvas");
    this.canvas.width = opts.cw || 900;
    this.canvas.height = Math.ceil((opts.size || 20) * 1.6);
    this.tex = new THREE.CanvasTexture(this.canvas);
    const geo = new THREE.PlaneGeometry(this.canvas.width, this.canvas.height);
    const align = opts.align || "left";
    geo.translate(align === "left" ? this.canvas.width / 2 : align === "right" ? -this.canvas.width / 2 : 0, 0, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.value = null;
  }
  set(value) {
    if (value === this.value) return;
    this.value = value;
    const { font = "JetBrains Mono", weight = 500, size = 20, color = C.bone, tracking = 0.2, align = "left" } = this.opts;
    const g = this.canvas.getContext("2d");
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.font = `${weight} ${size}px "${font}"`;
    g.letterSpacing = `${tracking * size}px`;
    g.textBaseline = "middle";
    g.fillStyle = color;
    const w = g.measureText(value).width;
    const x = align === "left" ? 0 : align === "right" ? this.canvas.width - w : (this.canvas.width - w) / 2;
    g.fillText(value, x, this.canvas.height / 2);
    this.tex.needsUpdate = true;
  }
}

export const texAspect = (tex) => {
  const img = tex.image;
  const w = img.videoWidth || img.width;
  const h = img.videoHeight || img.height;
  return w / h;
};

const SIDE = new THREE.MeshBasicMaterial({ color: "#1b2236" });

export function makeSlab(tex, height = 4, depth = 0.06) {
  const a = texAspect(tex);
  const geo = new THREE.BoxGeometry(height * a, height, depth);
  const front = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, [SIDE, SIDE, SIDE, SIDE, front, SIDE]);
  mesh.userData.front = front;
  mesh.userData.w = height * a;
  mesh.userData.h = height;
  return mesh;
}

export const dim = (slab, k) => slab.userData.front.color.setScalar(k);

export function makeBackdrop(tex, width, height, { bias = 5.5, dimK = 0.32 } = {}) {
  const a = texAspect(tex);
  const pa = width / height;
  const sx = a > pa ? pa / a : 1;
  const sy = a > pa ? 1 : a / pa;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      bias: { value: bias },
      dimK: { value: dimK },
      opacity: { value: 1 },
      uvT: { value: new THREE.Vector4(sx, sy, (1 - sx) / 2, (1 - sy) / 2) },
    },
    vertexShader: `varying vec2 vUv; uniform vec4 uvT; void main(){ vUv = uv*uvT.xy + uvT.zw; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D map; uniform float bias; uniform float dimK; uniform float opacity;
      void main(){ vec3 c = texture2D(map, vUv, bias).rgb; gl_FragColor = vec4(c*dimK, opacity);} `,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

export function makeStrips(tex, height, n) {
  const a = texAspect(tex);
  const w = height * a;
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  for (let k = 0; k < n; k++) {
    const geo = new THREE.PlaneGeometry(w, height / n);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (k + uv.getY(i)) / n);
    const m = new THREE.Mesh(geo, mat);
    m.userData.baseY = (k + 0.5) * (height / n) - height / 2;
    group.add(m);
  }
  group.userData.mat = mat;
  group.userData.w = w;
  return group;
}

export function makeLine(w, h, color = C.ember, opacity = 1) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
  );
}

export function setOpacity(obj, o) {
  obj.traverse((m) => {
    if (!m.material) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
      if (mat.uniforms && mat.uniforms.opacity) mat.uniforms.opacity.value = o;
      else mat.opacity = o;
    });
  });
  obj.visible = o > 0.001;
}

export function setCam(ctx, pos, look, roll = 0, fov = 35) {
  const cam = ctx.camera;
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.lookAt(look[0], look[1], look[2]);
  if (roll) cam.rotateZ(roll);
  if (cam.fov !== fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
}

export const shake = (t, a = 1) => [
  (Math.sin(t * 1.31) * 0.03 + Math.sin(t * 2.87) * 0.012) * a,
  (Math.cos(t * 1.07) * 0.024 + Math.sin(t * 3.3) * 0.01) * a,
  0,
];

export function makeTiles(tex, height, nx, ny, seed = 1) {
  const a = texAspect(tex);
  const w = height * a;
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
  const r = rng(seed);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const geo = new THREE.PlaneGeometry(w / nx, height / ny);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (ix + uv.getX(i)) / nx, (iy + uv.getY(i)) / ny);
      const m = new THREE.Mesh(geo, mat);
      m.userData.base = new THREE.Vector3((ix + 0.5) * (w / nx) - w / 2, (iy + 0.5) * (height / ny) - height / 2, 0);
      m.userData.dir = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.3) * 2.4);
      m.userData.spin = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5));
      group.add(m);
    }
  }
  group.userData.mat = mat;
  group.userData.w = w;
  return group;
}

export function makeSweep(w, h) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { phase: { value: -1 }, amt: { value: 0.4 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float phase; uniform float amt;
      void main(){ float d = vUv.x + vUv.y * 0.45 - phase; float b = exp(-d*d*60.0) + exp(-pow(d-0.12,2.0)*900.0)*0.6; gl_FragColor = vec4(vec3(b*amt), 1.0);} `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.15, "rgba(156,198,245,0.8)");
  grd.addColorStop(0.5, "rgba(68,102,255,0.18)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

