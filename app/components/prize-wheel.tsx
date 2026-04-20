"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Trophy } from "lucide-react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { emitAuthRefresh } from "@/lib/authRefresh";
import type { RouletteCategory, RouletteCostStep } from "@/lib/roulette";

type PlayerState = {
  spinCount: number;
  nextCost: RouletteCostStep;
  hasUsdSpinPayment?: boolean;
  lastSpin: {
    id: string;
    slot: number;
    categoria: RouletteCategory;
    premio_label: string;
    costo_tipo: "oro" | "usd";
    costo_monto: number;
    ciclo_numero: number;
    cobro_pendiente: boolean;
  } | null;
};

type ConfigResponse = {
  enabled: boolean;
  costCycle: RouletteCostStep[];
  slots: RouletteCategory[];
  playerState: PlayerState | null;
};

type SpinResponse = {
  tiradaId: string;
  slot: number;
  category: RouletteCategory;
  rewardLabel: string;
  cost: RouletteCostStep;
  cobroPendiente: boolean;
  oro: number | null;
  nextCost: RouletteCostStep;
  spinCount: number;
};

type PayPalOrderResponse = {
  orderId: string;
  alreadyPaid?: boolean;
};

const categoryLabels: Record<RouletteCategory, string> = {
  jackpot: "Jackpot",
  muy_grande: "Muy grande",
  nada: "Nada",
  grande: "Grande",
  mediano: "Mediano",
  pequeno: "Pequeno",
};

const categoryColors: Record<RouletteCategory, string> = {
  jackpot: "#fde047",
  muy_grande: "#c026d3",
  nada: "#6b7280",
  grande: "#0891b2",
  mediano: "#059669",
  pequeno: "#57534e",
};

type VisualSegment = {
  index: number;
  color: string;
};

const categoryAccentColors: Record<RouletteCategory, string> = {
  jackpot: "#fff17a",
  muy_grande: "#d94be8",
  nada: "#8f97a6",
  grande: "#3bb5d1",
  mediano: "#2ec79c",
  pequeno: "#82796c",
};

type PrizeWheelProps = {
  token: string;
};

