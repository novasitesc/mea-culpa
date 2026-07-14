import { useCallback, useEffect, useRef, useState } from "react";

export type RitualPhase = "idle" | "sealing" | "success" | "error";

/**
 * Mecánica compartida de los rituales de sello del panel de admin
 * (ascensión / revocación). Gestiona:
 *  - "mantener pulsado para sellar" con carga por requestAnimationFrame,
 *  - parallax del emblema (tilt),
 *  - la máquina de estados idle → sealing → success | error,
 *  - una duración mínima de animación para que el sellado se disfrute.
 *
 * El componente aporta `perform` (la petición real) y renderiza los visuales
 * a partir de `phase` / `charge` / `tilt`.
 */
export function useSealRitual({
  perform,
  chargeMs = 1100,
  minSealMs = 1200,
}: {
  perform: () => Promise<{ ok: boolean; error?: string }>;
  chargeMs?: number;
  minSealMs?: number;
}) {
  const [phase, setPhase] = useState<RitualPhase>("idle");
  const [charge, setCharge] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  const chargeRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const decayRafRef = useRef<number | null>(null);
  const phaseRef = useRef<RitualPhase>("idle");
  phaseRef.current = phase;

  const applyCharge = (c: number) => {
    chargeRef.current = c;
    setCharge(c);
  };

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (decayRafRef.current != null) cancelAnimationFrame(decayRafRef.current);
    rafRef.current = null;
    decayRafRef.current = null;
  }, []);

  const beginSealing = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    stopRaf();
    chargingRef.current = false;
    applyCharge(1);
    setPhase("sealing");
    const started = performance.now();
    try {
      const res = await perform();
      const elapsed = performance.now() - started;
      if (elapsed < minSealMs) {
        await new Promise((r) => setTimeout(r, minSealMs - elapsed));
      }
      if (!res.ok) {
        setErrorMsg(res.error ?? "El ritual fue rechazado.");
        setPhase("error");
        return;
      }
      setPhase("success");
    } catch {
      setErrorMsg("Se quebró el vínculo arcano. Inténtalo de nuevo.");
      setPhase("error");
    }
  }, [perform, minSealMs, stopRaf]);

  const runCharge = useCallback(() => {
    if (!chargingRef.current) return;
    const elapsed = performance.now() - chargeStartRef.current;
    const c = Math.min(1, elapsed / chargeMs);
    applyCharge(c);
    if (c >= 1) {
      chargingRef.current = false;
      beginSealing();
      return;
    }
    rafRef.current = requestAnimationFrame(runCharge);
  }, [beginSealing, chargeMs]);

  const decay = useCallback(() => {
    const c = chargeRef.current - 0.06;
    if (c <= 0) {
      applyCharge(0);
      decayRafRef.current = null;
      return;
    }
    applyCharge(c);
    decayRafRef.current = requestAnimationFrame(decay);
  }, []);

  const startCharge = useCallback(() => {
    if (phaseRef.current !== "idle" || chargingRef.current) return;
    stopRaf();
    chargingRef.current = true;
    // arrancar desde el punto actual para permitir "recargar" tras soltar
    chargeStartRef.current = performance.now() - chargeRef.current * chargeMs;
    rafRef.current = requestAnimationFrame(runCharge);
  }, [chargeMs, runCharge, stopRaf]);

  const cancelCharge = useCallback(() => {
    if (!chargingRef.current) return;
    chargingRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (phaseRef.current === "idle") {
      decayRafRef.current = requestAnimationFrame(decay);
    }
  }, [decay]);

  const onEmblemMove = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== "idle") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 16, ry: px * 16 });
  }, []);

  const resetTilt = useCallback(() => setTilt({ rx: 0, ry: 0 }), []);

  const reset = useCallback(() => {
    stopRaf();
    chargingRef.current = false;
    setErrorMsg("");
    applyCharge(0);
    setPhase("idle");
  }, [stopRaf]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  return {
    phase,
    charge,
    tilt,
    errorMsg,
    chargingRef,
    startCharge,
    cancelCharge,
    beginSealing,
    onEmblemMove,
    resetTilt,
    reset,
  };
}
