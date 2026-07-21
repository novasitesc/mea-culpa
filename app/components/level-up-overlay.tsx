"use client";

// Animación de subida de nivel.

// Ascenso de nivel: overlay a pantalla completa con una escena R3F — sello
// rúnico que carga, estalla en partículas y deja los anillos girando — más el
// cartel del nuevo nivel. Este archivo se importa dinámicamente, así que
// `three` sólo se descarga cuando de verdad hay un ascenso que celebrar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { ChevronsUp } from "lucide-react";
import { playSubidaNivelSfx } from "@/lib/sfx";
import { clamp01, easeOutCubic, makeSparkTexture, randomSpeeds, sphereDirections } from "./fx/particles";

export type LevelUpData = {
  characterId: number;
  characterName: string;
  portrait: string | null;
  from: number;
  to: number;
  classes: Array<{ className: string; level: number }>;
};

/** Momento del estallido, en segundos. El sfx está sincronizado con él. */
const BURST_AT = 0.8;
const TOTAL_MS = 6800;
const GOLD = "#D4AF37";

/** Chispas: convergen hacia el centro, estallan y caen. Un solo draw call. */
function Sparks({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const texture = useMemo(() => makeSparkTexture(), []);

  const { geometry, dirs, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = sphereDirections(count);
    const speeds = randomSpeeds(count, 2.6, 8);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, dirs, speeds };
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

    if (t < BURST_AT) {
      // Carga: las chispas caen hacia el sello desde fuera del encuadre.
      const u = 1 - clamp01(t / BURST_AT);
      for (let i = 0; i < count; i++) {
        const d = 1.2 + u * u * 7;
        arr[i * 3] = dirs[i * 3] * d;
        arr[i * 3 + 1] = dirs[i * 3 + 1] * d;
        arr[i * 3 + 2] = dirs[i * 3 + 2] * d;
      }
      (p.material as THREE.PointsMaterial).opacity = 0.35 + (1 - u) * 0.65;
    } else {
      // Estallido: expansión con rozamiento y una gravedad suave.
      const e = t - BURST_AT;
      const spread = easeOutCubic(Math.min(1, e / 2.2));
      for (let i = 0; i < count; i++) {
        const d = 0.9 + spread * speeds[i];
        arr[i * 3] = dirs[i * 3] * d;
        arr[i * 3 + 1] = dirs[i * 3 + 1] * d - e * e * 0.55;
        arr[i * 3 + 2] = dirs[i * 3 + 2] * d;
      }
      (p.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - e / 3.4);
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        map={texture}
        size={0.34}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0}
      />
    </points>
  );
}

/** Los dos anillos rúnicos: cargan girando, el estallido los abre. */
function Runes() {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const charge = clamp01(t / BURST_AT);
    const after = Math.max(0, t - BURST_AT);
    // Antes: acelera y se encoge. Después: salta de tamaño y frena.
    const scale = t < BURST_AT ? 1.5 - charge * 0.7 : 0.8 + easeOutCubic(Math.min(1, after / 1.4)) * 1.5;
    const fade = Math.max(0, 1 - after / 3.2);

    if (outer.current) {
      outer.current.rotation.z = t * (t < BURST_AT ? 1.2 + charge * 5 : 1.4);
      outer.current.scale.setScalar(scale);
      (outer.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
    }
    if (inner.current) {
      inner.current.rotation.z = -t * (t < BURST_AT ? 1.8 + charge * 7 : 2.1);
      inner.current.scale.setScalar(scale * 0.62);
      (inner.current.material as THREE.MeshBasicMaterial).opacity = fade;
    }
  });

  return (
    <group rotation={[Math.PI / 2.6, 0, 0]}>
      <mesh ref={outer}>
        <torusGeometry args={[2.1, 0.035, 8, 96]} />
        <meshBasicMaterial color={GOLD} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={inner}>
        <torusGeometry args={[2.1, 0.06, 8, 6]} />
        <meshBasicMaterial color="#fff3c4" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Onda expansiva plana: un disco que crece y se desvanece tras el estallido. */
function Shockwave() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const e = clock.elapsedTime - BURST_AT;
    if (e < 0) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const u = Math.min(1, e / 1.1);
    m.scale.setScalar(0.3 + easeOutCubic(u) * 7);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.55;
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2.6, 0, 0]} visible={false}>
      <ringGeometry args={[0.86, 1, 72]} />
      <meshBasicMaterial
        color="#fff0bf"
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Columna de luz que se enciende con la carga y se apaga tras el estallido. */
function Glow() {
  const sprite = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => makeSparkTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    const s = sprite.current;
    if (!s) return;
    const t = clock.elapsedTime;
    const charge = clamp01(t / BURST_AT);
    const after = Math.max(0, t - BURST_AT);
    const size = t < BURST_AT ? 1 + charge * 2.4 : 6 * Math.max(0, 1 - after / 1.6) + 1.4;
    s.scale.set(size, size, 1);
    (s.material as THREE.SpriteMaterial).opacity =
      t < BURST_AT ? charge * 0.7 : Math.max(0, 1 - after / 2.4) * 0.9;
  });

  return (
    <sprite ref={sprite}>
      <spriteMaterial
        map={texture}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        opacity={0}
      />
    </sprite>
  );
}