export default function PrizeWheel({ token }: PrizeWheelProps) {
  const WAIT_SPIN_DEG_PER_MS = 0.42;
  const MIN_WAIT_MS = 650;
  const MIN_SETTLE_MS = 900;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isAwaitingResult, setIsAwaitingResult] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "waiting" | "settling">("idle");
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<SpinResponse | null>(null);
  const [pendingSpinResult, setPendingSpinResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [isPayingUsdStep, setIsPayingUsdStep] = useState(false);
  const [configTokenSnapshot, setConfigTokenSnapshot] = useState<string | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const pendingSpinResultRef = useRef<SpinResponse | null>(null);
  
  // Animation phase state
  const animationPhaseRef = useRef<"idle" | "waiting" | "settling">("idle");
  const waitingStartTsRef = useRef<number | null>(null);
  const settleStartTsRef = useRef<number | null>(null);
  const settleStartRotationRef = useRef(0);
  const settleTargetRef = useRef(0);
  const settleDurationRef = useRef(980);
  const configRequestSeqRef = useRef(0);

  useEffect(() => {
    setConfigTokenSnapshot(null);
  }, [token]);

  const fetchConfig = useCallback(async () => {
    const requestId = ++configRequestSeqRef.current;
    const tokenSnapshot = token;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ruleta/config", {
        headers: tokenSnapshot ? { Authorization: `Bearer ${tokenSnapshot}` } : {},
      });
      const data = (await res.json()) as ConfigResponse;

      if (requestId !== configRequestSeqRef.current) {
        return;
      }

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Error cargando ruleta");
      }

      setConfig(data);
      setConfigTokenSnapshot(tokenSnapshot);
      if (data.playerState?.lastSpin?.slot) {
        setHighlightSlot(data.playerState.lastSpin.slot);
      }
    } catch (err: unknown) {
      if (requestId !== configRequestSeqRef.current) {
        return;
      }
      const message = err instanceof Error ? err.message : "Error cargando ruleta";
      setError(message);
    } finally {
      if (requestId === configRequestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    const audio = new Audio("/sounds/spin.mp3");
    audio.preload = "auto";
    audio.volume = 0.5;
    spinAudioRef.current = audio;

    return () => {
      audio.pause();
      spinAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    pendingSpinResultRef.current = pendingSpinResult;
  }, [pendingSpinResult]);

  // Initialize persistent RAF loop on mount - runs continuously forever
  useEffect(() => {
    let frameCountRef = 0;

    const tick = (ts: number) => {
      // Initialize timestamp tracking
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = ts;
      }
      const dt = ts - (lastFrameTsRef.current ?? ts);
      lastFrameTsRef.current = ts;

      if (animationPhaseRef.current === "idle") {
        // Idle phase: do nothing, wheel stays still
        // Do NOT update rotation
      } else if (animationPhaseRef.current === "waiting") {
        // Waiting phase: constant velocity rotation
        if (waitingStartTsRef.current === null) {
          waitingStartTsRef.current = ts;
        }
        rotationRef.current += dt * WAIT_SPIN_DEG_PER_MS;
      } else if (animationPhaseRef.current === "settling") {
        // Settling phase: kinematic motion with constant deceleration.
        // Starts at WAIT speed and decreases smoothly to zero at the target.
        if (settleStartTsRef.current === null) {
          settleStartTsRef.current = ts;
          settleStartRotationRef.current = rotationRef.current;
        }

        const elapsed = ts - settleStartTsRef.current;
        const u = Math.min(1, elapsed / settleDurationRef.current);
        const eased = 2 * u - u * u;

        const delta = settleTargetRef.current - settleStartRotationRef.current;
        const newRotation = settleStartRotationRef.current + delta * eased;

        rotationRef.current = newRotation;

        // End settling phase when complete - return to idle
        if (u >= 1) {
          animationPhaseRef.current = "idle";
          setAnimationPhase("idle");
          waitingStartTsRef.current = null;
          lastFrameTsRef.current = null;
          settleStartTsRef.current = null;

          if (pendingSpinResultRef.current) {
            setSpinResult(pendingSpinResultRef.current);
            setPendingSpinResult(null);
            pendingSpinResultRef.current = null;
          }
        }
      }

      // Update React state less frequently to avoid excessive re-renders
      frameCountRef += 1;
      if (frameCountRef % 2 === 0) {
        setWheelRotation(rotationRef.current);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const transitionToSettling = (targetAbsoluteRotation: number) => {
    // Smoothly transition to settling phase without stopping the loop
    animationPhaseRef.current = "settling";
    setAnimationPhase("settling");
    settleStartTsRef.current = null;
    settleStartRotationRef.current = rotationRef.current;
    settleTargetRef.current = targetAbsoluteRotation;

    // Kinematics: T = 2D / V0 so we start at current waiting speed and end at zero.
    const distance = Math.max(0, targetAbsoluteRotation - settleStartRotationRef.current);
    settleDurationRef.current = Math.max(1, (2 * distance) / WAIT_SPIN_DEG_PER_MS);
  };

  const createUsdSpinOrder = async (): Promise<string> => {
    const res = await fetch("/api/profile/ruleta-paypal/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const data = (await res.json()) as PayPalOrderResponse & { error?: string };
    if (!res.ok || !data.orderId) {
      throw new Error(data.error ?? "No se pudo crear la orden PayPal");
    }

    if (data.alreadyPaid) {
      setPaymentMessage("Pago USD ya registrado para la siguiente tirada. Ya puedes tirar.");
      await fetchConfig();
    }

    return data.orderId;
  };

  const captureUsdSpinOrder = async (orderId: string) => {
    const res = await fetch("/api/profile/ruleta-paypal/capture-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      awaitingWebhook?: boolean;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error ?? "No se pudo capturar el pago");
    }

    setPaymentMessage("Pago confirmado. Ya puedes tirar la ruleta.");

    await fetchConfig();
  };

  const handleSpin = async () => {
    if (
      !token ||
      configTokenSnapshot !== token ||
      !config ||
      isSpinning ||
      animationPhase !== "idle" ||
      !config.enabled
    ) {
      return;
    }

    setIsSpinning(true);
    setError(null);
    setPaymentMessage(null);
    setSpinResult(null);
    setPendingSpinResult(null);

    setIsAwaitingResult(true);
    // Transition to waiting phase (loop already running persistently)
    animationPhaseRef.current = "waiting";
    setAnimationPhase("waiting");
    waitingStartTsRef.current = null;
    lastFrameTsRef.current = null;

    if (spinAudioRef.current) {
      spinAudioRef.current.currentTime = 0;
      void spinAudioRef.current.play().catch(() => {
        // Ignorar bloqueo de autoplay del navegador.
      });
    }

    try {
      const res = await fetch("/api/profile/ruleta-spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as SpinResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo completar la tirada");
      }

      const slotAngle = 360 / 100;
      const slotCenter = (data.slot - 1) * slotAngle + slotAngle / 2;
      
      const current = rotationRef.current;
      const normalized = ((current % 360) + 360) % 360;
      const target = 360 - slotCenter;
      let deltaToTarget = ((target - normalized) + 360) % 360;
      if (deltaToTarget < 24) {
        deltaToTarget += 360;
      }
      const elapsedWaiting =
        waitingStartTsRef.current === null
          ? MIN_WAIT_MS
          : performance.now() - waitingStartTsRef.current;

      // Ensure spin does not cut too quickly if API responds instantly.
      if (elapsedWaiting < MIN_WAIT_MS) {
        const remaining = MIN_WAIT_MS - elapsedWaiting;
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // Guarantee enough braking distance for a smooth stop.
      const minSettleDistance = (WAIT_SPIN_DEG_PER_MS * MIN_SETTLE_MS) / 2;
      while (deltaToTarget < minSettleDistance) {
        deltaToTarget += 360;
      }

      const settleTarget = current + deltaToTarget;
      
      // Transition to settling without stopping the animation loop
      transitionToSettling(settleTarget);
      setIsAwaitingResult(false);

      setHighlightSlot(data.slot);
      setPendingSpinResult(data);

      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          playerState: {
            spinCount: data.spinCount,
            nextCost: data.nextCost,
            lastSpin: {
              id: data.tiradaId,
              slot: data.slot,
              categoria: data.category,
              premio_label: data.rewardLabel,
              costo_tipo: data.cost.type,
              costo_monto: data.cost.amount,
              ciclo_numero: data.cost.step,
              cobro_pendiente: data.cobroPendiente,
            },
          },
        };
      });

      emitAuthRefresh(data.oro ?? undefined);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo tirar";
      setError(message);
      setIsAwaitingResult(false);
      // Reset to idle on error
      animationPhaseRef.current = "idle";
      setAnimationPhase("idle");
      setPendingSpinResult(null);
    } finally {
      setIsSpinning(false);
    }
  };

  const distributionText = useMemo(
    () => [
      "1 jackpot: 10 dolares de credito en el servidor",
      "4 muy grandes",
      "5 nada",
      "10 grandes",
      "15 medianos",
      "65 pequenos",
    ],
    [],
  );

  const nextCost = config?.playerState?.nextCost ?? config?.costCycle?.[0] ?? null;
  const shouldPrepayUsd = nextCost?.type === "usd";
  const hasUsdSpinPayment = Boolean(config?.playerState?.hasUsdSpinPayment);
  const isSpinStateReady = configTokenSnapshot === token && Boolean(config);

  const visualSegments = useMemo<VisualSegment[]>(() => {
    if (!config?.slots?.length) return [];

    return config.slots.map((category, index) => {
      const base = categoryColors[category];
      const accent = categoryAccentColors[category];

      return {
        index,
        color: index % 2 === 0 ? base : accent,
      };
    });
  }, [config?.slots]);

  const wheelBackground = useMemo(() => {
    if (!visualSegments.length) return "";
    const slotAngle = 360 / visualSegments.length;
    const pieces = visualSegments.map((segment, index) => {
      const start = (index * slotAngle).toFixed(3);
      const end = ((index + 1) * slotAngle).toFixed(3);
      return `${segment.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${pieces.join(",")})`;
  }, [visualSegments]);

  if (isLoading) {
    return (
      <Card className="h-full border-gold-dim medieval-border">
        <CardContent className="h-full min-h-125 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card className="h-full border-destructive">
        <CardContent className="h-full min-h-125 flex items-center justify-center">
          <p className="text-sm text-destructive">No se pudo cargar la ruleta.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative h-full overflow-hidden border-gold-dim medieval-border bg-card/95">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0) 44%), radial-gradient(circle at 86% 90%, rgba(139,19,19,0.2) 0%, rgba(139,19,19,0) 42%), linear-gradient(150deg, rgba(42,34,25,0.78), rgba(21,18,14,0.96))",
        }}
      />

      <CardHeader className="relative z-10 border-b border-gold-dim/35 bg-black/18 backdrop-blur-[1px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-gold flex items-center gap-2 font-serif tracking-wide">
              <Trophy className="w-5 h-5" />
              Ruleta de Premios
            </CardTitle>
            <CardDescription className="mt-1 text-zinc-300/90">
              100 casillas de botin con reparto fijo por categoria.
            </CardDescription>
          </div>
          <span className="rounded-full border border-gold/50 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-gold">
            Evento de Fortuna
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4 p-4 md:p-5">
        {!config.enabled && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            La ruleta esta deshabilitada por administracion. La tab permanece visible, pero no puedes tirar.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {paymentMessage && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {paymentMessage}
          </div>
        )}

        <div className="mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="relative mx-auto w-full max-w-md">
            <div className="pointer-events-none absolute -inset-3 rounded-full border border-gold/20" />
            <div className="pointer-events-none absolute inset-2 rounded-full border border-gold/20" />

            <div className="relative aspect-square">
              <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2">
                <div className="w-0 h-0 border-x-7 border-x-transparent border-t-12 border-t-gold drop-shadow-[0_3px_2px_rgba(0,0,0,0.65)]" />
              </div>

              <div className="absolute inset-0 rounded-full bg-black/30 p-3 shadow-[0_22px_50px_rgba(0,0,0,0.55)]">
                <div className="relative h-full w-full rounded-full border-[5px] border-[#d7b45d] bg-black/20 shadow-[inset_0_0_0_3px_rgba(71,54,30,0.9),inset_0_0_42px_rgba(0,0,0,0.35)]">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      transform: `rotate(${wheelRotation}deg)`,
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundImage: wheelBackground }}
                    />

                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        backgroundImage:
                          "repeating-conic-gradient(rgba(0,0,0,0.34) 0deg 0.22deg, transparent 0.22deg 3.6deg)",
                      }}
                    />

                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        backgroundImage:
                          "repeating-conic-gradient(rgba(255,255,255,0.24) 0deg 0.05deg, transparent 0.05deg 3.6deg)",
                        mixBlendMode: "screen",
                      }}
                    />
                  </div>

                  <div className="pointer-events-none absolute inset-[17%] rounded-full border border-gold/35" />
                  <div className="absolute left-1/2 top-1/2 z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f4e7b7] bg-linear-to-br from-[#8b7355] to-[#33281b] shadow-[0_6px_16px_rgba(0,0,0,0.55)]" />
                  <div className="absolute left-1/2 top-1/2 z-30 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-gold/50 bg-black/45 px-3 py-1 text-xs font-medium text-amber-100 backdrop-blur-sm">
                {isAwaitingResult || animationPhase !== "idle"
                  ? "La rueda decide tu destino..."
                  : "Pulsa para desafiar la fortuna"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-gold/30 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-300">Tabla de premios</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5 text-sm text-zinc-100 sm:grid-cols-2 lg:grid-cols-1">
                {distributionText.map((item) => (
                  <span key={item} className="rounded border border-white/8 bg-black/20 px-2 py-1">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gold/30 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-300">Categorias</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(Object.keys(categoryLabels) as RouletteCategory[]).map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-2 py-1 text-zinc-100"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/30"
                      style={{ backgroundColor: categoryColors[category] }}
                    />
                    {categoryLabels[category]}
                  </span>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-2 text-xs text-zinc-300">
                <span className="text-zinc-200">Ultimo slot:</span>{" "}
                {highlightSlot ? `#${highlightSlot}` : "sin tiradas aun"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gold/30 bg-black/30 p-3 md:p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-300">Proxima tirada</p>
          <div className="rounded-lg border border-white/15 bg-black/25 p-3">
            {nextCost ? (
              <div className="text-sm text-zinc-100">
                <p>
                  Paso {nextCost.step} de 6 - {nextCost.amount} {nextCost.type === "oro" ? "oro" : "USD"}
                </p>
                {nextCost.type === "usd" && !hasUsdSpinPayment && (
                  <p className="text-xs text-amber-300 mt-1">Debes pagar este paso antes de tirar.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">Sin datos de costo</p>
            )}
          </div>

          <Button
            onClick={handleSpin}
            disabled={
              !token ||
              !isSpinStateReady ||
              !config.enabled ||
              isSpinning ||
              animationPhase !== "idle" ||
              (shouldPrepayUsd && !hasUsdSpinPayment)
            }
            className="h-11 w-full border border-gold/45 bg-linear-to-r from-[#6d532d] via-[#a07a3d] to-[#7d5f32] text-amber-50 shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:from-[#7b5e32] hover:via-[#b58841] hover:to-[#8b6a36]"
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Girando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Tirar ruleta
              </>
            )}
          </Button>

          {shouldPrepayUsd && !hasUsdSpinPayment && (
            <div className="space-y-2 rounded-lg border border-amber-300/40 bg-amber-950/30 p-3">
              <p className="text-xs text-amber-200">
                Paga ${Number(nextCost?.amount ?? 0).toFixed(2)} USD para habilitar la tirada.
              </p>
              {!paypalClientId ? (
                <p className="text-xs text-amber-300">
                  Falta configurar NEXT_PUBLIC_PAYPAL_CLIENT_ID para habilitar el cobro.
                </p>
              ) : (
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId,
                    "client-id": paypalClientId,
                    currency: "USD",
                    intent: "capture",
                    "disable-funding": "card,credit",
                  }}
                >
                  <PayPalButtons
                    style={{ layout: "vertical", label: "paypal" }}
                    disabled={isPayingUsdStep}
                    createOrder={async () => {
                      setError(null);
                      setPaymentMessage(null);
                      setIsPayingUsdStep(true);
                      try {
                        return await createUsdSpinOrder();
                      } catch (err: unknown) {
                        const message =
                          err instanceof Error
                            ? err.message
                            : "No se pudo crear el cobro PayPal";
                        setError(message);
                        setIsPayingUsdStep(false);
                        throw err;
                      }
                    }}
                    onApprove={async (data) => {
                      if (!data.orderID) {
                        setError("PayPal no devolvio orderID");
                        setIsPayingUsdStep(false);
                        return;
                      }

                      try {
                        await captureUsdSpinOrder(data.orderID);
                      } catch (err: unknown) {
                        const message =
                          err instanceof Error
                            ? err.message
                            : "No se pudo confirmar el pago";
                        setError(message);
                      } finally {
                        setIsPayingUsdStep(false);
                      }
                    }}
                    onError={(err) => {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Error en PayPal al procesar el pago",
                      );
                      setIsPayingUsdStep(false);
                    }}
                    onCancel={() => {
                      setPaymentMessage("Pago cancelado por el usuario.");
                      setIsPayingUsdStep(false);
                    }}
                  />
                </PayPalScriptProvider>
              )}
            </div>
          )}
        </div>

        {spinResult && animationPhase === "idle" && (
          <div className="rounded-lg border border-gold/40 bg-black/30 p-3 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            <p className="text-gold font-semibold">
              Resultado: {categoryLabels[spinResult.category]}
            </p>
            <p className="text-zinc-100">{spinResult.rewardLabel}</p>
            <p className="text-xs text-zinc-300 mt-1">
              Costo aplicado: {spinResult.cost.amount} {spinResult.cost.type === "oro" ? "oro" : "USD"} (paso {spinResult.cost.step}/6)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
