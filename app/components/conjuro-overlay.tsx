"use client";

// Lanzamiento de conjuro: overlay a pantalla completa con escena R3F. Un
// círculo de invocación se dibuja bajo el conjurador, la energía se arremolina
// hacia el centro y se descarga en un frente de partículas, todo teñido por la
// escuela del conjuro. Importado dinámicamente: `three` sólo baja al lanzar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import * as THREE from "three";
import { playConjuroSfx } from "@/lib/sfx";
import { schoolRgb } from "@/lib/spells";
import {
  clamp01,
  easeOutCubic,
  makeSparkTexture,
  randomPhases,
  randomSpeeds,
  sphereDirections,
} from "./fx/particles";

export type ConjuroFxData = {
  personajeNombre: string;
  conjuro: string;
  spellLevel: number;
  escuela: string | null;
};

/** Instante de la descarga, en segundos. El sfx está sincronizado con él. */
const CAST_AT = 0.55;
const TOTAL_MS = 2900;

const rgbCss = (rgb: string, alpha = 1) => `rgba(${rgb},${alpha})`;

/**
 * Motas que orbitan hacia el centro durante la canalización y salen disparadas
 * en la descarga. Un solo THREE.Points: una llamada de dibujo para toda la nube.
 */
function Vortice({ count, core, edge }: { count: number; core: string; edge: string }) {
  const points = useRef<THREE.Points>(null);
  const texture = useMemo(() => makeSparkTexture(core, edge), [core, edge]);

  const { geometry, dirs, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = sphereDirections(count, 0.55);
    const speeds = randomSpeeds(count, 3, 8);
    const phases = randomPhases(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, dirs, speeds, phases };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  useFrame(({ clock }) => {
    const p = points.current;
    if (!p) return;
    const t = clock.elapsedTime;
    const arr = geometry.attributes.position.array as Float32Array;
    const mat = p.material as THREE.PointsMaterial;

    if (t < CAST_AT) {
      // Canalización: espiral que se cierra sobre el centro.
      const u = 1 - clamp01(t / CAST_AT);
      const giro = t * 3.4;
      for (let i = 0; i < count; i++) {
        const radio = 0.6 + u * u * 5.5;
        const ang = phases[i] + giro;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        // Rotar la dirección base alrededor de Y: da el remolino sin trigonometría por eje
        arr[i * 3] = (dirs[i * 3] * cos - dirs[i * 3 + 2] * sin) * radio;
        arr[i * 3 + 1] = dirs[i * 3 + 1] * radio * 0.6;
        arr[i * 3 + 2] = (dirs[i * 3] * sin + dirs[i * 3 + 2] * cos) * radio;
      }
      mat.opacity = 0.25 + (1 - u) * 0.75;
    } else {
      // Descarga: frente que se expande y se apaga.
      const e = t - CAST_AT;
      const avance = easeOutCubic(Math.min(1, e / 1.5));
      for (let i = 0; i < count; i++) {
        const d = 0.5 + avance * speeds[i];
        arr[i * 3] = dirs[i * 3] * d;
        arr[i * 3 + 1] = dirs[i * 3 + 1] * d + e * 0.35; // la magia asciende al disiparse
        arr[i * 3 + 2] = dirs[i * 3 + 2] * d;
      }
      mat.opacity = Math.max(0, 1 - e / 1.9);
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        map={texture}
        size={0.28}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0}
      />
    </points>
  );
}

/**
 * Círculo de invocación: dos aros concéntricos en escorzo que giran en sentidos
 * opuestos mientras se canaliza y se abren de golpe con la descarga.
 * El número de segmentos del aro interior sube con el nivel del conjuro.
 */
function CirculoInvocacion({ color, spellLevel }: { color: string; spellLevel: number }) {
  const externo = useRef<THREE.Mesh>(null);
  const runas = useRef<THREE.Mesh>(null);
  const segmentos = Math.max(4, Math.min(12, 4 + spellLevel));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const carga = clamp01(t / CAST_AT);
    const tras = Math.max(0, t - CAST_AT);
    const escala = t < CAST_AT ? 0.7 + carga * 0.5 : 1.2 + easeOutCubic(Math.min(1, tras / 1.2)) * 1.6;
    const fade = Math.max(0, 1 - tras / 1.8);

    if (externo.current) {
      externo.current.rotation.z = t * (t < CAST_AT ? 1 + carga * 4 : 1.1);
      externo.current.scale.setScalar(escala);
      (externo.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.8;
    }
    if (runas.current) {
      runas.current.rotation.z = -t * (t < CAST_AT ? 1.6 + carga * 6 : 1.8);
      runas.current.scale.setScalar(escala * 0.66);
      (runas.current.material as THREE.MeshBasicMaterial).opacity = fade;
    }
  });

  return (
    <group rotation={[Math.PI / 2.3, 0, 0]}>
      <mesh ref={externo}>
        <torusGeometry args={[2, 0.028, 8, 88]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={runas}>
        <torusGeometry args={[2, 0.055, 6, segmentos]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Frente de choque plano en el instante de la descarga. */
function Descarga({ color }: { color: string }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const e = clock.elapsedTime - CAST_AT;
    if (e < 0) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const u = Math.min(1, e / 0.85);
    m.scale.setScalar(0.25 + easeOutCubic(u) * 6);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.5;
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2.3, 0, 0]} visible={false}>
      <ringGeometry args={[0.88, 1, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Núcleo luminoso que se carga y estalla. */
function Nucleo({ core, edge }: { core: string; edge: string }) {
  const sprite = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => makeSparkTexture(core, edge), [core, edge]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    const s = sprite.current;
    if (!s) return;
    const t = clock.elapsedTime;
    const carga = clamp01(t / CAST_AT);
    const tras = Math.max(0, t - CAST_AT);
    const size = t < CAST_AT ? 0.7 + carga * 1.8 : 5 * Math.max(0, 1 - tras / 1.1) + 0.9;
    s.scale.set(size, size, 1);
    (s.material as THREE.SpriteMaterial).opacity =
      t < CAST_AT ? carga * 0.8 : Math.max(0, 1 - tras / 1.5) * 0.95;
  });

  return (
    <sprite ref={sprite}>
      <spriteMaterial map={texture} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0} />
    </sprite>
  );
}

function ConjuroScene({
  motas,
  core,
  edge,
  spellLevel,
}: {
  motas: number;
  core: string;
  edge: string;
  spellLevel: number;
}) {
  const color = useMemo(() => new THREE.Color(`rgb(${edge})`), [edge]);
  return (
    <Canvas
      camera={{ position: [0, 1.2, 8.5], fov: 46 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <Nucleo core={core} edge={edge} />
      <CirculoInvocacion color={color.getStyle()} spellLevel={spellLevel} />
      <Descarga color={color.getStyle()} />
      <Vortice count={motas} core={core} edge={edge} />
    </Canvas>
  );
}

type Props = {
  data: ConjuroFxData;
  onDone: () => void;
};

export default function ConjuroOverlay({ data, onDone }: Props) {
  const [core, edge] = schoolRgb(data.escuela);
  const [revelado, setRevelado] = useState(false);

  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const { animate3d, motas } = useMemo(() => {
    if (typeof window === "undefined") return { animate3d: false, motas: 0 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return { animate3d: false, motas: 0 };
    }
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    const cores = navigator.hardwareConcurrency ?? 4;
    return { animate3d: webgl, motas: cores <= 4 ? 120 : 220 };
  }, []);

  useEffect(() => {
    playConjuroSfx(data.escuela, data.spellLevel);
    const reveal = window.setTimeout(() => setRevelado(true), animate3d ? CAST_AT * 1000 : 80);
    const timer = window.setTimeout(finish, TOTAL_MS);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(timer);
    };
  }, [animate3d, data.escuela, data.spellLevel, finish]);

  return createPortal(
    // pointer-events-none: la sala sigue usable, el conjuro es un adorno que pasa.
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label={`${data.personajeNombre} lanza ${data.conjuro}`}
    >
      {/* Tinte de escuela: apenas un velo, sin tapar la sala */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: TOTAL_MS / 1000, times: [0, CAST_AT / (TOTAL_MS / 1000), 1] }}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${rgbCss(edge, 0.22)}, transparent 65%)`,
        }}
      />

      {animate3d && (
        <div className="absolute inset-0">
          <ConjuroScene motas={motas} core={core} edge={edge} spellLevel={data.spellLevel} />
        </div>
      )}

      {revelado && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 14 }}
          animate={{ opacity: [0, 1, 1, 0], scale: 1, y: 0 }}
          transition={{ duration: 2.1, times: [0, 0.12, 0.7, 1] }}
          className="relative z-10 text-center px-6 select-none"
        >
          <p
            className="font-serif text-2xl sm:text-4xl"
            style={{ color: rgbCss(core), textShadow: `0 0 26px ${rgbCss(edge, 0.85)}` }}
          >
            {data.conjuro}
          </p>
          <p className="mt-1.5 text-[11px] uppercase tracking-[0.3em] font-sans text-foreground/60">
            {data.personajeNombre}
            {data.escuela ? ` · ${data.escuela}` : ""}
            {data.spellLevel === 0 ? " · Truco" : ` · Nivel ${data.spellLevel}`}
          </p>
        </motion.div>
      )}
    </div>,
    document.body,
  );
}
