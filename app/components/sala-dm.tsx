"use client";

// Vista del DM dentro de la sala. El panel de mando de la partida: avanzar de
// sala, tirar dados, repartir objetos, aplicar caídas, cansancio y muertes,
// declarar descansos y cerrar la expedición.
// Cada botón llama a su ruta de /api/partidas/[id]/* o /api/admin/personajes/*.

import { useState, useCallback, useEffect, useMemo } from "react";
import { Loader2, Coins, Package, X, Skull, ChevronDown, ChevronUp, Scissors, HeartCrack, Plus, Minus, Moon, Zap, DoorOpen } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import DiceModule from "@/app/components/dice-module";
import SalaFeed from "@/app/components/sala-feed";
import NotasWidget from "@/app/components/notas-widget";
import CaidasTracker from "@/app/components/caidas-tracker";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import FantasyAlert from "@/components/ui/fantasy-alert";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";
import type { RollResult } from "@/lib/types/dados";
import { LIMBS } from "@/lib/limbs";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import { SALAS_POR_DESCANSO, salasDesdeUltimoDescanso } from "@/lib/descanso";

type Props = {
  partida: SalaPartida;
  participantes: SalaParticipante[];
  token: string;
  eventos: SalaEvento[];
  onEvent: (ev: SalaEvento) => void;
  onStart: () => void;
};

type AlertState = { variant: "success" | "error" | "warning"; message: string } | null;

type CloseRewardItem = { id: string; objectId: number | null; qty: number };
type CloseReward = { gold: number; levelUps: number; items: CloseRewardItem[] };

function mkId() { return Math.random().toString(36).slice(2, 9); }

