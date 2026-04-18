"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RouletteCategory, RouletteCostStep } from "@/lib/roulette";

type PlayerState = {
  spinCount: number;
  nextCost: RouletteCostStep;
  lastSpin: {
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
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ruleta/config", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as ConfigResponse;

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Error cargando ruleta");
      }

      setConfig(data);
      if (data.playerState?.lastSpin?.slot) {
        setHighlightSlot(data.playerState.lastSpin.slot);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando ruleta";
      setError(message);
    } finally {
      setIsLoading(false);
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

  const handleSpin = async () => {
    if (!token || isSpinning || !config?.enabled) return;

    setIsSpinning(true);
    setError(null);
    setSpinResult(null);

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
      const target = 360 - slotCenter;
      const extraTurns = 7 * 360;

      setWheelRotation((prev) => prev + extraTurns + target);
      setHighlightSlot(data.slot);
      setSpinResult(data);

      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          playerState: {
            spinCount: data.spinCount,
            nextCost: data.nextCost,
            lastSpin: {
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

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:refresh", {
            detail: { oro: data.oro ?? undefined },
          }),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo tirar";
      setError(message);
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
    <Card className="h-full border-gold-dim medieval-border bg-linear-to-br from-[#4c3b6f] via-[#3f315e] to-[#35294f]">
      <CardHeader>
        <CardTitle className="text-gold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Ruleta de premios
        </CardTitle>
        <CardDescription className="text-zinc-200/90">
          100 slots de premios. Esta ruleta entrega categorias, no apuestas de casino.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
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

        <div className="relative mx-auto w-full max-w-100">
          <div className="relative aspect-square">
            <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2">
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-8 border-t-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.6)]" />
            </div>

            <div className="absolute inset-0 rounded-full bg-black/20 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
              <div className="relative h-full w-full rounded-full border-4 border-white/70 bg-black/15">
                <div
                  className="absolute inset-0 rounded-full transition-transform duration-4300 ease-[cubic-bezier(0.18,0.9,0.22,1)]"
                  style={{ transform: `rotate(${wheelRotation}deg)` }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundImage: wheelBackground }}
                  />

                  <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                    backgroundImage:
                      "repeating-conic-gradient(rgba(0,0,0,0.34) 0deg 0.22deg, transparent 0.22deg 3.6deg)",
                  }} />

                  <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                    backgroundImage:
                      "repeating-conic-gradient(rgba(255,255,255,0.26) 0deg 0.05deg, transparent 0.05deg 3.6deg)",
                    mixBlendMode: "screen",
                  }} />
                </div>

                <div className="absolute left-1/2 top-1/2 z-20 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-800 border-2 border-zinc-100 shadow-[0_4px_14px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-xs text-center text-white">
            {highlightSlot ? (
              <p>
                Cayo en: <span className="text-gold font-semibold">{categoryLabels[config.slots[highlightSlot - 1]]}</span>
              </p>
            ) : (
              <p className="text-zinc-300">Aun sin tiradas en esta sesion.</p>
            )}
            <p className="text-[11px] text-zinc-400 mt-1">Ruleta visual segmentada en 100 slots</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/20 bg-black/25 p-3">
            <p className="text-xs text-zinc-200 mb-2">Tabla de premios</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {distributionText.map((item) => (
                <span key={item} className="text-zinc-100">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {(Object.keys(categoryLabels) as RouletteCategory[]).map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/25 px-2 py-1 text-zinc-100"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: categoryColors[category] }}
                  />
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/20 bg-black/25 p-3 space-y-2">
            <p className="text-xs text-zinc-200">Proxima tirada</p>
            {nextCost ? (
              <div className="text-sm text-zinc-100">
                <p>
                  Paso {nextCost.step} de 6 - {nextCost.amount} {nextCost.type === "oro" ? "oro" : "USD"}
                </p>
                {nextCost.type === "usd" && (
                  <p className="text-xs text-amber-300 mt-1">Cobro USD pendiente (temporal).</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">Sin datos de costo</p>
            )}

            <Button
              onClick={handleSpin}
              disabled={!token || !config.enabled || isSpinning}
              className="w-full bg-white text-black hover:bg-zinc-200"
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
          </div>
        </div>

        {spinResult && (
          <div className="rounded-lg border border-gold/40 bg-black/30 p-3 text-sm">
            <p className="text-gold font-semibold">
              Resultado: {categoryLabels[spinResult.category]}
            </p>
            <p className="text-zinc-100">{spinResult.rewardLabel}</p>
            <p className="text-xs text-zinc-300 mt-1">
              Costo aplicado: {spinResult.cost.amount} {spinResult.cost.type === "oro" ? "oro" : "USD"} (paso {spinResult.cost.step}/6)
            </p>
            {spinResult.cobroPendiente && (
              <p className="text-xs text-amber-300 mt-1">Pago en USD marcado como pendiente de cobro.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
