"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, Package, List, Loader2, ChevronDown, ChevronUp, Dices } from "lucide-react";
import DiceVisual from "./dice-visual";
import FantasyAlert from "@/components/ui/fantasy-alert";
import type { DadoRecompensa, RollResult, LutCaraResult } from "@/lib/types/dados";

type Props = {
  token: string | null;
};

type AlertState = {
  variant: "success" | "error" | "info";
  message: string;
} | null;

const TIPO_LABEL: Record<string, string> = {
  item_fijo: "Ítem garantizado",
  sublista: "Tabla de ítems",
  oro_dados: "Oro por dados",
  lut: "Tabla D20",
};

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  item_fijo: Package,
  sublista: List,
  oro_dados: Coins,
  lut: Dices,
};

function rewardDescription(r: DadoRecompensa): string {
  if (r.tipo === "item_fijo") return r.objetoNombre ?? "Ítem fijo";
  if (r.tipo === "sublista") return `${r.sublistaItems.length} ítems posibles`;
  if (r.tipo === "oro_dados") return `${r.cantidadDados}${r.tipoDado.toUpperCase()} × ${r.multiplicadorOro} oro`;
  if (r.tipo === "lut") {
    const activas = (r.lutCaras ?? []).filter((c) => c.tipo !== "nada").length;
    return `Tabla D20 — ${activas} caras con recompensa`;
  }
  return "";
}

