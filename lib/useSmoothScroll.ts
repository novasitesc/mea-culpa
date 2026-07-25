"use client";

// Scroll suave (Lenis) sincronizado con el ScrollTrigger de GSAP.
//
// Se monta por página y no en el layout raíz a propósito: la sala de partida,
// los overlays 3D y el auto-scroll del feed dependen del scroll nativo y del
// `scrollIntoView`, y Lenis se los come. Cada página que lo quiera lo pide.

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** `true` si el usuario pidió menos animación en su sistema. */
export function reduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Activa Lenis mientras el componente esté montado.
 *
 * @param enabled pásalo a `false` cuando la página quede anclada al viewport y
 *   no haya nada que scrollear: montar Lenis sobre un `overflow: hidden` no
 *   aporta nada y deja un rAF corriendo.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || reduceMotion()) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    // ScrollTrigger lee la posición desde Lenis, no del evento nativo.
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [enabled]);
}
