"use client";

// Escena R3F: los dados caen desde arriba, rebotan y se asientan mostrando la
// cara resuelta por el servidor. Caída coreografiada determinista: la propia
// animación dirige los callbacks (sin setTimeouts mágicos).
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getDie, faceRestQuaternion } from "./dice-geometry";
import { getDieMaterials } from "./dice-materials";
import type { DiceType } from "@/lib/types/dados";

export const DICE_FALL_MS = 1800;
export const DICE_STAGGER_MS = 90;

const START_Y = 11;
const GOLD = "#D4AF37";

export type SceneDie = { type: DiceType; value: number };

type SceneProps = {
  dice: SceneDie[];
  /** true → saltar al estado final (tap del usuario o prefers-reduced-motion). */
  skip: boolean;
  onImpact: (intensity: number) => void;
  onAllSettled: () => void;
};

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bump = (u: number) => 4 * u * (1 - u);
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

function yCurve(t: number, rest: number): number {
  if (t >= 1) return rest;
  if (t < 0.52) {
    const u = t / 0.52;
    return START_Y + (rest - START_Y) * u * u;
  }
  if (t < 0.7) return rest + 0.95 * bump((t - 0.52) / 0.18);
  if (t < 0.84) return rest + 0.34 * bump((t - 0.7) / 0.14);
  if (t < 0.94) return rest + 0.1 * bump((t - 0.84) / 0.1);
  return rest;
}

const IMPACTS: Array<{ t: number; intensity: number }> = [
  { t: 0.52, intensity: 1 },
  { t: 0.7, intensity: 0.45 },
  { t: 0.84, intensity: 0.2 },
];

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

type DieProps = {
  type: DiceType;
  value: number;
  index: number;
  rest: [number, number]; // x, z de aterrizaje
  skip: boolean;
  onImpact: (intensity: number) => void;
  onSettled: () => void;
};

function Die({ type, value, index, rest, skip, onImpact, onSettled }: DieProps) {
  const group = useRef<THREE.Group>(null);
  const die = useMemo(() => getDie(type), [type]);
  const materials = useMemo(() => getDieMaterials(type), [type]);

  const anim = useMemo(() => {
    const rnd = mulberry32(1337 + index * 7877 + value * 131);
    const startQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2),
    );
    const spinAxis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return {
      startQ,
      spinAxis,
      spins: 1.5 + rnd() * 1.5,
      drift: [(rnd() - 0.5) * 1.6, (rnd() - 0.5) * 0.9] as const,
      targetQ: faceRestQuaternion(type, value),
      delay: (index * DICE_STAGGER_MS) / 1000,
    };
  }, [type, value, index]);

  const t0 = useRef<number | null>(null);
  const prevT = useRef(0);
  const settled = useRef(false);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qSpin = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (t0.current === null) t0.current = clock.elapsedTime;

    let t = (clock.elapsedTime - t0.current - anim.delay) / (DICE_FALL_MS / 1000);
    if (skip) t = 1;
    t = Math.max(0, Math.min(1, t));

    const fade = 1 - t;
    g.position.set(
      rest[0] + anim.drift[0] * fade * fade,
      yCurve(t, die.restHeight),
      rest[1] + anim.drift[1] * fade * fade,
    );

    const p = easeOutCubic(Math.min(1, t / 0.7));
    q.copy(anim.startQ).slerp(anim.targetQ, p);
    const theta = Math.PI * 2 * anim.spins * (1 - p) * (1 - p);
    qSpin.setFromAxisAngle(anim.spinAxis, theta);
    g.quaternion.multiplyQuaternions(qSpin, q);

    if (!skip) {
      for (const imp of IMPACTS) {
        if (prevT.current < imp.t && t >= imp.t) onImpact(imp.intensity);
      }
    }
    prevT.current = t;

    if (t >= 1 && !settled.current) {
      settled.current = true;
      onSettled();
    }
  });

  return (
    <group ref={group} position={[rest[0], START_Y, rest[1]]}>
      <mesh geometry={die.geometry} material={materials} />
      <lineSegments geometry={die.edges}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

function layout(n: number): Array<[number, number]> {
  const cols = n <= 3 ? n : n <= 8 ? Math.ceil(n / 2) : 4;
  const rows = Math.ceil(n / cols);
  const gap = 1.95;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i % cols;
    out.push([(col - (inRow - 1) / 2) * gap, (row - (rows - 1) / 2) * gap]);
  }
  return out;
}

function DiceGroup(props: SceneProps) {
  const { dice, skip, onImpact, onAllSettled } = props;
  const { viewport } = useThree();
  const positions = useMemo(() => layout(dice.length), [dice.length]);

  const needW = Math.max(...positions.map(([x]) => Math.abs(x))) * 2 + 2.2;
  const scale = Math.min(1, (viewport.width * 0.92) / needW);

  const settledCount = useRef(0);
  const done = useRef(false);
  const handleSettled = useCallback(() => {
    settledCount.current += 1;
    if (settledCount.current >= dice.length && !done.current) {
      done.current = true;
      onAllSettled();
    }
  }, [dice.length, onAllSettled]);

  return (
    <group scale={scale}>
      {dice.map((d, i) => (
        <Die
          key={`${d.type}-${i}`}
          type={d.type}
          value={d.value}
          index={i}
          rest={positions[i]}
          skip={skip}
          onImpact={onImpact}
          onSettled={handleSettled}
        />
      ))}
    </group>
  );
}

export default function DiceScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 6.2, 5.8], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}
      style={{ pointerEvents: "none" }}
    >
      <Env />
      <ambientLight intensity={0.5} color="#ffe8c0" />
      <directionalLight position={[5, 9, 4]} intensity={1.7} color="#ffdf9e" />
      <directionalLight position={[-6, 4, -5]} intensity={0.45} color="#b09a7a" />
      <DiceGroup {...props} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={16} blur={2.4} far={4} color="#000000" />
    </Canvas>
  );
}
