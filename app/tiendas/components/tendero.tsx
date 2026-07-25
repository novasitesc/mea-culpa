"use client";

// El tendero del puesto: un ogro cuyo retrato reacciona a lo que hace el jugador
// (entrar, añadir algo caro, quedarse sin oro, comprar) y un bocadillo que se
// escribe a máquina. Cada frase arranca con el ogro pensando y, cuando ya sabe
// qué decir, cambia a la expresión de esa situación mientras teclea.
// Las frases salen de lib/tienda-tema.ts, derivadas del id de la tienda.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";
import { temaTienda, type SituacionTendero } from "@/lib/tienda-tema";

gsap.registerPlugin(TextPlugin);

/** La cara que pone el ogro en cada situación. */
const RETRATO: Record<SituacionTendero, string> = {
  bienvenida: "/imgs/ogroSonriente.png",
  anadido: "/imgs/ogroFeliz.png",
  caro: "/imgs/ogroDesafiante.png",
  sinOro: "/imgs/ogroDecepcionado.png",
  sinStock: "/imgs/ogroTriste.png",
  compra: "/imgs/ogroRiendose.png",
  vacio: "/imgs/ogroAsustado.png",
};

/** Con la que siempre empieza, mientras rumia la respuesta. */
const PENSANDO = "/imgs/ogroPensante.png";

/** Lo que tarda en pensar antes de abrir la boca. */
const PAUSA_MS = 550;

type Props = {
  shopId: string;
  /** Nombre de la tienda: decide el color junto al id (lib/tienda-tema.ts). */
  shopName?: string;
  keeper: string;
  frase: string;
  /** Qué le está pasando al jugador: elige la cara del ogro. */
  situacion: SituacionTendero;
  /** Cambia con cada frase nueva para reanimar el bocadillo. */
  fraseKey: number;
  size?: "sm" | "md";
};

export default function Tendero({
  shopId,
  shopName,
  keeper,
  frase,
  situacion,
  fraseKey,
  size = "md",
}: Props) {
  const { accent } = temaTienda(shopId, shopName);
  const av = size === "sm" ? "h-12 w-12" : "h-16 w-16";

  const textoRef = useRef<HTMLSpanElement>(null);
  const [cara, setCara] = useState(PENSANDO);
  const pensando = cara === PENSANDO;

  // Frase nueva: el ogro vuelve a poner cara de pensar y, pasada la pausa,
  // cambia a la expresión que toca. La precarga evita que el cambio parpadee:
  // los retratos pesan ~240 KB y si no se pide durante la pausa llega tarde.
  useEffect(() => {
    setCara(PENSANDO);
    new Image().src = RETRATO[situacion];
    const t = setTimeout(() => setCara(RETRATO[situacion]), PAUSA_MS);
    return () => clearTimeout(t);
  }, [fraseKey, situacion]);

  // Ya sabe qué decir: escribe la frase a máquina con GSAP.
  useEffect(() => {
    const el = textoRef.current;
    if (!el) return;
    if (pensando) {
      el.textContent = "";
      return;
    }
    // Quien pida menos movimiento recibe la frase entera, sin teclear.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = frase;
      return;
    }
    const tween = gsap.to(el, {
      text: frase,
      duration: Math.min(1.8, frase.length * 0.028),
      ease: "none",
    });
    return () => {
      tween.kill();
    };
  }, [pensando, frase]);

  return (
    <div className="flex items-center gap-3">
      <motion.span
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={`${av} relative shrink-0 overflow-hidden rounded-full border`}
        style={{
          borderColor: `${accent}99`,
          background: `radial-gradient(circle at 50% 30%, ${accent}33, #0d0b08 75%)`,
        }}
        aria-hidden
      >
        {/* Las dos caras se solapan al cambiar: funde en vez de saltar. */}
        <AnimatePresence>
          <motion.img
            key={cara}
            src={cara}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.82, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </AnimatePresence>
      </motion.span>

      <div className="min-w-0 flex-1">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/35">
          {keeper}
        </p>
        <div className="relative mt-0.5 min-h-[1.4rem]">
          {/* Un lector de pantalla oye la frase entera; si leyera el bocadillo
              la cantaría letra a letra según la teclea GSAP. */}
          <span className="sr-only" aria-live="polite">
            {frase}
          </span>
          <p
            aria-hidden
            className="font-serif text-[13px] italic leading-snug text-[#e8d8b0]/85"
          >
            «<span ref={textoRef} />
            {!pensando && (
              <span className="ml-px not-italic text-[#e8d8b0]/60 animate-pulse">|</span>
            )}
            »
          </p>
        </div>
      </div>
    </div>
  );
}
