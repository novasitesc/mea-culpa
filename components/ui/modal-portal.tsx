"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Monta el contenido directamente en <body>.
 *
 * Un modal `fixed` deja de posicionarse respecto al viewport si algún ancestro
 * tiene transform/filter/backdrop-filter (los paneles animados del admin los
 * tienen), y entonces aparece centrado dentro del módulo: si la lista es larga,
 * el modal cae muy por debajo de la pantalla. Sacándolo del árbol del módulo
 * queda siempre por encima de todo y centrado en la ventana.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
