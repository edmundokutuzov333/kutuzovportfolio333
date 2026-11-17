import * as THREE from "three";
import { rng, lerp } from "./core";

const E = new THREE.Euler();
const Q2 = new THREE.Quaternion();

export function makePoses(n, seed = 11) {
  const r = rng(seed);
  const perm = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return [...Array(n)].map((_, k) => {
    const dir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.7, (r() - 0.45) * 1.1).normalize();
    return {
      dir,
      speed: 3 + r() * 11,
      spin: new THREE.Vector3((r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 4),
      rnd: r(),
      rnd2: r(),
      arm: k % 3,
      a: (Math.floor(k / 3) + r() * 0.6) / (n / 3),
      cell: perm[k],
      ring: r(),
    };
  });
}

export const pose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, d: 1 });

export function bangPose(P, e, out) {
  out.p.copy(P.dir).multiplyScalar(0.4 + P.speed * e);
  out.p.z -= 2;
  E.set(P.spin.x * (1 - e) + P.rnd * 0.6, P.spin.y * (1 - e), P.spin.z * (1 - e));
  out.q.setFromEuler(E);
  out.s = 0.15 + 0.85 * Math.min(1, e * 4);
  out.d = 1;
  return out;
}

export function galaxyPose(P, t, camQ, out, center, scale = 1) {
  const r = (1.8 + P.a * 12) * scale;
  const th = P.a * 5.2 + P.arm * 2.0944 + t * 0.07;
  out.p.set(Math.cos(th) * r, ((P.rnd - 0.5) * 1.3 * (1 - P.a * 0.6) + Math.sin(P.a * 10 + P.arm) * 0.45) * scale, Math.sin(th) * r).add(center);
  out.q.copy(camQ);
  out.s = (0.75 + P.rnd2 * 0.5) * scale;
  out.d = 0.92;
  return out;
}

export const GRID_COLS = 16;
export function gridCell(P) {
  const col = P.cell % GRID_COLS;
  const row = Math.floor(P.cell / GRID_COLS);
  return new THREE.Vector3((col - 7.5) * 1.0, 0, (row - 4.5) * 1.25);
}

export function gridPose(P, L, out) {
  const c = gridCell(P);
  const lift = Math.max(L, 0);
  const sink = Math.min(L, 0);
  out.p.set(c.x, lift * 0.6 + sink * 0.25, c.z);
  E.set(-Math.PI / 2 + lift * 0.85, 0, 0);
  out.q.setFromEuler(E);
  out.s = 1 + lift * 0.12;
  out.d = 1 - 0.72 * Math.max(-L, 0);
  return out;
}

export function vortexPose(P, u, out) {
  const th = P.ring * Math.PI * 2 + u * (1.0 + u * 1.6);
  const collapse = Math.min(1, Math.max(0, (u - 1.25) / 1.0));
  const ce = collapse * collapse * collapse;
  const r = (2.4 + P.rnd * 2.8) * (1 - ce);
  const z = -34 + ((P.rnd2 * 34 + u * 15) % 34);
  out.p.set(Math.cos(th) * r, Math.sin(th) * r, lerp(z, -6, ce));
  E.set(0, 0, th + Math.PI / 2);
  out.q.setFromEuler(E);
  out.s = 1 - ce * 0.98;
  out.d = 0.9;
  return out;
}

export function blendPose(a, b, m, out) {
  out.p.copy(a.p).lerp(b.p, m);
  Q2.copy(a.q).slerp(b.q, m);
  out.q.copy(Q2);
  out.s = lerp(a.s, b.s, m);
  out.d = lerp(a.d, b.d, m);
  return out;
}

