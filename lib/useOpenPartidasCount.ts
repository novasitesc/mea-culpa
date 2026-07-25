"use client";

// Cuántas partidas abiertas quedan por llenar. Lo pintan el sidebar y el navbar,
// así que vive aquí y no duplicado en los dos: si no, cada uno abriría su propio
// sondeo de 30 s contra /api/partidas.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

type OpenPartida = { isFull: boolean };

/** Nº de partidas con hueco, o `null` mientras no se sepa (sin sesión o error). */
export function useOpenPartidasCount(): number | null {
  const { token, isAuthenticated } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setCount(null);
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/partidas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No se pudieron cargar las partidas");
        const data = (await res.json()) as OpenPartida[];
        if (isMounted) setCount((data ?? []).filter((g) => !g.isFull).length);
      } catch {
        if (isMounted) setCount(null);
      }
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, token]);

  return count;
}