export default function DiceModule({ token }: Props) {
  const [recompensas, setRecompensas] = useState<DadoRecompensa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rollingState, setRollingState] = useState<"idle" | "rolling" | "done">("idle");
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [lutResultados, setLutResultados] = useState<LutCaraResult[] | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [expanded, setExpanded] = useState(true);
  const [cantidad, setCantidad] = useState(1);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/dados/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // subtabla no se muestra al usuario
      const visibles = (data.recompensas ?? []).filter((r: DadoRecompensa) => r.tipo !== "subtabla");
      setRecompensas(visibles);
      if (visibles.length > 0) {
        setSelectedId(visibles[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const selectedReward = recompensas.find((r) => r.id === selectedId) ?? null;

  function selectReward(id: number) {
    setSelectedId(id);
    setRollingState("idle");
    setRollResult(null);
    setLutResultados(null);
    setCantidad(1);
  }

  async function handleRoll() {
    if (!selectedReward || rollingState === "rolling") return;

    setRollingState("rolling");
    setRollResult(null);
    setLutResultados(null);

    try {
      const res = await fetch("/api/dados/roll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recompensa_id: selectedReward.id,
          cantidad: selectedReward.tipo === "lut" ? cantidad : 1,
        }),
      });

      const data = await res.json();

      // Esperar que la animación termine antes de mostrar resultado
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!res.ok) {
        setRollingState("idle");
        setAlert({ variant: "error", message: data.error ?? "Error al tirar los dados" });
        return;
      }

      setRollResult(data);
      if (data.lutResultados) setLutResultados(data.lutResultados);
      setRollingState("done");

      if (selectedReward.tipo === "lut" && data.lutResultados) {
        const oros = (data.lutResultados as LutCaraResult[])
          .filter((r) => r.tipo === "oro")
          .reduce((acc: number, r: LutCaraResult) => acc + (r.oroDetalle?.cantidadOro ?? 0), 0);
        const items = (data.lutResultados as LutCaraResult[]).filter(
          (r) => r.tipo === "item" || (r.tipo === "subtabla" && r.subRoll?.objeto)
        );
        if (oros > 0 && items.length > 0) {
          setAlert({ variant: "success", message: `¡+${oros} oro y ${items.length} ítem(s)!` });
        } else if (oros > 0) {
          setAlert({ variant: "success", message: `¡+${oros} oro!` });
        } else if (items.length > 0) {
          setAlert({ variant: "success", message: `¡${items.length} ítem(s) obtenido(s)!` });
        }
      } else if (data.tipoResultado === "oro") {
        setAlert({ variant: "success", message: `¡Obtuviste ${data.cantidadOro} de oro!` });
      } else if (data.objeto) {
        setAlert({ variant: "success", message: `¡Obtuviste ${data.objeto.nombre}!` });
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setRollingState("idle");
      setAlert({ variant: "error", message: "Error de conexión" });
    }
  }

  function handleRollAgain() {
    setRollingState("idle");
    setRollResult(null);
    setLutResultados(null);
  }

  if (!loading && recompensas.length === 0) return null;

  return (
    <div className="bg-card border border-gold-dim/60 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-linear-to-r from-gold-dim/20 to-transparent hover:from-gold-dim/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gold text-sm font-serif tracking-wider">🎲 Dados</span>
          {selectedReward && (
            <span className="text-[10px] text-foreground/50 font-sans uppercase tracking-widest">
              — {selectedReward.tipoDado.toUpperCase()}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gold/60" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gold/60" />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
            </div>
          ) : (
            <>
              {/* Selector de recompensas */}
              {recompensas.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {recompensas.map((r) => {
                    const Icon = TIPO_ICON[r.tipo] ?? Package;
                    return (
                      <button
                        key={r.id}
                        onClick={() => selectReward(r.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-sans transition-all ${
                          selectedId === r.id
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-gold-dim/40 text-foreground/60 hover:border-gold-dim/70 hover:text-foreground/80"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {r.nombre}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Área principal de tirada */}
              {selectedReward && (
                <div className="flex items-start gap-4">
                  {/* Dados visuales */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {Array.from({
                      length: selectedReward.tipo === "oro_dados" ? selectedReward.cantidadDados : 1,
                    }).map((_, i) => (
                      <div key={i} className="mt-5">
                        <DiceVisual
                          type={selectedReward.tipoDado}
                          rolling={rollingState === "rolling"}
                          value={
                            rollingState === "done" && rollResult?.resultados
                              ? rollResult.resultados[i]
                              : undefined
                          }
                          size={52}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Info y botón */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs text-foreground/60 font-sans leading-snug">
                      {rewardDescription(selectedReward)}
                    </p>
                    {selectedReward.descripcion && (
                      <p className="text-[11px] text-foreground/40 font-sans italic leading-snug">
                        {selectedReward.descripcion}
                      </p>
                    )}
                    {selectedReward.costoOro > 0 && (
                      <p className="text-[11px] text-gold/70 font-sans">
                        Costo: {selectedReward.costoOro.toLocaleString("es-ES")} oro
                        {selectedReward.tipo === "lut" && cantidad > 1 && (
                          <span className="text-foreground/40 ml-1">
                            × {cantidad} = {(selectedReward.costoOro * cantidad).toLocaleString("es-ES")} oro
                          </span>
                        )}
                      </p>
                    )}

                    {/* Selector de cantidad para LUT */}
                    {selectedReward.tipo === "lut" && rollingState === "idle" && (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-foreground/50 font-sans">Tiradas:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={cantidad}
                          onChange={(e) =>
                            setCantidad(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                          }
                          className="w-14 px-2 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                        />
                      </div>
                    )}

                    {/* Resultado para tipos legacy */}
                    {rollingState === "done" && rollResult && selectedReward.tipo !== "lut" && (
                      <div className="text-xs font-sans">
                        {rollResult.tipoResultado === "oro" ? (
                          <span className="text-gold font-bold">
                            +{rollResult.cantidadOro?.toLocaleString("es-ES")} oro
                            {rollResult.resultados.length > 1 && (
                              <span className="text-foreground/40 ml-1">
                                ({rollResult.resultados.join(" + ")})
                              </span>
                            )}
                          </span>
                        ) : rollResult.objeto ? (
                          <span className="text-green-400 font-bold flex items-center gap-1">
                            {rollResult.objeto.icono && <span>{rollResult.objeto.icono}</span>}
                            {rollResult.objeto.nombre}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Botón */}
                    {rollingState === "done" ? (
                      <button
                        onClick={handleRollAgain}
                        className="px-3 py-1 rounded border border-gold-dim/60 text-xs text-gold/80 hover:border-gold hover:text-gold transition-colors font-sans"
                      >
                        Tirar de nuevo
                      </button>
                    ) : (
                      <button
                        onClick={handleRoll}
                        disabled={rollingState === "rolling"}
                        className="px-3 py-1.5 rounded bg-gold/10 border border-gold/40 text-xs text-gold font-sans font-semibold tracking-wide hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {rollingState === "rolling" ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Tirando…
                          </span>
                        ) : selectedReward.tipo === "lut" && cantidad > 1 ? (
                          `🎲 Tirar ×${cantidad}`
                        ) : (
                          "🎲 Tirar"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Resultados LUT — multi-tirada */}
              {selectedReward?.tipo === "lut" && lutResultados && lutResultados.length > 0 && (
                <div className="border-t border-gold-dim/20 pt-2 space-y-1.5">
                  <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-sans">
                    Resultados {lutResultados.length > 1 ? `(${lutResultados.length} tiradas)` : ""}
                  </p>
                  {lutResultados.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-sans">
                      {/* Cara primaria */}
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gold/10 border border-gold/40 text-gold text-[10px] font-bold">
                        {r.cara}
                      </span>

                      {r.tipo === "nada" && (
                        <span className="text-foreground/40 italic leading-6">Nada</span>
                      )}

                      {r.tipo === "item" && r.objeto && (
                        <span className="text-green-400 font-semibold leading-6">
                          {r.objeto.icono} {r.objeto.nombre}
                        </span>
                      )}

                      {r.tipo === "item" && !r.objeto && (
                        <span className="text-foreground/40 italic leading-6">Ítem no encontrado</span>
                      )}

                      {r.tipo === "oro" && r.oroDetalle && (
                        <span className="leading-6">
                          <span className="text-gold font-semibold">
                            +{r.oroDetalle.cantidadOro.toLocaleString("es-ES")} oro
                          </span>
                          <span className="text-foreground/40 font-normal ml-1.5 text-[10px]">
                            ({r.oroDetalle.formula}: [{r.oroDetalle.dados.join(", ")}]{" "}
                            {r.oroDetalle.multiplicador > 1 && `× ${r.oroDetalle.multiplicador}`})
                          </span>
                        </span>
                      )}

                      {r.tipo === "subtabla" && r.subRoll && (
                        <span className="leading-5">
                          <span className="text-foreground/40 text-[10px] block">
                            {r.subRoll.subtablaNombre} → cara {r.subRoll.cara}
                          </span>
                          {r.subRoll.objeto ? (
                            <span className="text-green-400 font-semibold">
                              {r.subRoll.objeto.icono} {r.subRoll.objeto.nombre}
                            </span>
                          ) : r.subRoll.cantidadOro !== undefined ? (
                            <span className="text-gold font-semibold">
                              +{r.subRoll.cantidadOro} oro
                            </span>
                          ) : (
                            <span className="text-foreground/40 italic">Nada</span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sublista preview cuando está seleccionada */}
              {selectedReward?.tipo === "sublista" && selectedReward.sublistaItems.length > 0 && (
                <div className="border-t border-gold-dim/20 pt-2 space-y-1">
                  <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-sans">Tabla de resultados</p>
                  <div className="grid grid-cols-2 gap-1">
                    {selectedReward.sublistaItems.map((si) => (
                      <div
                        key={si.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-sans transition-colors ${
                          rollingState === "done" && rollResult?.resultados[0] !== undefined
                            ? rollResult.resultados[0] >= si.valorMin && rollResult.resultados[0] <= si.valorMax
                              ? "bg-gold/15 border border-gold/40 text-gold"
                              : "text-foreground/40"
                            : "text-foreground/60"
                        }`}
                      >
                        <span className="text-gold/60 shrink-0">
                          {si.valorMin === si.valorMax ? si.valorMin : `${si.valorMin}–${si.valorMax}`}
                        </span>
                        <span className="truncate">{si.objetoIcono} {si.objetoNombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <FantasyAlert
        open={alert !== null}
        variant={alert?.variant ?? "info"}
        message={alert?.message ?? ""}
        onClose={() => setAlert(null)}
      />
    </div>
  );
}
