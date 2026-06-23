"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import FantasyAlert from "@/components/ui/fantasy-alert";

type SleepOption = {
  id: string;
  name: string;
  description: string;
  cost: number;
  homeLabel: string;
};

type SleepPendingCharacter = {
  pendingId: string;
  characterId: number;
  characterName: string;
  partidaId: string | null;
  partidaTitle: string;
  requiredAt: string | null;
  partidaFinalizedAt: string | null;
};

type SleepStatusResponse = {
  playerGold: number;
  options: SleepOption[];
  pendingCharacters: SleepPendingCharacter[];
};

type Alert = {
  id: number;
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
};

export default function GlobalSleepModal() {
  const { isAuthenticated, token, user } = useAuth();
  const [sleepStatus, setSleepStatus] = useState<SleepStatusResponse | null>(null);
  const [loadingSleepStatus, setLoadingSleepStatus] = useState(false);
  const [resolvingSleep, setResolvingSleep] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const isFetching = useRef(false);

  const showAlert = (title: string, message: string, variant: Alert["variant"]) => {
    setAlert({ id: Date.now(), title, message, variant });
  };

  const loadSleepStatus = useCallback(async () => {
    if (!isAuthenticated || !token || isFetching.current) return;

    isFetching.current = true;
    setLoadingSleepStatus(true);
    try {
      const res = await fetch("/api/profile/sleep-options", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as SleepStatusResponse;
      setSleepStatus(data);
    } catch {
      // silent — no interrumpir la sesión del usuario por un error de polling
    } finally {
      setLoadingSleepStatus(false);
      setTimeout(() => { isFetching.current = false; }, 1000);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    loadSleepStatus();
    const id = window.setInterval(loadSleepStatus, 60_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, token, loadSleepStatus]);

  // Suscripción Realtime: detecta el INSERT en descansos_pendientes al instante
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`sleep-pending-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "descansos_pendientes",
          filter: `usuario_id=eq.${user.id}`,
        },
        () => { loadSleepStatus(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, user?.id, loadSleepStatus]);

  const pendingCharacter = sleepStatus?.pendingCharacters?.[0] ?? null;

  const resolveSleepDecision = async (
    pendingId: string,
    action: "pay" | "decline",
    optionId?: string,
  ) => {
    if (!token) return;
    setResolvingSleep(true);
    try {
      const res = await fetch("/api/profile/sleep-options", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pendingId, action, optionId: optionId ?? null }),
      });

      const data = await res.json().catch(() => ({}));
      const message = String(data.message ?? "No se pudo resolver el descanso");

      if (!res.ok && !data.eliminated && !data.dead) {
        throw new Error(String(data.error ?? message));
      }

      showAlert(
        data.dead ? "Cansancio acumulado" : data.eliminated ? "Personaje eliminado" : "Descanso resuelto",
        message,
        data.dead ? "warning" : data.eliminated ? "error" : "success",
      );

      setShowConfirm(false);

      if (typeof data.newGold === "number") {
        window.dispatchEvent(new CustomEvent("auth:refresh", { detail: { oro: data.newGold } }));
      }

      window.dispatchEvent(new CustomEvent("profile:refresh"));
      await loadSleepStatus();
    } catch (error) {
      showAlert(
        "No se pudo resolver",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setResolvingSleep(false);
    }
  };

  if (!pendingCharacter) return null;

  return (
    <>
      {alert && (
        <FantasyAlert
          key={alert.id}
          open
          title={alert.title}
          message={alert.message}
          variant={alert.variant}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-xl border-2 border-[#8B7355] bg-[#12100d] p-6 shadow-2xl space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#B8860B]">
              Descanso Obligatorio
            </p>
            <h2 className="text-2xl font-serif text-[#D4AF37] mt-2">
              {pendingCharacter.characterName} debe elegir donde dormir
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              La partida &quot;{pendingCharacter.partidaTitle}&quot; finalizó. Si no pagas el
              descanso, el personaje acumulará un punto de cansancio.
            </p>
          </div>

          <div className="rounded border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
            Oro disponible:{" "}
            <span className="text-yellow-400 font-semibold">
              {(sleepStatus?.playerGold ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="space-y-3">
            {(sleepStatus?.options ?? []).map((option) => {
              const canPay = (sleepStatus?.playerGold ?? 0) >= option.cost;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    resolveSleepDecision(pendingCharacter.pendingId, "pay", option.id)
                  }
                  disabled={resolvingSleep || loadingSleepStatus}
                  className="w-full text-left rounded border border-border bg-background/60 p-4 hover:border-[#D4AF37] hover:bg-background transition disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">{option.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#D4AF37] font-bold">{option.cost} oro</p>
                      {!canPay && <p className="text-xs text-red-400">No alcanza</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={resolvingSleep || loadingSleepStatus}
              className="w-full px-4 py-2 rounded border border-red-700/60 text-red-300 hover:bg-red-900/20 transition disabled:opacity-60"
            >
              No pagar (acumular punto de cansancio)
            </button>
          </div>
        </div>

        {showConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-md rounded-xl border border-red-700/70 bg-[#1b0f0d] p-5 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-red-300">Confirmar</h3>
              <p className="text-sm text-red-100/90 leading-relaxed">
                El personaje acumulará un punto de cansancio. ¿Estás seguro?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={resolvingSleep}
                  className="flex-1 px-4 py-2 rounded border border-border text-foreground hover:bg-secondary/40 transition disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => resolveSleepDecision(pendingCharacter.pendingId, "decline")}
                  disabled={resolvingSleep}
                  className="flex-1 px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800 transition disabled:opacity-60"
                >
                  Sí, continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
