"use client";

// Overlay a pantalla completa con escena WebGL / Three.js y animación de bajas
// en el ejército. Se reproduce en vivo para toda la sala cuando el DM descuenta tropas
// o aniquila una unidad.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Skull, Users, ShieldAlert } from "lucide-react";
import * as THREE from "three";
import { playEjercitoBajaSfx } from "@/lib/sfx";
import { getIconForString } from "@/lib/iconMapper";
import { makeSparkTexture, randomPhases, randomSpeeds, sphereDirections } from "./fx/particles";
import type { EventoEjercitoBaja } from "@/lib/types/sala";

type Props = {
  evento: EventoEjercitoBaja;
  esPropio: boolean;
  onDone: () => void;
};

/**
 * Escena 3D: Chispas de combate, brasas de guerra y anillo de choque
 */
function BattleSparks({ count = 120, aniquilada = false }: { count?: number; aniquilada?: boolean }) {
  const points = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(
    () => (aniquilada ? makeSparkTexture("255,80,60", "180,20,20") : makeSparkTexture("255,200,80", "220,50,30")),
    [aniquilada],
  );

  const { geometry, dirs, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = sphereDirections(count, 0.7);
    const speeds = randomSpeeds(count, 3.5, 9.5);
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

  useFrame((_, delta) => {
    if (!points.current) return;
    const pos = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const speed = speeds[i];
      // Expansión explosiva de chispas desde el centro
      arr[idx] += dirs[idx] * speed * delta;
      arr[idx + 1] += dirs[idx + 1] * speed * delta - 1.2 * delta; // gravedad sutil
      arr[idx + 2] += dirs[idx + 2] * speed * delta;
    }
    pos.needsUpdate = true;

    // Anillo de choque expandiéndose
    if (ringRef.current) {
      ringRef.current.scale.x += delta * 4.5;
      ringRef.current.scale.y += delta * 4.5;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0) {
        mat.opacity = Math.max(0, mat.opacity - delta * 0.9);
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <points ref={points} geometry={geometry}>
        <pointsMaterial
          map={texture}
          size={aniquilada ? 0.38 : 0.28}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.9}
        />
      </points>

      {/* Onda expansiva de impacto */}
      <mesh ref={ringRef} rotation={[-Math.PI / 3, 0, 0]}>
        <ringGeometry args={[0.8, 1.15, 32]} />
        <meshBasicMaterial
          color={aniquilada ? "#dc2626" : "#f59e0b"}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function EjercitoBajaOverlay({ evento, esPropio, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    playEjercitoBajaSfx(evento.aniquilada);
    const visibleMs = evento.aniquilada ? 4800 : 3400;
    const t1 = window.setTimeout(() => setLeaving(true), visibleMs);
    const t2 = window.setTimeout(onDone, visibleMs + 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [evento.aniquilada, onDone]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(onDone, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-[75] flex items-center justify-center overflow-hidden pointer-events-auto select-none ${
        leaving ? "cd-overlay-out pointer-events-none" : "cd-vignette-in"
      }`}
      onClick={dismiss}
      role="alertdialog"
      aria-label="Bajas en el ejército"
    >
      {/* Viñeta de guerra */}
      <div
        className="absolute inset-0"
        style={{
          background: evento.aniquilada
            ? "radial-gradient(ellipse at center, rgba(20,4,4,0.85) 0%, rgba(45,8,8,0.94) 60%, rgba(85,10,14,0.98) 100%)"
            : "radial-gradient(ellipse at center, rgba(16,8,4,0.75) 0%, rgba(38,15,8,0.88) 60%, rgba(70,20,10,0.95) 100%)",
        }}
      />

      {/* Borde heráldico de combate */}
      <div className="absolute inset-6 sm:inset-10 rounded-2xl border border-amber-700/30 pointer-events-none" />

      {/* Escena 3D WebGL de chispas y choque de combate */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }} gl={{ antialias: false, alpha: true }}>
          <BattleSparks count={evento.aniquilada ? 160 : 90} aniquilada={evento.aniquilada} />
        </Canvas>
      </div>

      {/* HUD del impacto */}
      <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-5 px-6 text-center max-w-lg cd-defeat-quake">
        {/* Icono de la unidad / espada rota */}
        <motion.div
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
          className="relative flex items-center justify-center"
        >
          <span
            className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border-2 shadow-2xl"
            style={{
              borderColor: evento.aniquilada ? "rgba(220,38,38,0.8)" : "rgba(245,158,11,0.8)",
              background: evento.aniquilada
                ? "radial-gradient(circle, rgba(185,28,28,0.4) 0%, rgba(0,0,0,0.8) 100%)"
                : "radial-gradient(circle, rgba(217,119,6,0.35) 0%, rgba(0,0,0,0.8) 100%)",
              boxShadow: evento.aniquilada
                ? "0 0 35px rgba(220,38,38,0.6)"
                : "0 0 30px rgba(245,158,11,0.5)",
            }}
          >
            {getIconForString(evento.unidadNombre, "w-12 h-12 sm:w-14 sm:h-14 text-white", evento.unidadIcono)}
          </span>

          {/* Sello de bajas o calavera de aniquilación */}
          <span
            className={`absolute -bottom-2 -right-2 flex h-8 min-w-8 items-center justify-center rounded-full border px-2 font-sans text-xs font-bold shadow-lg ${
              evento.aniquilada
                ? "border-red-500 bg-red-950 text-red-200"
                : "border-amber-500 bg-amber-950 text-amber-200"
            }`}
          >
            {evento.aniquilada ? <Skull className="h-4 w-4 text-red-400" /> : `-${evento.bajas}`}
          </span>
        </motion.div>

        {/* Título de impacto */}
        <h2
          className={`font-serif uppercase tracking-wide drop-shadow-md ${
            evento.aniquilada ? "text-red-400" : "text-amber-400"
          }`}
          style={{ fontSize: "clamp(1.4rem, 5vw, 2.4rem)" }}
        >
          {evento.aniquilada
            ? esPropio
              ? "¡Regimiento Aniquilado!"
              : `¡${evento.personajeNombre} perdió un regimiento!`
            : esPropio
              ? "¡Bajas en tu ejército!"
              : `¡Bajas para ${evento.personajeNombre}!`}
        </h2>

        {/* Detalle de bajas */}
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-white/10 bg-black/60 px-5 py-3.5 backdrop-blur-md">
          <p className="font-serif text-base text-[#e8d8b0]">
            {evento.unidadNombre}
          </p>

          <div className="flex items-center gap-4 text-sm font-sans">
            <span className="flex items-center gap-1.5 font-semibold text-red-400">
              <Swords className="h-4 w-4" />
              -{evento.bajas.toLocaleString("es-ES")} soldados
            </span>

            <span className="h-3 w-px bg-white/20" />

            <span className="flex items-center gap-1.5 text-foreground/70">
              <Users className="h-4 w-4 opacity-70" />
              {evento.aniquilada ? "0 en pie" : `${evento.restante.toLocaleString("es-ES")} en pie`}
            </span>
          </div>

          {evento.aniquilada ? (
            <p className="mt-1 inline-flex items-center gap-1.5 font-sans text-xs text-red-300">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              La casilla quedó completamente vacía.
            </p>
          ) : (
            <p className="font-sans text-[11px] text-foreground/45">
              Los soldados restantes continúan en la expedición.
            </p>
          )}
        </div>

        <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mt-1">
          Toca para continuar
        </p>
      </div>
    </div>
  );
}
