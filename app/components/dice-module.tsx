"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Coins, Package, List, Loader2, ChevronDown, ChevronUp, Dices, UserRound } from "lucide-react";
import DiceVisual from "./dice-visual";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { getIconForString } from "@/lib/iconMapper";
import { primeDiceSound } from "./dice-3d/dice-sound";
import type { DiceOverlayData } from "./dice-3d/dice-overlay";
import type { DadoRecompensa, RollResult, LutCaraResult } from "@/lib/types/dados";

// Solo carga three/fiber cuando hay una tirada que animar.
const DiceOverlay = dynamic(() => import("./dice-3d/dice-overlay"), { ssr: false });

type Props = {
  token: string | null;
  rollApiUrl?: string;
  extraBody?: Record<string, unknown>;
  hideCost?: boolean;
  /** Nombre del receptor de ítems en contexto partida (para el panel de entrega). */
  personajeNombre?: string;
  onRollComplete?: (result: RollResult & { recompensaNombre: string; tipoDado: string }) => void;
};

type AlertState = {
  variant: "success" | "error" | "info";
  message: string;
} | null;

type Personaje = { id: number; nombre: string };

type PendingRoll = {
  rollId: string;
  tipoDado: string;
  recompensaNombre: string;
  personajeNombre?: string;
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

function newRollId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function DiceModule({ token, rollApiUrl, extraBody, hideCost, personajeNombre, onRollComplete }: Props) {
  const [recompensas, setRecompensas] = useState<DadoRecompensa[]>([]);
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [personajeId, setPersonajeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rollingState, setRollingState] = useState<"idle" | "rolling" | "done">("idle");
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [lutResultados, setLutResultados] = useState<LutCaraResult[] | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [expanded, setExpanded] = useState(true);
  const [cantidad, setCantidad] = useState(1);
  const [overlay, setOverlay] = useState<DiceOverlayData | null>(null);

  const esPersonal = !rollApiUrl;
  const rollUrl = rollApiUrl ?? "/api/dados/roll";
  const pendingKey = `dados-pending:${rollUrl}`;
  const finishRef = useRef<(RollResult & { recompensaNombre: string; tipoDado: string; replay: boolean }) | null>(null);

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
      if (visibles.length > 0) setSelectedId(visibles[0].id);
      const pjs: Personaje[] = data.personajes ?? [];
      setPersonajes(pjs);
      if (pjs.length > 0) {
        const saved = Number(localStorage.getItem("dados-personaje"));
        setPersonajeId(pjs.some((p) => p.id === saved) ? saved : pjs[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Recuperación tras refresh: si quedó una tirada pendiente de mostrar,
  // se pide al servidor el resultado ya comprometido y se reproduce.
  useEffect(() => {
    if (!token) return;
    const raw = localStorage.getItem(pendingKey);
    if (!raw) return;
    let pending: PendingRoll;
    try {
      pending = JSON.parse(raw);
    } catch {
      localStorage.removeItem(pendingKey);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${rollUrl}?rollId=${pending.rollId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404 || res.status === 400) {
          // la tirada nunca llegó a comprometerse: no hay nada que reproducir
          localStorage.removeItem(pendingKey);
          return;
        }
        if (!res.ok) return; // se reintenta en el próximo montaje
        const data: RollResult = await res.json();
        setRollResult(data);
        setLutResultados(data.lutResultados ?? null);
        setRollingState("rolling");
        finishRef.current = { ...data, recompensaNombre: pending.recompensaNombre, tipoDado: pending.tipoDado, replay: true };
        setOverlay({
          tipoDado: pending.tipoDado as DadoRecompensa["tipoDado"],
          result: data,
          recompensaNombre: pending.recompensaNombre,
          personajeNombre: pending.personajeNombre,
          replay: true,
        });
      } catch {
        // sin red: el pendiente queda para el próximo intento
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pendingKey, rollUrl]);

  const selectedReward = recompensas.find((r) => r.id === selectedId) ?? null;

  // Precalienta el chunk 3D, la fuente y las texturas del dado seleccionado:
  // al pulsar Tirar solo queda esperar al servidor.
  const tipoSel = selectedReward?.tipoDado;
  useEffect(() => {
    if (!tipoSel) return;
    void import("./dice-3d/dice-overlay");
    void import("./dice-3d/dice-materials").then((m) => m.preloadDiceAssets(tipoSel));
  }, [tipoSel]);

  function selectReward(id: number) {
    setSelectedId(id);
    setRollingState("idle");
    setRollResult(null);
    setLutResultados(null);
    setCantidad(1);
  }

  function openOverlay(data: RollResult, meta: PendingRoll, replay: boolean) {
    setRollResult(data);
    setLutResultados(data.lutResultados ?? null);
    finishRef.current = { ...data, recompensaNombre: meta.recompensaNombre, tipoDado: meta.tipoDado, replay };
    setOverlay({
      tipoDado: meta.tipoDado as DadoRecompensa["tipoDado"],
      result: data,
      recompensaNombre: meta.recompensaNombre,
      personajeNombre: meta.personajeNombre,
      replay,
    });
  }

  // Al asentarse los dados (la animación manda, sin timeouts): anunciar premio.
  const handleOverlayFinished = useCallback(() => {
    const f = finishRef.current;
    localStorage.removeItem(pendingKey);
    setRollingState("done");
    if (f && !f.replay) {
      const { replay: _omit, ...result } = f;
      onRollComplete?.(result);
    }
  }, [pendingKey, onRollComplete]);

  async function handleRoll() {
    if (!selectedReward || rollingState === "rolling") return;
    primeDiceSound(); // dentro del gesto del usuario, para poder sonar al caer

    const personaje = esPersonal ? (personajes.find((p) => p.id === personajeId) ?? null) : null;
    const meta: PendingRoll = {
      rollId: newRollId(),
      tipoDado: selectedReward.tipoDado,
      recompensaNombre: selectedReward.nombre,
      personajeNombre: esPersonal ? personaje?.nombre : personajeNombre,
    };
    try {
      localStorage.setItem(pendingKey, JSON.stringify(meta));
    } catch {}

    setRollingState("rolling");
    setRollResult(null);
    setLutResultados(null);

    try {
      const res = await fetch(rollUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recompensa_id: selectedReward.id,
          cantidad: selectedReward.tipo === "lut" ? cantidad : 1,
          roll_id: meta.rollId,
          ...(esPersonal && personaje ? { personaje_id: personaje.id } : {}),
          ...extraBody,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        localStorage.removeItem(pendingKey);
        setRollingState("idle");
        setAlert({ variant: "error", message: data.error ?? "Error al tirar los dados" });
        return;
      }
      openOverlay(data, meta, false);
    } catch {
      // La petición pudo llegar igualmente: comprobar si la tirada se comprometió.
      try {
        const check = await fetch(`${rollUrl}?rollId=${meta.rollId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (check.ok) {
          openOverlay(await check.json(), meta, false);
          return;
        }
        if (check.status === 404) localStorage.removeItem(pendingKey);
      } catch {}
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

  const diceCount =
    rollingState === "done" && rollResult
      ? rollResult.resultados.length
      : selectedReward?.tipo === "oro_dados"
        ? selectedReward.cantidadDados
        : 1;

  return (
    <div className="bg-card border border-gold-dim/60 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-linear-to-r from-gold-dim/20 to-transparent hover:from-gold-dim/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gold text-sm font-serif tracking-wider flex items-center gap-1.5"><Dices className="w-4 h-4" /> Dados</span>
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
                    {Array.from({ length: diceCount }).map((_, i) => (
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
                    {!hideCost && selectedReward.costoOro > 0 && (
                      <p className="text-[11px] text-gold/70 font-sans">
                        Costo: {selectedReward.costoOro.toLocaleString("es-ES")} oro
                        {selectedReward.tipo === "lut" && cantidad > 1 && (
                          <span className="text-foreground/40 ml-1">
                            × {cantidad} = {(selectedReward.costoOro * cantidad).toLocaleString("es-ES")} oro
                          </span>
                        )}
                      </p>
                    )}

                    {/* Personaje que recibe los ítems (solo tirada personal) */}
                    {esPersonal && personajes.length > 0 && selectedReward.tipo !== "oro_dados" && (
                      <div className="flex items-center gap-2">
                        <UserRound className="w-3.5 h-3.5 text-gold/60 shrink-0" />
                        <select
                          value={personajeId ?? ""}
                          onChange={(e) => {
                            const id = Number(e.target.value) || null;
                            setPersonajeId(id);
                            try {
                              if (id) localStorage.setItem("dados-personaje", String(id));
                            } catch {}
                          }}
                          className="flex-1 max-w-48 px-2 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60 font-sans"
                          aria-label="Personaje que recibe los ítems"
                        >
                          {personajes.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {esPersonal && personajes.length === 0 && selectedReward.tipo !== "oro_dados" && (
                      <p className="text-[11px] text-amber-400/80 font-sans">
                        Sin personaje vivo: los ítems ganados no se entregarán.
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
                            {rollResult.objeto.icono && <span>{getIconForString(rollResult.objeto.nombre, "w-4 h-4 shrink-0", rollResult.objeto.icono)}</span>}
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
                          <span className="flex items-center gap-1.5"><Dices className="w-4 h-4" /> Tirar ×{cantidad}</span>
                        ) : (
                          <span className="flex items-center gap-1.5"><Dices className="w-4 h-4" /> Tirar</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Resultados LUT — multi-tirada */}
              {selectedReward?.tipo === "lut" && rollingState === "done" && lutResultados && lutResultados.length > 0 && (
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
                        <span className="text-green-400 font-semibold leading-6 flex items-center gap-1.5">
                          {getIconForString(r.objeto.nombre, "w-4 h-4 shrink-0", r.objeto.icono)} {r.objeto.nombre}
                          {(r.cantidadObjeto ?? 1) > 1 && <span className="text-foreground/50">×{r.cantidadObjeto}</span>}
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
                            ({r.oroDetalle.formula})
                          </span>
                        </span>
                      )}

                      {r.tipo === "subtabla" && r.subRoll && (
                        <span className="leading-5">
                          <span className="text-foreground/40 text-[10px] block">
                            {r.subRoll.subtablaNombre} → cara {r.subRoll.cara}
                          </span>
                          {r.subRoll.objeto ? (
                            <span className="text-green-400 font-semibold flex items-center gap-1.5">
                              {getIconForString(r.subRoll.objeto.nombre, "w-4 h-4 shrink-0", r.subRoll.objeto.icono)} {r.subRoll.objeto.nombre}
                              {(r.subRoll.cantidadObjeto ?? 1) > 1 && <span className="text-foreground/50">×{r.subRoll.cantidadObjeto}</span>}
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
                        <span className="truncate flex items-center gap-1.5">{getIconForString(si.objetoNombre, "w-3 h-3 shrink-0", si.objetoIcono)} {si.objetoNombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Escudo inmediato al pulsar Tirar: bloquea la interacción y da
          feedback mientras responde el servidor, sin oscurecer la página. */}
      {rollingState === "rolling" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {!overlay && <Loader2 className="w-6 h-6 text-gold animate-spin" />}
          </div>,
          document.body,
        )}

      {/* Overlay de tirada: el dado entra lanzado, rueda y revela el premio del servidor */}
      {overlay && (
        <DiceOverlay
          data={overlay}
          onFinished={handleOverlayFinished}
          onClose={() => setOverlay(null)}
        />
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
