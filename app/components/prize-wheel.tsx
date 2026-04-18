"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const categoryClasses: Record<RouletteCategory, string> = {
  jackpot: "bg-amber-300 border-amber-100 text-black",
  muy_grande: "bg-fuchsia-700 border-fuchsia-400 text-white",
  nada: "bg-neutral-600 border-neutral-400 text-white",
  grande: "bg-cyan-700 border-cyan-400 text-white",
  mediano: "bg-emerald-700 border-emerald-400 text-white",
  pequeno: "bg-stone-700 border-stone-500 text-white",
};

const categoryLabels: Record<RouletteCategory, string> = {
  jackpot: "Jackpot",
  muy_grande: "Muy grande",
  nada: "Nada",
  grande: "Grande",
  mediano: "Mediano",
  pequeno: "Pequeno",
};

type PrizeWheelProps = {
  token: string;
};

export default function PrizeWheel({ token }: PrizeWheelProps) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleSpin = async () => {
    if (!token || isSpinning || !config?.enabled) return;

    setIsSpinning(true);
    setError(null);
    setSpinResult(null);

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

      const animatedTarget = data.slot;
      for (let i = 0; i < 8; i += 1) {
        setHighlightSlot(((animatedTarget + i * 13) % 100) + 1);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      setHighlightSlot(animatedTarget);
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
      "1 jackpot",
      "4 muy grandes",
      "5 nada",
      "10 grandes",
      "15 medianos",
      "65 pequenos",
    ],
    [],
  );

  const nextCost = config?.playerState?.nextCost ?? config?.costCycle?.[0] ?? null;

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
    <Card className="h-full border-gold-dim medieval-border">
      <CardHeader>
        <CardTitle className="text-gold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Ruleta de premios
        </CardTitle>
        <CardDescription>
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

        <div className="grid grid-cols-10 gap-1 rounded-xl border border-border bg-background/60 p-2">
          {config.slots.map((category, index) => {
            const slotNumber = index + 1;
            const isHighlighted = highlightSlot === slotNumber;
            return (
              <div
                key={slotNumber}
                title={`Slot ${slotNumber}: ${categoryLabels[category]}`}
                className={`h-8 rounded border text-[10px] font-bold flex items-center justify-center transition-all ${categoryClasses[category]} ${
                  isHighlighted ? "ring-2 ring-gold scale-110" : "opacity-90"
                }`}
              >
                {slotNumber}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground mb-2">Tabla de premios</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {distributionText.map((item) => (
                <span key={item} className="text-foreground">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Proxima tirada</p>
            {nextCost ? (
              <div className="text-sm text-foreground">
                <p>
                  Paso {nextCost.step} de 6 - {nextCost.amount} {nextCost.type === "oro" ? "oro" : "USD"}
                </p>
                {nextCost.type === "usd" && (
                  <p className="text-xs text-amber-300 mt-1">Cobro USD pendiente (temporal).</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de costo</p>
            )}

            <Button
              onClick={handleSpin}
              disabled={!token || !config.enabled || isSpinning}
              className="w-full"
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
          <div className="rounded-lg border border-gold-dim bg-gold/10 p-3 text-sm">
            <p className="text-gold font-semibold">
              Resultado: Slot {spinResult.slot} - {categoryLabels[spinResult.category]}
            </p>
            <p className="text-foreground">{spinResult.rewardLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
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
