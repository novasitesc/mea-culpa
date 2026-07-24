"use client";

// Decoración 3D de la cabecera del mercado.

// Pieza central del mercado: una pila de monedas de oro que gira lentamente
// con polvo dorado flotando. Reutiliza el entorno PBR de los dados. Decorativo:
// pointer-events none y con fallback estático si no hay WebGL / reduce-motion.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { confettiColors, makeSparkTexture, makeWhiteSparkTexture } from "@/app/components/fx/particles";

const GOLD = "#D4AF37";
const COINS = 7;

// PRNG determinista: mismas posiciones entre renders (no reshuffle) y sin
// warnings de pureza por Math.random en el cuerpo de useMemo.
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CoinStack() {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const coins = useMemo(() => {
    const rnd = mulberry32(4207);
    return Array.from({ length: COINS }, (_, i) => ({
      y: i * 0.17 - (COINS - 1) * 0.085,
      rot: rnd() * Math.PI,
      off: (rnd() - 0.5) * 0.08, // ligero desalineado: montón, no torre perfecta
      offz: (rnd() - 0.5) * 0.08,
      phase: rnd() * Math.PI * 2, // desfase del jiggle por moneda
    }));
  }, []);
  useFrame(({ clock }, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.5;
    const t = clock.elapsedTime;
    // Squash & stretch preservando volumen: la pila "respira" en oleada hacia arriba.
    for (let i = 0; i < meshes.current.length; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const s = 1 + Math.sin(t * 3.2 - i * 0.55 + coins[i].phase) * 0.07;
      m.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
  });
  return (
    <group ref={group}>
      {coins.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          position={[c.off, c.y, c.offz]}
          rotation={[0, c.rot, 0]}
          castShadow
        >
          <cylinderGeometry args={[1, 1, 0.13, 64]} />
          <meshStandardMaterial
            color={GOLD}
            metalness={1}
            roughness={0.24}
            envMapIntensity={1.25}
            emissive={GOLD}
            emissiveIntensity={0.12}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Halo dorado detrás de la pila: brillo falso (sin post-proceso) que la hace irradiar. */
function Halo() {
  const texture = useMemo(() => makeSparkTexture("255,235,170", "212,175,55"), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const sprite = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const s = sprite.current;
    if (!s) return;
    const pulse = 3.6 + Math.sin(clock.elapsedTime * 1.6) * 0.35; // latido suave
    s.scale.set(pulse, pulse, 1);
  });
  return (
    <sprite ref={sprite} position={[0, 0, -0.6]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

/** Dos luces de colores orbitando: tiñen los reflejos del metal de cian y magenta. */
function OrbitLights() {
  const cyan = useRef<THREE.PointLight>(null);
  const magenta = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cyan.current) cyan.current.position.set(Math.cos(t * 0.9) * 3, 1.2, Math.sin(t * 0.9) * 3);
    if (magenta.current)
      magenta.current.position.set(Math.cos(t * 0.9 + Math.PI) * 3, -0.6, Math.sin(t * 0.9 + Math.PI) * 3);
  });
  return (
    <>
      <pointLight ref={cyan} color="#00e5ff" intensity={7} distance={8} />
      <pointLight ref={magenta} color="#ff3ca0" intensity={6} distance={8} />
    </>
  );
}

function GoldDust() {
  const pts = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const texture = useMemo(() => makeWhiteSparkTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const { positions, colors, speeds } = useMemo(() => {
    const rnd = mulberry32(90125);
    const N = 90;
    const positions = new Float32Array(N * 3);
    const speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1.1 + rnd() * 1.6;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (rnd() - 0.5) * 3;
      positions[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 0.15 + rnd() * 0.35;
    }
    return { positions, colors: confettiColors(N), speeds };
  }, []);
  useFrame(({ clock }, delta) => {
    const p = pts.current;
    if (!p) return;
    const arr = p.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      arr[i * 3 + 1] += speeds[i] * delta; // suben derivando
      if (arr[i * 3 + 1] > 1.6) arr[i * 3 + 1] = -1.6;
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.rotation.y += delta * 0.12;
    if (mat.current) mat.current.size = 0.11 + Math.sin(clock.elapsedTime * 4) * 0.03; // titileo
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        map={texture}
        vertexColors
        size={0.11}
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="w-28 h-28 rounded-full blur-[2px]"
        style={{ background: "radial-gradient(circle at 40% 35%, #ffe08a, #D4AF37 45%, #6b520f 90%)" }}
      />
    </div>
  );
}

export default function CommerceHero3D() {
  const [capable, setCapable] = useState<boolean | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setCapable(false);
    try {
      const c = document.createElement("canvas");
      setCapable(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setCapable(false);
    }
  }, []);

  if (capable === null) return null;
  if (!capable) return <Fallback />;

  return (
    <Canvas
      camera={{ position: [0, 1.1, 5.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <Env />
      <ambientLight intensity={0.5} color="#ffe8c0" />
      <directionalLight position={[4, 7, 4]} intensity={1.8} color="#ffdf9e" castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.4} color="#b09a7a" />
      <OrbitLights />
      <Halo />
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.5}>
        <CoinStack />
      </Float>
      <GoldDust />
      <ContactShadows position={[0, -0.75, 0]} opacity={0.5} scale={7} blur={2.6} far={3} color="#000000" />
    </Canvas>
  );
}
