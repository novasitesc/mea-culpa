"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Debe coincidir con el duration-200 de las clases de animación.
export const MODAL_EXIT_MS = 200;

export function modalOverlayCls(closing: boolean) {
  return closing
    ? "animate-out fade-out duration-200"
    : "animate-in fade-in duration-200";
}

export function modalPanelCls(closing: boolean) {
  return closing
    ? "animate-out fade-out zoom-out-95 slide-out-to-bottom-2 duration-200"
    : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200";
}

/**
 * Transición de cierre para modales: `closeWith(callback)` reproduce la
 * animación de salida y ejecuta el callback (normalmente el onClose que
 * desmonta el modal) cuando termina. `closing` alimenta modalOverlayCls /
 * modalPanelCls para alternar entre animación de entrada y de salida.
 */
export function useModalTransition() {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const closeWith = useCallback((after: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = window.setTimeout(after, MODAL_EXIT_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { closing, closeWith };
}
