"use client";

// Escena three.js de los dados: cámara, luces, físicas y aterrizaje del dado en
// la cara que el servidor ya decidió.

// Escena R3F: los dados entran lanzados desde un lado y RUEDAN por la mesa
// hasta su casilla — rotación ligada cinemáticamente al avance (rodadura sin
// deslizar), rebotes decrecientes y asentado en la cara resuelta por el
// servidor. Coreografía determinista: la animación dirige los callbacks.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getDie, faceRestQuaternion } from "./dice-geometry";
import { getDieMaterials } from "./dice-materials";
import { playTick } from "./dice-sound";
import type { DiceType } from "@/lib/types/dados";

// R3F 9.x aún crea `new THREE.Clock()` internamente y three r183+ lo marca
// deprecado, escupiendo el warning en cada montaje del Canvas (cada tirada).
// Silenciamos SOLO ese mensaje hasta que R3F migre a THREE.Timer; borrar entonces.
// ponytail: filtro puntual por dependencia desactualizada, quitar al actualizar @react-three/fiber
if (typeof window !== "undefined" && !(window as { __clockWarnPatched?: boolean }).__clockWarnPatched) {
  (window as { __clockWarnPatched?: boolean }).__clockWarnPatched = true;
  const orig = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Clock: This module has been deprecated")) return;
    orig(...args);
  };
}

export const DICE_FALL_MS = 2400;
export const DICE_STAGGER_MS = 90;

const THROW_H = 5.2; // altura a la que entra el dado lanzado
const EDGE = "#ffd23c"; // arista dorada brillante: más pop arcade que el oro de la web

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

// Vuelo balístico hasta el primer impacto; después rebotes decrecientes
// mientras el dado sigue avanzando (el avance lo frena la fricción del ease).
const BOUNCES = [
  { from: 0.3, to: 0.52, h: 0.85 },
  { from: 0.52, to: 0.7, h: 0.38 },
  { from: 0.7, to: 0.84, h: 0.15 },
  { from: 0.84, to: 0.93, h: 0.05 },
];

function yCurve(t: number, rest: number): number {
  if (t >= 1) return rest;
  if (t < 0.3) {
    const u = t / 0.3;
    return rest + (THROW_H - rest) * (1 - u * u);
  }
  for (const b of BOUNCES) {
    if (t < b.to) return rest + b.h * bump((t - b.from) / (b.to - b.from));
  }
  return rest;
}