/** Sacudida de cámara en el estallido: energía inyectada que decae. */
function Shake() {
  const camera = useThree((s) => s.camera);
  const base = useRef<THREE.Vector3 | null>(null);
  const fired = useRef(false);
  const energy = useRef(0);

  useFrame(({ clock }, delta) => {
    base.current ??= camera.position.clone();
    if (!fired.current && clock.elapsedTime >= BURST_AT) {
      fired.current = true;
      energy.current = 1;
    }
    energy.current *= Math.exp(-delta * 6);
    if (energy.current < 0.003) {
      camera.position.copy(base.current);
      return;
    }
    camera.position.set(
      base.current.x + (Math.random() - 0.5) * 0.22 * energy.current,
      base.current.y + (Math.random() - 0.5) * 0.18 * energy.current,
      base.current.z,
    );
  });
  return null;
}

function LevelUpScene({ sparks }: { sparks: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 46 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <Shake />
      <Glow />
      <Runes />
      <Shockwave />
      <Sparks count={sparks} />
    </Canvas>
  );
}

type Props = {
  data: LevelUpData;
  onClose: () => void;
};

export default function LevelUpOverlay({ data, onClose }: Props) {
  const [revealed, setRevealed] = useState(false);

  // El toque y el temporizador pueden coincidir; sin este cerrojo la segunda
  // llamada descartaría el siguiente ascenso de la cola sin mostrarlo.
  const closedRef = useRef(false);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  // WebGL + preferencias de movimiento: sin una de las dos, versión 2D.
  // También bajamos la cuenta de chispas en equipos con pocos núcleos.
  const { animate3d, sparks } = useMemo(() => {
    if (typeof window === "undefined") return { animate3d: false, sparks: 0 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return { animate3d: false, sparks: 0 };
    }
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    const cores = navigator.hardwareConcurrency ?? 4;
    return { animate3d: webgl, sparks: cores <= 4 ? 140 : 260 };
  }, []);

  useEffect(() => {
    playSubidaNivelSfx();
    const reveal = window.setTimeout(() => setRevealed(true), animate3d ? BURST_AT * 1000 : 120);
    const closeTimer = window.setTimeout(close, TOTAL_MS);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(closeTimer);
    };
  }, [animate3d, close]);

  const ganados = Math.max(1, data.to - data.from);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden"
      onPointerDown={close}
      role="dialog"
      aria-modal="true"
      aria-label={`${data.characterName} sube a nivel ${data.to}`}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {animate3d && (
        <div className="absolute inset-0">
          <LevelUpScene sparks={sparks} />
        </div>
      )}

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative z-10 px-6 text-center pointer-events-none select-none"
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-[11px] sm:text-xs uppercase tracking-[0.45em] text-[#D4AF37]/80 font-sans"
            >
              Ascenso
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.06em" }}
              transition={{ delay: 0.05, duration: 0.7, ease: "easeOut" }}
              className="mt-2 font-serif text-3xl sm:text-5xl text-[#F5E6B8]"
              style={{ textShadow: "0 0 28px rgba(212,175,55,0.65)" }}
            >
              {data.characterName}
            </motion.h2>

            <div className="mt-5 flex items-center justify-center gap-3 sm:gap-5">
              <span className="font-serif text-2xl sm:text-4xl text-foreground/35 line-through decoration-[#8B7355]/60">
                {data.from}
              </span>
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ChevronsUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#D4AF37]" />
              </motion.span>
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.34, type: "spring", stiffness: 400, damping: 14 }}
                className="font-serif font-bold text-5xl sm:text-7xl text-[#D4AF37]"
                style={{ textShadow: "0 0 34px rgba(212,175,55,0.8)" }}
              >
                {data.to}
              </motion.span>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-sm text-[#F5E6B8]/70 font-sans"
            >
              {ganados === 1 ? "Sube 1 nivel" : `Sube ${ganados} niveles`}
              {data.classes.length > 0 && (
                <span className="block mt-1 text-xs text-foreground/50">
                  {data.classes.map((c) => `${c.className} Nv.${c.level}`).join(" · ")}
                </span>
              )}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              transition={{ delay: 1.6 }}
              className="mt-8 text-[10px] uppercase tracking-widest text-foreground/60 font-sans"
            >
              Toca para continuar
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
