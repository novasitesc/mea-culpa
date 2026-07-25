"use client";

// Número que cuenta hasta su valor con GSAP en vez de saltar de golpe.
// Anima desde el valor anterior, así que al refrescar oro tras una compra la
// cifra rueda desde donde estaba y se ve QUÉ cambió, no solo el resultado.

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { reduceMotion } from "@/lib/useSmoothScroll";

export default function AnimatedNumber({
  value,
  duration = 0.8,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduceMotion()) {
      el.textContent = value.toLocaleString("es-ES");
      prev.current = value;
      return;
    }

    const state = { n: prev.current };
    const tween = gsap.to(state, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = Math.round(state.n).toLocaleString("es-ES");
      },
    });
    prev.current = value;

    return () => {
      tween.kill();
    };
  }, [value, duration]);

  // El 0 inicial solo se ve un frame; el tween lo sustituye enseguida.
  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