const IMPACTS: Array<{ t: number; intensity: number }> = [
  { t: 0.3, intensity: 1 },
  { t: 0.52, intensity: 0.5 },
  { t: 0.7, intensity: 0.3 },
  { t: 0.84, intensity: 0.17 },
  { t: 0.93, intensity: 0.1 },
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

// Sacudida de cámara: cada impacto inyecta energía que decae exponencialmente.
function CameraShake({ energy }: { energy: { current: number } }) {
  const camera = useThree((s) => s.camera);
  const base = useRef<THREE.Vector3 | null>(null);
  useFrame((_, delta) => {
    base.current ??= camera.position.clone();
    energy.current *= Math.exp(-delta * 9);
    const s = energy.current;
    if (s < 0.002) {
      camera.position.copy(base.current);
      return;
    }
    camera.position.set(
      base.current.x + (Math.random() - 0.5) * 0.14 * s,
      base.current.y + (Math.random() - 0.5) * 0.1 * s,
      base.current.z,
    );
  });
  return null;
}

type DieProps = {
  type: DiceType;
  value: number;
  index: number;
  rest: [number, number]; // x, z de aterrizaje
  /** true → lanzado desde la derecha (la zona de aterrizaje cayó a la izquierda). */
  flip: boolean;
  skip: boolean;
  onImpact: (intensity: number) => void;
  onSettled: () => void;
};

function Die({ type, value, index, rest, flip, skip, onImpact, onSettled }: DieProps) {
  const group = useRef<THREE.Group>(null); // posición + aplaste (mundo, sin rotar)
  const spin = useRef<THREE.Group>(null); // tumbo del dado (rotación)
  const edgeMat = useRef<THREE.LineBasicMaterial>(null);
  const squash = useRef(0); // energía de aplaste, sube en cada impacto y decae
  const settleAt = useRef<number | null>(null);
  const die = useMemo(() => getDie(type), [type]);
  const materials = useMemo(() => getDieMaterials(type), [type]);

  const anim = useMemo(() => {
    const rnd = mulberry32(1337 + index * 7877 + value * 131);
    const startQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2),
    );
    // Lanzados en abanico desde el lado opuesto a la zona de aterrizaje, para
    // cruzar la pantalla. El dado rueda hacia su casilla: eje = dir × up
    // (como una rueda) con leve desvío para que no sean clones.
    const ang = (rnd() - 0.5) * 0.55;
    const dir = [(flip ? -1 : 1) * Math.cos(ang), Math.sin(ang)] as const;
    const dist = 7.5 + rnd() * 2;
    const rollAxis = new THREE.Vector3(
      -dir[1] + (rnd() - 0.5) * 0.2,
      (rnd() - 0.5) * 0.3,
      dir[0] + (rnd() - 0.5) * 0.2,
    ).normalize();
    return {
      startQ,
      dir,
      dist,
      rollAxis,
      targetQ: faceRestQuaternion(type, value),
      delay: (index * DICE_STAGGER_MS) / 1000,
    };
  }, [type, value, index, flip]);

  const t0 = useRef<number | null>(null);
  const prevT = useRef(0);
  const prevQuarter = useRef<number | null>(null);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qRoll = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    const sp = spin.current;
    if (!g || !sp) return;
    if (t0.current === null) t0.current = clock.elapsedTime;

    let t = (clock.elapsedTime - t0.current - anim.delay) / (DICE_FALL_MS / 1000);
    if (skip) t = 1;
    t = Math.max(0, Math.min(1, t));

    const back = anim.dist * (1 - easeOutCubic(t)); // distancia que falta por rodar
    g.position.set(
      rest[0] - anim.dir[0] * back,
      yCurve(t, die.restHeight),
      rest[1] - anim.dir[1] * back,
    );

    const p = easeOutCubic(Math.min(1, t / 0.85));
    q.copy(anim.startQ).slerp(anim.targetQ, p);
    // Rodadura sin deslizar: ángulo restante = distancia restante / radio.
    // Llega a 0 exactamente en la casilla → la cara ganadora queda arriba.
    // El tumbo va en `spin` (hijo): así el aplaste de `g` queda alineado al mundo.
    const theta = back / die.restHeight;
    qRoll.setFromAxisAngle(anim.rollAxis, theta);
    sp.quaternion.multiplyQuaternions(qRoll, q);

    if (!skip) {
      for (const imp of IMPACTS) {
        if (prevT.current < imp.t && t >= imp.t) {
          onImpact(imp.intensity);
          squash.current = Math.min(1, squash.current + imp.intensity * 0.9); // se aplasta contra la mesa
        }
      }
      // Clic seco por cada cuarto de vuelta mientras tumba cerca del suelo.
      const quarter = Math.floor(theta / (Math.PI / 2));
      if (
        prevQuarter.current !== null &&
        quarter !== prevQuarter.current &&
        t < 0.97 &&
        g.position.y < die.restHeight + 0.35
      ) {
        playTick(0.35 + 0.65 * (1 - t));
      }
      prevQuarter.current = quarter;
    }
    prevT.current = t;

    if (t >= 1 && settleAt.current === null) {
      settleAt.current = clock.elapsedTime;
      onSettled();
    }

    // Juice: aplaste vertical en impactos (preserva volumen) + boing al asentar.
    squash.current *= Math.exp(-delta * 12);
    let sy = 1 - squash.current * 0.4;
    let sxz = 1 + squash.current * 0.22;
    if (settleAt.current !== null) {
      const st = clock.elapsedTime - settleAt.current;
      const pop = Math.sin(st * 20) * Math.exp(-st * 7) * 0.16; // rebote amortiguado al caer
      sy += pop;
      sxz -= pop * 0.5;
      if (edgeMat.current) edgeMat.current.opacity = 0.5 + 0.5 * Math.exp(-st * 4); // fogonazo dorado
    }
    g.scale.set(sxz, sy, sxz);
  });

  return (
    <group
      ref={group}
      position={[
        rest[0] - anim.dir[0] * anim.dist,
        THROW_H,
        rest[1] - anim.dir[1] * anim.dist,
      ]}
    >
      <group ref={spin}>
        <mesh geometry={die.geometry} material={materials} />
        <lineSegments geometry={die.edges}>
          <lineBasicMaterial ref={edgeMat} color={EDGE} transparent opacity={0.5} />
        </lineSegments>
      </group>
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
  // Casillas con jitter leve para que la formación no sea una cuadrícula.
  const positions = useMemo(
    () =>
      layout(dice.length).map(
        ([x, z]): [number, number] => [x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5],
      ),
    [dice.length],
  );

  const needW = Math.max(...positions.map(([x]) => Math.abs(x))) * 2 + 2.2;
  const scale = Math.min(1, (viewport.width * 0.92) / needW) * 0.8; // dado 20% más pequeño

  // Zona de aterrizaje aleatoria por tirada: se desplaza el grupo dentro del
  // hueco que deja libre en pantalla (fijado al montar; un resize no teleporta).
  const off = useMemo(() => {
    const freeX = Math.max(0, viewport.width * 0.9 - needW * scale) / 2;
    return [(Math.random() * 2 - 1) * freeX, (Math.random() * 2 - 1) * 1.5] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <group scale={scale} position={[off[0], 0, off[1]]}>
      {dice.map((d, i) => (
        <Die
          key={`${d.type}-${i}`}
          type={d.type}
          value={d.value}
          index={i}
          rest={positions[i]}
          flip={off[0] < 0}
          skip={skip}
          onImpact={onImpact}
          onSettled={handleSettled}
        />
      ))}
    </group>
  );
}

export default function DiceScene(props: SceneProps) {
  const shake = useRef(0);
  const { onImpact } = props;
  const impact = useCallback(
    (i: number) => {
      shake.current = Math.min(1.2, shake.current + i * 0.55);
      onImpact(i);
    },
    [onImpact],
  );

  return (
    <Canvas
      camera={{ position: [0, 6.2, 5.8], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}
      style={{ pointerEvents: "none" }}
    >
      <Env />
      <CameraShake energy={shake} />
      <ambientLight intensity={0.5} color="#ffe8c0" />
      <directionalLight position={[5, 9, 4]} intensity={1.7} color="#ffdf9e" />
      <directionalLight position={[-6, 4, -5]} intensity={0.45} color="#b09a7a" />
      <DiceGroup {...props} onImpact={impact} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={20} blur={2.4} far={4} color="#000000" />
    </Canvas>
  );
}
