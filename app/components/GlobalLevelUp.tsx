"use client";

// Vigila los ascensos de nivel pendientes del jugador y lanza la celebración.
// Ligero a propósito: sólo hace fetch a un endpoint pequeño; el overlay (y con
// él `three`) se descarga sólo cuando de verdad hay un ascenso que mostrar.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import type { LevelUpData } from "./level-up-overlay";

const LevelUpOverlay = dynamic(() => import("./level-up-overlay"), { ssr: false });

export default function GlobalLevelUp() {
  const { isAuthenticated } = useAuth();
  const [queue, setQueue] = useState<LevelUpData[]>([]);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!isAuthenticated || checking.current) return;
    checking.current = true;
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch("/api/profile/level-ups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { pending?: LevelUpData[] };
      const pending = data.pending ?? [];
      if (pending.length === 0) return;

      // Sustituye la cola en vez de concatenar: el endpoint ya devuelve el
      // estado completo, así un chequeo repetido no duplica celebraciones.
      setQueue((prev) => (prev.length > 0 ? prev : pending));
    } catch {
      // silencioso — un fallo de red no debe romper la navegación
    } finally {
      checking.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setQueue([]);
      return;
    }
    check();
    // Sin polling periódico: la celebración se dispara en los momentos en que
    // el nivel pudo cambiar (cierre de partida → "profile:refresh") o al volver
    // a la pestaña. Así no colisiona con el cierre ceremonial de la partida.
    const onRefresh = () => check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("profile:refresh", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("profile:refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated, check]);

  const current = queue[0] ?? null;

  const dismiss = useCallback(async () => {
    if (!current) return;
    setQueue((prev) => prev.slice(1));
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch("/api/profile/level-ups", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: current.characterId }),
      });
    } catch {
      // Si falla el marcado, el ascenso vuelve a salir en el próximo chequeo:
      // preferimos repetir la animación antes que tragárnosla.
    }
  }, [current]);

  if (!current) return null;

  return <LevelUpOverlay key={current.characterId} data={current} onClose={dismiss} />;
}
