import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, ContactShadows } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LOGO_H, LOGO_W, logoPolygons } from "./logo-paths";

function Monogram() {
  const group = useRef<THREE.Group>(null);
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
    const g = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.035,
      bevelSegments: 4,
    });
    g.center();
    return g;
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const targetY = state.pointer.x * 0.55 + Math.sin(t * 0.4) * 0.12;
    const targetX = -state.pointer.y * 0.35;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 3, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 3, delta);
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.6}>
        <mesh geometry={geometry} castShadow>
          <meshPhysicalMaterial
            color="#dbe4f3"
            metalness={0.85}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1.4}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function Logo3DScene() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[4, 5, 6]} intensity={1.2} />
      <pointLight position={[-5, -2, 3]} intensity={30} color="#1d4ed8" />
      <Monogram />
      <ContactShadows position={[0, -1.6, 0]} opacity={0.5} scale={12} blur={2.6} far={3} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={4} position={[0, 4, -4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={3} color="#93c5fd" position={[6, -1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={2} position={[0, 0, 6]} scale={3} />
      </Environment>
    </Canvas>
  );
}
