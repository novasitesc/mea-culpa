"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Loader2, Coins, Package } from "lucide-react";
import DiceModule from "@/app/components/dice-module";
import SalaFeed from "@/app/components/sala-feed";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import FantasyAlert from "@/components/ui/fantasy-alert";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";
import type { RollResult } from "@/lib/types/dados";

type Props = {
  partida: SalaPartida;
  participantes: SalaParticipante[];
  token: string;
  eventos: SalaEvento[];
  onEvent: (ev: SalaEvento) => void;
};

type AlertState = { variant: "success" | "error"; message: string } | null;

export default function SalaDM({ partida, participantes, token, eventos, onEvent }: Props) {
  const [selectedPersonajeId, setSelectedPersonajeId] = useState<number | null>(
    participantes[0]?.personajeId ?? null,
  );
  const [assignTab, setAssignTab] = useState<"item" | "oro">("item");
  const [objects, setObjects] = useState<ObjectSelectorItem[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [selectedObjetoId, setSelectedObjetoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [oroDelta, setOroDelta] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const selectedParticipante = participantes.find((p) => p.personajeId === selectedPersonajeId) ?? null;

  const loadObjects = useCallback(async () => {
    if (objects.length > 0) return;
    setLoadingObjects(true);
    try {
      const res = await fetch("/api/admin/objetos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setObjects(
          (data as any[]).map((obj) => ({
            value: obj.id,
            name: obj.name,
            icon: obj.icon,
            searchText: `${obj.id} ${obj.itemType} ${obj.rarity}`,
          })),
        );
      }
    } finally {
      setLoadingObjects(false);
    }
  }, [objects.length, token]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  const rollApiUrl = `/api/partidas/${partida.id}/dados/roll`;
  const extraBody = useMemo(
    () => (selectedPersonajeId != null ? { personaje_id: selectedPersonajeId } : {}),
    [selectedPersonajeId],
  );

  function handleRollComplete(
    result: RollResult & { recompensaNombre: string; tipoDado: string },
  ) {
    if (!selectedParticipante) return;
    onEvent({
      tipo: "dado_tirado",
      recompensaNombre: result.recompensaNombre,
      tipoDado: result.tipoDado,
      resultados: result.resultados,
      tipoResultado: result.tipoResultado,
      objeto: result.objeto,
      cantidadOro: result.cantidadOro,
      lutResultados: result.lutResultados,
      personajeNombre: selectedParticipante.nombre,
      personajeId: selectedParticipante.personajeId,
    });
  }

  async function handleAsignar() {
    if (!selectedPersonajeId || !selectedParticipante) return;
    if (assignTab === "item" && !selectedObjetoId) {
      setAlert({ variant: "error", message: "Selecciona un ítem para asignar." });
      return;
    }
    if (assignTab === "oro") {
      const oro = parseInt(oroDelta, 10);
      if (!Number.isFinite(oro) || oro <= 0) {
        setAlert({ variant: "error", message: "Ingresa una cantidad de oro válida." });
        return;
      }
    }

    setAssigning(true);
    try {
      const body =
        assignTab === "item"
          ? { personaje_id: selectedPersonajeId, tipo: "item", objeto_id: selectedObjetoId, cantidad }
          : { personaje_id: selectedPersonajeId, tipo: "oro", oro_delta: parseInt(oroDelta, 10) };

      const res = await fetch(`/api/partidas/${partida.id}/asignar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setAlert({ variant: "error", message: data.error ?? "No se pudo asignar" });
        return;
      }

      onEvent({
        tipo: "asignacion_manual",
        objeto: data.objeto ?? undefined,
        cantidadOro: data.cantidadOro,
        cantidad: data.cantidad,
        personajeNombre: selectedParticipante.nombre,
        personajeId: selectedParticipante.personajeId,
      });

      setAlert({ variant: "success", message: "Asignación realizada." });
      setSelectedObjetoId(null);
      setCantidad(1);
      setOroDelta("");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Panel izquierdo: Dados y asignación manual */}
      <div className="flex flex-col gap-4 lg:w-[400px] shrink-0">
        {/* Selector de personaje objetivo */}
        <div className="rounded-lg border border-gold-dim/40 bg-card p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-sans">
            Personaje objetivo
          </p>
          <div className="flex flex-wrap gap-2">
            {participantes.map((p) => (
              <button
                key={p.personajeId}
                onClick={() => setSelectedPersonajeId(p.personajeId)}
                disabled={p.muerto}
                className={`px-3 py-1.5 rounded-full border text-xs font-sans transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedPersonajeId === p.personajeId
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-gold-dim/40 text-foreground/60 hover:border-gold-dim/70"
                }`}
              >
                {p.nombre}
                {p.muerto && " †"}
              </button>
            ))}
          </div>
          {!selectedPersonajeId && (
            <p className="text-[11px] text-rose-400 font-sans">Selecciona un personaje antes de tirar.</p>
          )}
        </div>

        {/* Módulo de dados */}
        {selectedPersonajeId ? (
          <DiceModule
            token={token}
            rollApiUrl={rollApiUrl}
            extraBody={extraBody}
            hideCost
            onRollComplete={handleRollComplete}
          />
        ) : (
          <div className="rounded-lg border border-gold-dim/20 bg-card/50 p-4 text-xs text-foreground/30 italic font-sans">
            Selecciona un personaje para activar los dados.
          </div>
        )}

        {/* Asignación manual */}
        <div className="rounded-lg border border-gold-dim/40 bg-card p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-sans">
            Asignación manual
          </p>

          {/* Tab item / oro */}
          <div className="flex gap-1">
            {(["item", "oro"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAssignTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-sans transition-all ${
                  assignTab === tab
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-gold-dim/30 text-foreground/50 hover:border-gold-dim/60"
                }`}
              >
                {tab === "item" ? <Package className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                {tab === "item" ? "Ítem" : "Oro"}
              </button>
            ))}
          </div>

          {assignTab === "item" && (
            <div className="space-y-2">
              {loadingObjects ? (
                <div className="flex items-center gap-2 text-xs text-foreground/40">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cargando catálogo...
                </div>
              ) : (
                <ObjectSelector
                  items={objects}
                  value={selectedObjetoId}
                  onChange={setSelectedObjetoId}
                  searchable
                  placeholder="Buscar ítem..."
                />
              )}
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-foreground/50 font-sans shrink-0">Cant:</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                />
              </div>
            </div>
          )}

          {assignTab === "oro" && (
            <input
              type="number"
              min="1"
              placeholder="Cantidad de oro"
              value={oroDelta}
              onChange={(e) => setOroDelta(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60"
            />
          )}

          <button
            onClick={handleAsignar}
            disabled={assigning || !selectedPersonajeId}
            className="w-full px-3 py-1.5 rounded bg-gold/10 border border-gold/40 text-xs text-gold font-sans font-semibold hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {assigning && <Loader2 className="w-3 h-3 animate-spin" />}
            Asignar
          </button>
        </div>
      </div>

      {/* Panel derecho: Feed */}
      <div className="flex-1 rounded-lg border border-gold-dim/40 bg-card p-3 min-h-[300px] lg:min-h-0 overflow-hidden">
        <SalaFeed eventos={eventos} />
      </div>

      <FantasyAlert
        open={alert !== null}
        variant={alert?.variant ?? "info"}
        message={alert?.message ?? ""}
        onClose={() => setAlert(null)}
      />
    </div>
  );
}
