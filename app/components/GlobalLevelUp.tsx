"use client";

// Vigila las subidas de nivel pendientes y lanza su animación en cualquier
// pantalla.

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
  // Personajes ya celebrados en esta pestaña. El marcado en servidor es
  // asíncrono, así que un chequeo que corra antes de que aterrice el POST
  // volvería a devolverlos: este filtro evita repetir la animación.
  const celebrados = useRef<Set<number>>(new Set());

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
      const pending = (data.pending ?? []).filter(
        (p) => !celebrados.current.has(p.characterId),
      );
      if (pending.length === 0) return;

      // El endpoint devuelve el estado completo. Si la cola ya coincide se
      // devuelve `prev` para no remontar el overlay a media animación; si no,
      // se reemplaza (cubre el cambio de usuario tras cerrar sesión).
      setQueue((prev) => {
        const igual =
          prev.length === pending.length &&
          prev.every((p, i) => p.characterId === pending[i].characterId);
        return igual ? prev : pending;
      });
    } catch {
      // silencioso — un fallo de red no debe romper la navegación
    } finally {
      checking.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
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

  // Al cerrar sesión no se pinta nada aunque la cola siga en memoria: el
  // siguiente usuario no debe ver el ascenso del anterior.
  const current = isAuthenticated ? (queue[0] ?? null) : null;

  const dismiss = useCallback(async () => {
    if (!current) return;
    celebrados.current.add(current.characterId);
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
