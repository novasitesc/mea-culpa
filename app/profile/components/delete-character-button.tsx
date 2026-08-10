"use client";

// Botón de eliminar personaje.
//
// Antes era un enlace gris de 11px al pie de la tarjeta: la acción más
// irreversible del perfil era también la más invisible. Ahora se anuncia —rojo
// sangre, calavera, halo palpitante y sellos rúnicos 3D girando a los lados—
// sin disfrazarse de acción normal. Sigue abriendo el mismo modal de
// confirmación de siempre.
//
// El 3D es decoración: `pointer-events: none`, y si no hay WebGL o el usuario
// pidió menos movimiento no se monta nada y queda el resplandor CSS.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Skull } from "lucide-react";
import { makeSparkTexture } from "@/app/components/fx/particles";

const SANGRE = "#b2181d";

/** Sello rúnico que flanquea el botón: gira despacio y se acelera al apuntarlo. */
function Sello({ lado, hot }: { lado: -1 | 1; hot: React.RefObject<boolean> }) {
  const malla = useRef<THREE.Mesh>(null);
  const { width } = useThree((s) => s.viewport);
  useFrame((_, delta) => {
    const m = malla.current;
    if (!m) return;
    const v = hot.current ? 2.8 : 0.7;
    m.rotation.y += delta * v;
    m.rotation.x += delta * v * 0.45;
  });
  return (
    <mesh ref={malla} position={[lado * (width / 2 - 0.45), 0, 0]} scale={0.42}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={SANGRE} wireframe />
    </mesh>
  );
}

/** Halo de sangre: hace que el botón irradie sin recurrir a post-proceso. */
function Halo({ hot }: { hot: React.RefObject<boolean> }) {
  const sprite = useRef<THREE.Sprite>(null);
  const { width } = useThree((s) => s.viewport);
  const texture = useMemo(() => makeSparkTexture("255,120,90", "120,10,14"), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ clock }) => {
    const s = sprite.current;
    if (!s) return;
    const latido = (hot.current ? 1.12 : 1) + Math.sin(clock.elapsedTime * 2.2) * 0.04;
    s.scale.set(width * 0.75 * latido, width * 0.28 * latido, 1);
  });
  return (
    <sprite ref={sprite} position={[0, 0, -1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

export default function DeleteCharacterButton({
  onDelete,
  disabled = false,
}: {
  onDelete: () => void;
  disabled?: boolean;
}) {
  // `null` mientras no se sabe: montar el Canvas y desmontarlo provoca un
  // parpadeo, así que no se pinta nada hasta tener la respuesta.
  const [capaz, setCapaz] = useState<boolean | null>(null);
  const hot = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setCapaz(false);
    try {
      const c = document.createElement("canvas");
      setCapaz(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setCapaz(false);
    }
  }, []);

  return (
    <div className="relative inline-flex isolate">
      {/* El lienzo desborda el botón para que las brasas salgan por arriba. */}
      <div className="pointer-events-none absolute -inset-x-9 -inset-y-8 -z-10">
        {capaz === false && (
          <div
            className="absolute inset-0 animate-pulse rounded-full blur-xl"
            style={{ background: "radial-gradient(ellipse at center, rgba(178,24,29,0.4), transparent 70%)" }}
          />
        )}
        {capaz && (
          <Canvas
            orthographic
            camera={{ zoom: 30, position: [0, 0, 10] }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
            style={{ pointerEvents: "none" }}
          >
            <Halo hot={hot} />
            <Sello lado={-1} hot={hot} />
            <Sello lado={1} hot={hot} />
          </Canvas>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        onPointerEnter={() => (hot.current = true)}
        onPointerLeave={() => (hot.current = false)}
        onFocus={() => (hot.current = true)}
        onBlur={() => (hot.current = false)}
        title="Eliminar o matar a este personaje"
        className="group relative inline-flex items-center gap-2.5 rounded-md border-2 border-[#8b1a1a]/70 bg-[#160809]/90 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f0a8a8] shadow-[0_0_20px_-6px_rgba(178,24,29,0.8)] transition-all hover:border-[#e0342c] hover:bg-[#240b0d] hover:text-[#ffdede] hover:shadow-[0_0_26px_-4px_rgba(224,52,44,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0342c]/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        <Skull className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
        Eliminar personaje
      </button>
    </div>
  );
}
