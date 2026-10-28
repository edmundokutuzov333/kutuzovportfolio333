import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LOGO_H, LOGO_W, logoPolygons } from "./logo-paths";

/** Shared, mutated outside React: when the breach started (performance.now ms), or null while idle. */
export type IntroClock = { breachAt: number | null };

const BREACH_MS = 1150; // camera travel duration
const START_Z = -46; // logo depth while idle
const END_Z = 6; // past the camera (camera sits at z=5)
const GAP_X = 0.5; // shifts the logo so the E–K gap sits on the camera axis
const STARS = 520;

const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));

function breachT(clock: IntroClock) {
  if (clock.breachAt === null) return 0;
  return Math.min(1, (performance.now() - clock.breachAt) / BREACH_MS);
}

function Monogram({ clock }: { clock: IntroClock }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const shapes = logoPolygons.map((poly) => {
      const s = new THREE.Shape();
      poly.forEach(([x, y], i) => {
        const px = (x - LOGO_W / 2) / 400;
        const py = -(y - LOGO_H / 2) / 400;
        if (i === 0) s.moveTo(px, py);
        else s.lineTo(px, py);
      });
      s.closePath();
      return s;
    });
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.035, bevelSegments: 3 });
    g.center();
    return g;
  }, []);

  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    const t = breachT(clock);
    const e = easeInExpo(t);
    const idle = state.clock.elapsedTime;
    m.position.set(GAP_X * e, Math.sin(idle * 0.8) * 0.15 * (1 - e), START_Z + (END_Z - START_Z) * e);
    // idle: slow drift, breach: rotation locks flat so the camera threads the gap
    const targetY = clock.breachAt === null ? Math.sin(idle * 0.5) * 0.5 + state.pointer.x * 0.4 : 0;
    m.rotation.y = THREE.MathUtils.damp(m.rotation.y, targetY, clock.breachAt === null ? 2 : 9, delta);
    m.rotation.z = THREE.MathUtils.damp(m.rotation.z, clock.breachAt === null ? -state.pointer.y * 0.15 : 0, 6, delta);
  });

  return (
    <mesh ref={ref} geometry={geometry} position={[0, 0, START_Z]}>
      <meshPhysicalMaterial color="#dbe4f3" metalness={0.9} roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.6} />
    </mesh>
  );
}

/** Star streaks: line segments whose length grows with camera velocity — the "warp". */
function Warp({ clock }: { clock: IntroClock }) {
  const lines = useRef<THREE.LineSegments>(null);
  const { stars, positions } = useMemo(() => {
    const stars = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 9;
      stars[i * 3] = Math.cos(a) * r;
      stars[i * 3 + 1] = Math.sin(a) * r;
      stars[i * 3 + 2] = -Math.random() * 80;
    }
    return { stars, positions: new Float32Array(STARS * 6) };
  }, []);

  useFrame((_, delta) => {
    const t = breachT(clock);
    const speed = 4 + easeInExpo(t) * 260; // units / sec
    const len = 0.05 + easeInExpo(t) * 9;
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < STARS; i++) {
      let z = stars[i * 3 + 2] + speed * dt;
      if (z > 5) z -= 80;
      stars[i * 3 + 2] = z;
      const x = stars[i * 3], y = stars[i * 3 + 1];
      positions.set([x, y, z, x, y, z - len], i * 6);
    }
    const g = lines.current?.geometry;
    if (g) (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <lineSegments ref={lines} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#93c5fd" transparent opacity={0.7} />
    </lineSegments>
  );
}

/** Dolly-zoom: field of view widens as the camera accelerates. */
function Lens({ clock }: { clock: IntroClock }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const e = easeInExpo(breachT(clock));
    camera.fov = 35 + e * 55;
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function IntroScene({ clock }: { clock: IntroClock }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 35, near: 0.05, far: 120 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <fog attach="fog" args={["#070a10", 20, 70]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[-4, 2, 2]} intensity={60} color="#1d4ed8" />
      <pointLight position={[4, -2, -10]} intensity={40} color="#93c5fd" />
      <Lens clock={clock} />
      <Warp clock={clock} />
      <Monogram clock={clock} />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={4} position={[0, 4, -4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={3} color="#93c5fd" position={[6, -1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#1d4ed8" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
    </Canvas>
  );
}