export default function SalaDM({ partida, participantes, token, eventos, onEvent, onStart }: Props) {

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

  // Start game state
  const [startingGame, setStartingGame] = useState(false);

  // Close modal state
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingGame, setClosingGame] = useState(false);
  const [closeRewards, setCloseRewards] = useState<Record<number, CloseReward>>({});

  // Dismember panel state
  const [dismemberOpen, setDismemberOpen] = useState(false);
  const [dismemberPersonajeId, setDismemberPersonajeId] = useState<number | null>(
    participantes[0]?.personajeId ?? null,
  );
  const [extremidades, setExtremidades] = useState<Record<number, Record<string, boolean>>>(() => {
    const init: Record<number, Record<string, boolean>> = {};
    for (const p of participantes) {
      init[p.personajeId] = (p.extremidades as Record<string, boolean> | null) ?? {};
    }
    return init;
  });
  const [dismembering, setDismembering] = useState<string | null>(null);

  // Caídas panel state
  const [caidasOpen, setCaidasOpen] = useState(false);
  const [caidasPersonajeId, setCaidasPersonajeId] = useState<number | null>(
    participantes[0]?.personajeId ?? null,
  );
  const [caidasLoading, setCaidasLoading] = useState<1 | -1 | null>(null);
  const [cansancioLoading, setCansancioLoading] = useState<1 | -1 | null>(null);

  // Descanso largo (resetear caídas) state
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [resting, setResting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const selectedParticipante = participantes.find((p) => p.personajeId === selectedPersonajeId) ?? null;
  const participantesActivos = participantes.filter((p) => !p.muerto && !p.derrotado);
  const participantesQueDescansan = participantesActivos.filter((p) => p.caidas > 0 || p.cansancio > 0);
  // D&D 5e 2014: un solo descanso largo por día de aventura → uno por expedición.
  const yaDescansaron = eventos.some((ev) => ev.tipo === "descanso_largo");
  // Salas exploradas desde el último descanso: a las SALAS_POR_DESCANSO se avisa.
  const salasRecorridas = salasDesdeUltimoDescanso(eventos);
  const tocaDescanso = salasRecorridas >= SALAS_POR_DESCANSO;

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
      entregas: result.entregas,
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

  // ── Start game ────────────────────────────────────────────────────────────

  async function handleStartGame() {
    setStartingGame(true);
    try {
      const res = await fetch("/api/admin/partidas", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ partidaId: partida.id, action: "start" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo iniciar la partida" });
        return;
      }
      onEvent({ tipo: "partida_iniciada" });
      onStart();
    } finally {
      setStartingGame(false);
    }
  }

  // ── Session summary helper ─────────────────────────────────────────────────

  function buildSessionSummary(personajeId: number) {
    const relevant = eventos.filter(
      (ev) =>
        (ev.tipo === "dado_tirado" || ev.tipo === "asignacion_manual") &&
        (ev as any).personajeId === personajeId,
    ) as Array<{ cantidadOro?: number; objeto?: { id: number; nombre: string; icono: string }; cantidad?: number; lutResultados?: any[] }>;

    let oroTotal = 0;
    const itemsMap = new Map<number, { nombre: string; icono: string; qty: number }>();

    for (const ev of relevant) {
      if ((ev as any).tipo === "dado_tirado" && (ev as any).lutResultados?.length) {
        for (const r of (ev as any).lutResultados) {
          const obj = r.tipo === "item" ? r.objeto : r.tipo === "subtabla" ? r.subRoll?.objeto : null;
          if (obj) {
            const cur = itemsMap.get(obj.id);
            itemsMap.set(obj.id, cur ? { ...cur, qty: cur.qty + 1 } : { nombre: obj.nombre, icono: obj.icono, qty: 1 });
          }
          if (r.tipo === "oro") oroTotal += r.oroDetalle?.cantidadOro ?? 0;
          if (r.tipo === "subtabla" && r.subRoll?.cantidadOro) oroTotal += r.subRoll.cantidadOro;
        }
      } else {
        if (ev.cantidadOro) oroTotal += ev.cantidadOro;
        if (ev.objeto) {
          const qty = (ev as any).cantidad ?? 1;
          const cur = itemsMap.get(ev.objeto.id);
          itemsMap.set(ev.objeto.id, cur
            ? { ...cur, qty: cur.qty + qty }
            : { nombre: ev.objeto.nombre, icono: ev.objeto.icono, qty });
        }
      }
    }

    return { oroTotal, items: Array.from(itemsMap.entries()).map(([id, v]) => ({ id, ...v })) };
  }

  // ── Dismember handler ──────────────────────────────────────────────────────

  async function handleDismember(personajeId: number, miembro: string, label: string, currentlyDismembered: boolean) {
    const desmembrado = !currentlyDismembered;
    const key = `${personajeId}-${miembro}`;
    setDismembering(key);
    try {
      const res = await fetch("/api/admin/personajes/extremidades", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personajeId, miembro, miembroLabel: label, desmembrado, partidaId: partida.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo actualizar" });
        return;
      }
      const { extremidades: updated } = await res.json();
      setExtremidades((prev) => ({ ...prev, [personajeId]: updated ?? {} }));
      const participante = participantes.find((p) => p.personajeId === personajeId);
      onEvent({
        tipo: "desmembramiento",
        personajeId,
        personajeNombre: participante?.nombre ?? "Personaje",
        miembro,
        miembroLabel: label,
        desmembrado,
      });
    } finally {
      setDismembering(null);
    }
  }

  // ── Caídas handler ─────────────────────────────────────────────────────────

  async function handleCaida(personajeId: number, delta: 1 | -1) {
    const participante = participantes.find((p) => p.personajeId === personajeId);
    if (!participante) return;
    setCaidasLoading(delta);
    try {
      const res = await fetch("/api/admin/personajes/caidas", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personajeId, delta, partidaId: partida.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo actualizar las caídas" });
        return;
      }
      const data = await res.json();
      onEvent({
        tipo: "caida",
        personajeId,
        personajeNombre: participante.nombre,
        caidas: Number(data.caidas ?? 0),
        delta,
        derrotado: Boolean(data.derrotado),
        ...(data.puntosCansancio !== undefined ? { cansancio: Number(data.puntosCansancio) } : {}),
      });
    } finally {
      setCaidasLoading(null);
    }
  }

  // ── Cansancio handler ──────────────────────────────────────────────────────

  async function handleCansancio(personajeId: number, delta: 1 | -1) {
    const participante = participantes.find((p) => p.personajeId === personajeId);
    if (!participante) return;
    setCansancioLoading(delta);
    try {
      const res = await fetch("/api/admin/personajes/cansancio", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personajeId, delta, partidaId: partida.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo actualizar el cansancio" });
        return;
      }
      const data = await res.json();
      onEvent({
        tipo: "cansancio",
        personajeId,
        personajeNombre: participante.nombre,
        cansancio: Number(data.cansancio ?? 0),
        delta,
      });
    } finally {
      setCansancioLoading(null);
    }
  }

  // ── Avanzar de sala ────────────────────────────────────────────────────────

  async function handleAvanzarSala() {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/partidas/${partida.id}/sala-avanzada`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo avanzar de sala" });
        return;
      }
      const data = await res.json();
      onEvent({
        tipo: "sala_avanzada",
        sala: Number(data.sala ?? 0),
        requiereDescanso: Boolean(data.requiereDescanso),
      });
    } finally {
      setAdvancing(false);
    }
  }

  // ── Descanso handler (corto o largo) ───────────────────────────────────────

  async function handleDescanso(tipo: "corto" | "largo") {
    setResting(true);
    try {
      const res = await fetch("/api/admin/personajes/caidas", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ partidaId: partida.id, tipo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo realizar el descanso" });
        return;
      }
      const data = await res.json();
      setRestModalOpen(false);
      onEvent({
        tipo: tipo === "corto" ? "descanso_corto" : "descanso_largo",
        personajes: data.personajes ?? [],
      });
      const sinRacion = (data.personajes ?? []).filter((p: any) => p.sinRacion);
      if (sinRacion.length > 0) {
        setAlert({
          variant: "warning",
          message: `Descanso ${tipo} realizado. Sin ración (+1 cansancio): ${sinRacion
            .map((p: any) => p.nombre)
            .join(", ")}.`,
        });
      } else {
        setAlert({
          variant: "success",
          message:
            tipo === "corto"
              ? "Descanso corto realizado: raciones consumidas y 1 caída curada."
              : "Descanso largo realizado: caídas restauradas, −1 cansancio y conjuros recuperados.",
        });
      }
    } finally {
      setResting(false);
    }
  }

  // ── Close modal helpers ────────────────────────────────────────────────────

  function openCloseModal() {
    const initial: Record<number, CloseReward> = {};
    for (const p of participantes) {
      initial[p.personajeId] = { gold: 0, levelUps: 0, items: [] };
    }
    setCloseRewards(initial);
    setCloseModalOpen(true);
  }

  function updateCloseReward(personajeId: number, updates: Partial<{ gold: number; levelUps: number }>) {
    setCloseRewards((prev) => ({
      ...prev,
      [personajeId]: { ...(prev[personajeId] ?? { gold: 0, levelUps: 0, items: [] }), ...updates },
    }));
  }

  function addCloseItem(personajeId: number) {
    setCloseRewards((prev) => {
      const cur = prev[personajeId] ?? { gold: 0, levelUps: 0, items: [] };
      return { ...prev, [personajeId]: { ...cur, items: [...cur.items, { id: mkId(), objectId: null, qty: 1 }] } };
    });
  }

  function updateCloseItem(personajeId: number, itemId: string, updates: Partial<{ objectId: number | null; qty: number }>) {
    setCloseRewards((prev) => {
      const cur = prev[personajeId] ?? { gold: 0, levelUps: 0, items: [] };
      return { ...prev, [personajeId]: { ...cur, items: cur.items.map((it) => it.id === itemId ? { ...it, ...updates } : it) } };
    });
  }

  function removeCloseItem(personajeId: number, itemId: string) {
    setCloseRewards((prev) => {
      const cur = prev[personajeId] ?? { gold: 0, levelUps: 0, items: [] };
      return { ...prev, [personajeId]: { ...cur, items: cur.items.filter((it) => it.id !== itemId) } };
    });
  }

  async function submitClose() {
    setClosingGame(true);
    try {
      const participantRewards = participantes.map((p) => {
        const r = closeRewards[p.personajeId] ?? { gold: 0, levelUps: 0, items: [] };
        return {
          characterId: p.personajeId,
          gold: Math.max(0, Number(r.gold) || 0),
          levelUps: Math.max(0, Math.floor(Number(r.levelUps) || 0)),
          items: r.items
            .filter((it) => it.objectId != null)
            .map((it) => ({ objectId: Number(it.objectId), qty: Math.max(1, Number(it.qty) || 1) })),
        };
      });

      const res = await fetch("/api/admin/partidas", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ partidaId: partida.id, action: "close", participantRewards }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudo cerrar la partida" });
        return;
      }

      setCloseModalOpen(false);
      onEvent({ tipo: "partida_cerrada" });
    } finally {
      setClosingGame(false);
    }
  }

  const inputCls =
    "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all";

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Panel izquierdo: Dados, notas y asignación manual */}
      <div className="flex flex-col gap-4 lg:w-[400px] shrink-0">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-sans">Vista DM</p>
          {partida.estado === "abierta" ? (
            <button
              type="button"
              onClick={handleStartGame}
              disabled={startingGame}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-500/50 bg-emerald-900/20 text-xs text-emerald-300 hover:bg-emerald-900/40 transition-all font-sans disabled:opacity-60"
            >
              {startingGame ? <Loader2 className="w-3 h-3 animate-spin" /> : "▶"}
              {startingGame ? "Iniciando..." : "Iniciar partida"}
            </button>
          ) : (
            <button
              type="button"
              onClick={openCloseModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-rose-500/40 bg-rose-900/20 text-xs text-rose-300 hover:bg-rose-900/40 transition-all font-sans"
            >
              <Skull className="w-3 h-3" />
              Cerrar partida
            </button>
          )}
        </div>

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
                disabled={p.muerto || p.derrotado}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-sans transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedPersonajeId === p.personajeId
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-gold-dim/40 text-foreground/60 hover:border-gold-dim/70"
                }`}
              >
                {p.nombre}
                {p.muerto && " †"}
                {!p.muerto && p.derrotado && <Skull className="w-3 h-3 text-red-500" />}
                {!p.muerto && !p.derrotado && p.caidas > 0 && (
                  <CaidasTracker caidas={p.caidas} size="sm" />
                )}
              </button>
            ))}
          </div>
          {!selectedPersonajeId && (
            <p className="text-[11px] text-rose-400 font-sans">Selecciona un personaje antes de tirar.</p>
          )}
        </div>

        {/* Módulo de dados */}
        {partida.estado === "abierta" ? (
          <div className="rounded-lg border border-gold-dim/20 bg-card/50 p-4 text-xs text-foreground/30 italic font-sans">
            Inicia la partida para activar los dados y la asignación.
          </div>
        ) : selectedPersonajeId ? (
          <DiceModule
            token={token}
            rollApiUrl={rollApiUrl}
            extraBody={extraBody}
            hideCost
            personajeNombre={selectedParticipante?.nombre}
            onRollComplete={handleRollComplete}
          />
        ) : (
          <div className="rounded-lg border border-gold-dim/20 bg-card/50 p-4 text-xs text-foreground/30 italic font-sans">
            Selecciona un personaje para activar los dados.
          </div>
        )}

        {/* Notas del DM */}
        <NotasWidget token={token} />

        {/* Panel de caídas — solo cuando en_progreso */}
        {partida.estado === "en_progreso" && (
          <div className="rounded-lg border border-red-900/40 bg-card p-3 space-y-3">
            <button
              type="button"
              onClick={() => setCaidasOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest text-red-400/70 font-sans"
            >
              <span className="inline-flex items-center gap-1.5">
                <HeartCrack className="w-3 h-3" />
                Caídas y cansancio
              </span>
              {caidasOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {caidasOpen && (
              <>
                <div className="flex flex-wrap gap-2">
                  {participantes.map((p) => (
                    <button
                      key={p.personajeId}
                      onClick={() => setCaidasPersonajeId(p.personajeId)}
                      disabled={p.muerto}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-sans transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        caidasPersonajeId === p.personajeId
                          ? "border-red-500 bg-red-900/20 text-red-300"
                          : "border-gold-dim/40 text-foreground/60 hover:border-red-500/50"
                      }`}
                    >
                      {p.nombre}
                      {p.muerto && " †"}
                      {!p.muerto && p.derrotado && <Skull className="w-3 h-3 text-red-500" />}
                    </button>
                  ))}
                </div>

                {caidasPersonajeId != null && (() => {
                  const sel = participantes.find((p) => p.personajeId === caidasPersonajeId);
                  if (!sel) return null;
                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 rounded border border-red-900/30 bg-black/20 px-3 py-2.5">
                        <CaidasTracker caidas={sel.caidas} size="md" showLabel />
                        {sel.derrotado && (
                          <span className="text-[10px] uppercase tracking-widest text-red-400 font-sans inline-flex items-center gap-1">
                            <Skull className="w-3 h-3" /> Derrotado
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCaida(sel.personajeId, -1)}
                          disabled={caidasLoading !== null || sel.caidas <= 0}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-border text-[11px] font-sans text-foreground/60 hover:border-emerald-500/50 hover:text-emerald-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {caidasLoading === -1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />}
                          Quitar caída
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCaida(sel.personajeId, 1)}
                          disabled={caidasLoading !== null || sel.caidas >= MAX_CAIDAS}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-red-500/50 bg-red-900/20 text-[11px] font-sans text-red-300 hover:bg-red-900/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {caidasLoading === 1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Marcar caída
                        </button>
                      </div>

                      <p className="text-[10px] text-foreground/40 font-sans leading-relaxed">
                        A la {MAX_CAIDAS}.ª caída pierde la expedición, se retira al Nexo y carga
                        +{CANSANCIO_POR_DERROTA} punto de cansancio. Solo un descanso largo restaura las caídas.
                      </p>

                      <div
                        className="flex items-center justify-between gap-2 rounded border border-amber-900/30 bg-black/20 px-3 py-2.5"
                        title={EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, sel.cansancio)]}
                      >
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-foreground/50 font-sans">
                          <Zap className={`w-3 h-3 ${sel.cansancio >= MAX_CANSANCIO - 2 ? "text-red-500" : "text-amber-400/80"}`} />
                          Cansancio
                        </span>
                        <span className={`text-xs font-semibold font-sans ${sel.cansancio >= MAX_CANSANCIO - 2 ? "text-red-400" : "text-amber-300/90"}`}>
                          {sel.cansancio}/{MAX_CANSANCIO}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCansancio(sel.personajeId, -1)}
                          disabled={cansancioLoading !== null || sel.cansancio <= 0}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-border text-[11px] font-sans text-foreground/60 hover:border-emerald-500/50 hover:text-emerald-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {cansancioLoading === -1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />}
                          Aliviar cansancio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCansancio(sel.personajeId, 1)}
                          disabled={cansancioLoading !== null || sel.cansancio >= MAX_CANSANCIO}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-amber-500/50 bg-amber-900/20 text-[11px] font-sans text-amber-300 hover:bg-amber-900/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {cansancioLoading === 1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Añadir cansancio
                        </button>
                      </div>

                      {sel.cansancio > 0 && (
                        <p className="text-[10px] text-foreground/40 font-sans leading-relaxed">
                          Nivel {sel.cansancio}: {EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, sel.cansancio)]}.
                          Satura en {MAX_CANSANCIO} sin matar; la muerte solo llega al rehusar el descanso.
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="border-t border-red-900/20 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
                      Sala {salasRecorridas} / {SALAS_POR_DESCANSO}
                    </span>
                    <button
                      type="button"
                      onClick={handleAvanzarSala}
                      disabled={advancing}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#8B7355]/40 text-[11px] font-sans text-foreground/70 hover:text-gold hover:border-gold/50 transition-all disabled:opacity-40"
                    >
                      {advancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <DoorOpen className="w-3 h-3" />}
                      Avanzar sala
                    </button>
                  </div>

                  {tocaDescanso && (
                    <p className="text-[10px] text-amber-300 font-sans leading-relaxed rounded border border-amber-600/40 bg-amber-900/15 px-2 py-1.5">
                      El grupo lleva {salasRecorridas} salas sin descansar: toca el descanso
                      obligatorio.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setRestModalOpen(true)}
                    disabled={participantesActivos.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-emerald-500/40 bg-emerald-900/15 text-[11px] font-sans text-emerald-300 hover:bg-emerald-900/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Moon className="w-3 h-3" />
                    Descansar · Corto o largo
                  </button>
                  {yaDescansaron && (
                    <p className="text-[10px] text-foreground/30 italic font-sans mt-1.5 text-center">
                      Ya se realizó el descanso largo de esta expedición; quedan los cortos.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Panel de desmembramiento — solo cuando en_progreso */}
        {partida.estado === "en_progreso" && (
          <div className="rounded-lg border border-rose-900/40 bg-card p-3 space-y-3">
            <button
              type="button"
              onClick={() => setDismemberOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest text-rose-400/70 font-sans"
            >
              Desmembramiento
              {dismemberOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {dismemberOpen && (
              <>
                <div className="flex flex-wrap gap-2">
                  {participantes.map((p) => (
                    <button
                      key={p.personajeId}
                      onClick={() => setDismemberPersonajeId(p.personajeId)}
                      disabled={p.muerto}
                      className={`px-3 py-1.5 rounded-full border text-xs font-sans transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        dismemberPersonajeId === p.personajeId
                          ? "border-rose-500 bg-rose-900/20 text-rose-300"
                          : "border-gold-dim/40 text-foreground/60 hover:border-rose-500/50"
                      }`}
                    >
                      {p.nombre}{p.muerto && " †"}
                    </button>
                  ))}
                </div>

                {dismemberPersonajeId != null && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {LIMBS.map(({ key, label }) => {
                      const isDismembered = extremidades[dismemberPersonajeId]?.[key] === false;
                      const loadKey = `${dismemberPersonajeId}-${key}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleDismember(dismemberPersonajeId, key, label, isDismembered)}
                          disabled={dismembering === loadKey}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-sans transition-all disabled:opacity-60 ${
                            isDismembered
                              ? "border-rose-500/60 bg-rose-900/30 text-rose-300"
                              : "border-border text-foreground/50 hover:border-rose-500/40 hover:text-rose-300/70"
                          }`}
                        >
                          {dismembering === loadKey ? (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          ) : (
                            <span className="text-[10px] shrink-0">{isDismembered ? <Scissors className="w-3 h-3 text-rose-400" /> : "○"}</span>
                          )}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Asignación manual — solo cuando en_progreso */}
        <div className={`rounded-lg border border-gold-dim/40 bg-card p-3 space-y-3 ${partida.estado === "abierta" ? "hidden" : ""}`}>
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
      <div className="flex-1 rounded-lg border border-gold-dim/40 bg-card p-3 min-h-[300px] max-h-[65vh] lg:min-h-0 overflow-hidden">
        <SalaFeed eventos={eventos} />
      </div>

      {/* Modal de cierre */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-gold">Cerrar partida: {partida.titulo}</h2>
              <button
                onClick={() => setCloseModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto min-h-0 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Asigna recompensas finales por personaje antes de cerrar la partida.
              </p>

              {loadingObjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gold" />
                </div>
              ) : (
                participantes.map((p) => {
                  const r = closeRewards[p.personajeId] ?? { gold: 0, levelUps: 0, items: [] };
                  return (
                    <div key={p.personajeId} className="border border-border rounded-lg p-4 bg-secondary/10 flex flex-col gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{p.nombre}</p>
                        {p.derrotado && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/40 bg-red-900/20 text-[10px] uppercase tracking-widest text-red-400 font-sans">
                            <Skull className="w-3 h-3" /> Derrotado
                          </span>
                        )}
                        {!p.derrotado && p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" />}
                      </div>

                      {/* Resumen de sesión (read-only) */}
                      {(() => {
                        const { oroTotal, items } = buildSessionSummary(p.personajeId);
                        const hasAnything = oroTotal > 0 || items.length > 0;
                        return (
                          <div className="rounded border border-gold-dim/20 bg-black/20 p-2.5 flex flex-col gap-1.5">
                            <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
                              Recibido en la sesión
                            </p>
                            {!hasAnything ? (
                              <p className="text-xs text-foreground/30 italic font-sans">Sin asignaciones en esta sesión</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {oroTotal > 0 && (
                                  <span className="text-xs text-gold font-semibold font-sans">
                                    +{oroTotal.toLocaleString("es-ES")} oro
                                  </span>
                                )}
                                {items.map((item) => (
                                  <span key={item.id} className="text-xs text-green-400 font-semibold font-sans flex items-center gap-1.5">
                                    {getIconForString(item.nombre, "w-3.5 h-3.5 shrink-0", item.icono)} {item.nombre}{item.qty > 1 ? ` ×${item.qty}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">Oro a asignar</label>
                          <GoldAmountInput
                            className={inputCls}
                            value={r.gold}
                            min={0}
                            allowZero
                            emptyWhenZero
                            onChangeValue={(v) =>
                              updateCloseReward(p.personajeId, { gold: v === "" ? 0 : Math.max(0, Number(v) || 0) })
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">Subidas de nivel</label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            className={inputCls}
                            value={r.levelUps}
                            onChange={(e) =>
                              updateCloseReward(p.personajeId, { levelUps: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                            }
                          />
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Objetos</p>
                          <button
                            type="button"
                            onClick={() => addCloseItem(p.personajeId)}
                            className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                          >
                            Agregar objeto
                          </button>
                        </div>

                        {r.items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin objetos</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {r.items.map((item) => (
                              <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <ObjectSelector
                                  className={inputCls}
                                  items={objects}
                                  value={item.objectId}
                                  onChange={(v) => updateCloseItem(p.personajeId, item.id, { objectId: v })}
                                  searchable
                                  searchPlaceholder="Buscar objeto..."
                                  noSearchResultsLabel="Sin coincidencias"
                                  placeholder="Selecciona objeto"
                                  emptyLabel="Sin objetos"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  className={inputCls}
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateCloseItem(p.personajeId, item.id, { qty: Math.max(1, Number(e.target.value) || 1) })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => removeCloseItem(p.personajeId, item.id)}
                                  className="px-3 py-2 text-xs rounded border border-border hover:bg-muted"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-5">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                className="px-4 py-2 rounded border border-border bg-secondary hover:bg-muted text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitClose}
                disabled={closingGame}
                className="px-4 py-2 rounded bg-destructive/80 hover:bg-destructive text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
              >
                {closingGame && <Loader2 className="w-4 h-4 animate-spin" />}
                {closingGame ? "Cerrando..." : "Cerrar y guardar recompensas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de descanso largo */}
      {restModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                <Moon className="w-5 h-5" /> Descanso
              </h2>
              <button
                onClick={() => setRestModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto min-h-0 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Cada descanso consume 1 ración por personaje activo; quien no tenga ración no se
                recupera y gana +1 de cansancio. Los muertos o derrotados ya abandonaron la
                expedición y no se ven afectados.
              </p>

              <button
                type="button"
                onClick={() => handleDescanso("corto")}
                disabled={resting}
                className="text-left rounded-lg border border-emerald-900/40 bg-emerald-950/15 hover:bg-emerald-950/35 hover:border-emerald-600/50 transition-all p-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-emerald-300">Descanso corto</p>
                <p className="text-[11px] text-foreground/50 font-sans mt-0.5">
                  Un respiro junto al camino: cura 1 caída. Sin límite por expedición.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDescanso("largo")}
                disabled={resting || yaDescansaron}
                className="text-left rounded-lg border border-emerald-900/40 bg-emerald-950/15 hover:bg-emerald-950/35 hover:border-emerald-600/50 transition-all p-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-emerald-300">Descanso largo</p>
                <p className="text-[11px] text-foreground/50 font-sans mt-0.5">
                  Acampar toda la noche: requiere 1 tienda de acampar del grupo. Caídas a 0,
                  −1 nivel de cansancio y todos los conjuros gastados vuelven. Solo uno por
                  expedición.
                  {yaDescansaron && (
                    <span className="block italic text-foreground/35 mt-0.5">
                      Ya se realizó en esta expedición.
                    </span>
                  )}
                </p>
              </button>

              {participantesQueDescansan.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {participantesQueDescansan.map((p) => (
                    <div
                      key={p.personajeId}
                      className="flex items-center justify-between gap-2 rounded border border-emerald-900/30 bg-black/20 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-foreground truncate">{p.nombre}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        {p.cansancio > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-sans text-amber-300/90">
                            <Zap className="w-3 h-3 text-amber-400/80" />
                            {p.cansancio}/{MAX_CANSANCIO}
                          </span>
                        )}
                        {p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" animated={false} />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-foreground/40 italic font-sans">
                  Nadie acumula caídas ni cansancio; el grupo descansa igualmente.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border p-5">
              {resting && (
                <span className="mr-auto inline-flex items-center gap-2 text-sm text-emerald-300 font-sans">
                  <Loader2 className="w-4 h-4 animate-spin" /> Descansando...
                </span>
              )}
              <button
                type="button"
                onClick={() => setRestModalOpen(false)}
                disabled={resting}
                className="px-4 py-2 rounded border border-border bg-secondary hover:bg-muted text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
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
