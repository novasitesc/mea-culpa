"use client";

// Vista del DM dentro de la sala: el puesto de mando de la partida.
//
// El diseño es un "deck" de tres piezas para que el DM no tenga que ir
// abriendo acordeones en mitad de una escena:
//   1. Barra de mando  — estado de la partida y acciones globales (iniciar,
//      avanzar de sala, descansar, cerrar).
//   2. Tira de personajes — todos los participantes a la vista con su estado
//      (caídas, cansancio, tropas, muerte); se elige uno y todo lo de abajo
//      pasa a apuntar a él.
//   3. Panel de acciones en pestañas — Dados · Botín · Estado · Ejército,
//      junto al feed en vivo.
//
// Cada botón llama a su ruta de /api/partidas/[id]/* o /api/admin/personajes/*.

import { useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2, Coins, Package, X, Skull, Scissors, HeartCrack, Plus, Minus,
  Moon, Zap, DoorOpen, Dices, Swords, Users, Play, Flag,
} from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import DiceModule from "@/app/components/dice-module";
import SalaFeed from "@/app/components/sala-feed";
import NotasWidget from "@/app/components/notas-widget";
import CaidasTracker from "@/app/components/caidas-tracker";
import EjercitoGrid from "@/app/components/ejercito-grid";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import FantasyAlert from "@/components/ui/fantasy-alert";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";
import type { RollResult } from "@/lib/types/dados";
import { LIMBS } from "@/lib/limbs";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import { SALAS_POR_DESCANSO, salasDesdeUltimoDescanso } from "@/lib/descanso";
import { TIPO_EJERCITO, totalTropas } from "@/lib/ejercito";

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

type TabKey = "dados" | "botin" | "estado" | "ejercito";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Dices }> = [
  { key: "dados", label: "Dados", icon: Dices },
  { key: "botin", label: "Botín", icon: Package },
  { key: "estado", label: "Estado", icon: HeartCrack },
  { key: "ejercito", label: "Ejército", icon: Swords },
];

const EASE = [0.16, 1, 0.3, 1] as const;

function mkId() { return Math.random().toString(36).slice(2, 9); }

export default function SalaDM({ partida, participantes, token, eventos, onEvent, onStart }: Props) {
  const [selectedPersonajeId, setSelectedPersonajeId] = useState<number | null>(
    participantes[0]?.personajeId ?? null,
  );
  const [tab, setTab] = useState<TabKey>("dados");
  const [alert, setAlert] = useState<AlertState>(null);

  // Botín
  const [assignTab, setAssignTab] = useState<"item" | "oro">("item");
  const [objects, setObjects] = useState<ObjectSelectorItem[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [selectedObjetoId, setSelectedObjetoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [oroDelta, setOroDelta] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Ciclo de la partida
  const [startingGame, setStartingGame] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingGame, setClosingGame] = useState(false);
  const [closeRewards, setCloseRewards] = useState<Record<number, CloseReward>>({});
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [resting, setResting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Estado del personaje
  const [extremidades, setExtremidades] = useState<Record<number, Record<string, boolean>>>(() => {
    const init: Record<number, Record<string, boolean>> = {};
    for (const p of participantes) {
      init[p.personajeId] = (p.extremidades as Record<string, boolean> | null) ?? {};
    }
    return init;
  });
  const [dismembering, setDismembering] = useState<string | null>(null);
  const [caidasLoading, setCaidasLoading] = useState<1 | -1 | null>(null);
  const [cansancioLoading, setCansancioLoading] = useState<1 | -1 | null>(null);

  // Ejército — se guarda solo el id: la unidad se deriva de props, así al
  // aplicar bajas (o al aniquilar el regimiento) el panel se actualiza solo.
  const [unidadSeleccionadaId, setUnidadSeleccionadaId] = useState<number | null>(null);
  const [bajas, setBajas] = useState(1);
  const [aplicandoBajas, setAplicandoBajas] = useState(false);

  const selectedParticipante =
    participantes.find((p) => p.personajeId === selectedPersonajeId) ?? null;
  const participantesActivos = participantes.filter((p) => !p.muerto && !p.derrotado);
  const participantesQueDescansan = participantesActivos.filter(
    (p) => p.caidas > 0 || p.cansancio > 0,
  );
  // D&D 5e 2014: un solo descanso largo por día de aventura → uno por expedición.
  const yaDescansaron = eventos.some((ev) => ev.tipo === "descanso_largo");
  const salasRecorridas = salasDesdeUltimoDescanso(eventos);
  const tocaDescanso = salasRecorridas >= SALAS_POR_DESCANSO;
  const enProgreso = partida.estado === "en_progreso";

  const unidadActual =
    selectedParticipante?.ejercito.find((u) => u.id === unidadSeleccionadaId) ?? null;

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
          (data as any[])
            // Las unidades de ejército no se reparten como botín: solo se
            // compran en tienda y viven en su propio inventario.
            .filter((obj) => obj.itemType !== TIPO_EJERCITO)
            .map((obj) => ({
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

  useEffect(() => { loadObjects(); }, [loadObjects]);

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

  // ── Ciclo de la partida ────────────────────────────────────────────────────

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
      setAlert(
        sinRacion.length > 0
          ? {
              variant: "warning",
              message: `Descanso ${tipo} realizado. Sin ración (+1 cansancio): ${sinRacion
                .map((p: any) => p.nombre)
                .join(", ")}.`,
            }
          : {
              variant: "success",
              message:
                tipo === "corto"
                  ? "Descanso corto realizado: raciones consumidas y 1 caída curada."
                  : "Descanso largo realizado: caídas restauradas, −1 cansancio y conjuros recuperados.",
            },
      );
    } finally {
      setResting(false);
    }
  }

  // ── Estado del personaje ───────────────────────────────────────────────────

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

  // ── Bajas de ejército ──────────────────────────────────────────────────────

  async function aplicarBajas(aniquilar: boolean) {
    if (!unidadActual || !selectedParticipante) return;
    setAplicandoBajas(true);
    try {
      const res = await fetch("/api/admin/personajes/ejercito", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          unidadId: unidadActual.id,
          bajas,
          aniquilar,
          partidaId: partida.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAlert({ variant: "error", message: (err as any).error ?? "No se pudieron aplicar las bajas" });
        return;
      }
      const data = await res.json();
      onEvent({
        tipo: "ejercito_baja",
        personajeId: Number(data.personajeId),
        personajeNombre: data.personajeNombre ?? selectedParticipante.nombre,
        unidadId: Number(data.unidadId),
        unidadNombre: data.unidadNombre,
        unidadIcono: data.unidadIcono,
        bajas: Number(data.bajas ?? 0),
        restante: Number(data.restante ?? 0),
        aniquilada: Boolean(data.aniquilada),
      });
      setBajas(1);
      if (data.aniquilada) setUnidadSeleccionadaId(null);
    } finally {
      setAplicandoBajas(false);
    }
  }

  // ── Resumen de sesión (modal de cierre) ────────────────────────────────────

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
  const cardCls = "rounded-xl border border-[#8B7355]/40 bg-gradient-to-b from-card to-[#100e0b]";

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ─── 1. Barra de mando ─────────────────────────────────────────────── */}
      <div className={`${cardCls} relative overflow-hidden px-4 py-3`}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <span
              className={`relative flex h-2 w-2 ${enProgreso ? "" : "opacity-60"}`}
              aria-hidden
            >
              {enProgreso && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  enProgreso ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
            </span>
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/50">
              {enProgreso ? "Expedición en curso" : "Sala abierta"}
            </p>
          </div>

          {/* Progreso de salas hasta el descanso obligatorio */}
          {enProgreso && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1" title={`${salasRecorridas} de ${SALAS_POR_DESCANSO} salas`}>
                {Array.from({ length: SALAS_POR_DESCANSO }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={{
                      backgroundColor: i < salasRecorridas ? "#D4AF37" : "rgba(139,115,85,0.25)",
                      scaleY: i < salasRecorridas ? 1 : 0.55,
                    }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="h-3 w-5 origin-center rounded-sm"
                  />
                ))}
              </div>
              <span className="font-sans text-[10px] uppercase tracking-widest text-foreground/40">
                Sala {salasRecorridas}/{SALAS_POR_DESCANSO}
              </span>
            </div>
          )}

          {/* Acciones globales */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {enProgreso && (
              <>
                <button
                  type="button"
                  onClick={handleAvanzarSala}
                  disabled={advancing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B7355]/50 px-3 py-1.5 font-sans text-xs text-foreground/70 transition-all hover:border-gold/60 hover:text-gold active:scale-95 disabled:opacity-40"
                >
                  {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DoorOpen className="h-3.5 w-3.5" />}
                  Avanzar sala
                </button>
                <button
                  type="button"
                  onClick={() => setRestModalOpen(true)}
                  disabled={participantesActivos.length === 0}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-sans text-xs transition-all active:scale-95 disabled:opacity-40 ${
                    tocaDescanso
                      ? "border-amber-500/60 bg-amber-900/25 text-amber-200 shadow-[0_0_16px_-4px_rgba(245,158,11,0.6)]"
                      : "border-emerald-600/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/30"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  {tocaDescanso ? "Toca descansar" : "Descansar"}
                </button>
              </>
            )}
            {partida.estado === "abierta" ? (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={startingGame}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-900/25 px-3 py-1.5 font-sans text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-900/50 active:scale-95 disabled:opacity-60"
              >
                {startingGame ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {startingGame ? "Iniciando..." : "Iniciar partida"}
              </button>
            ) : (
              <button
                type="button"
                onClick={openCloseModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/25 px-3 py-1.5 font-sans text-xs text-rose-300 transition-all hover:bg-rose-900/40 active:scale-95"
              >
                <Flag className="h-3.5 w-3.5" />
                Cerrar partida
              </button>
            )}
          </div>
        </div>

        {tocaDescanso && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2.5 rounded-lg border border-amber-600/40 bg-amber-900/15 px-3 py-1.5 font-sans text-[11px] leading-relaxed text-amber-200"
          >
            El grupo lleva {salasRecorridas} salas sin descansar: el descanso es obligatorio
            antes de seguir.
          </motion.p>
        )}
      </div>

      {/* ─── 2. Tira de personajes ─────────────────────────────────────────── */}
      <div className={`${cardCls} p-2.5`}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {participantes.map((p) => {
            const activo = selectedPersonajeId === p.personajeId;
            const fuera = p.muerto || p.derrotado;
            const tropas = totalTropas(p.ejercito);
            return (
              <button
                key={p.personajeId}
                type="button"
                onClick={() => setSelectedPersonajeId(p.personajeId)}
                disabled={fuera}
                className={`group relative flex min-w-[9.5rem] shrink-0 flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed ${
                  activo
                    ? "border-gold bg-gold/10"
                    : fuera
                      ? "border-red-900/40 bg-red-950/10 opacity-50"
                      : "border-[#3a3020] bg-black/25 hover:border-[#8B7355]"
                }`}
              >
                {activo && (
                  <motion.span
                    layoutId="dm-personaje-activo"
                    transition={{ duration: 0.35, ease: EASE }}
                    className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-gold/70"
                    style={{ boxShadow: "0 0 22px -8px #D4AF37" }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-serif text-[11px] ${
                      activo ? "border-gold/70 text-gold" : "border-[#8B7355]/50 text-foreground/50"
                    }`}
                  >
                    {fuera ? <Skull className="h-3 w-3 text-red-500" /> : p.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span
                    className={`truncate font-sans text-xs ${
                      activo ? "text-gold" : "text-foreground/70"
                    } ${fuera ? "line-through decoration-red-800/60" : ""}`}
                  >
                    {p.nombre}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-sans text-[10px] text-foreground/40">
                  {p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" animated={false} />}
                  {p.cansancio > 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 tabular-nums ${
                        p.cansancio >= MAX_CANSANCIO - 2 ? "text-red-400" : "text-amber-300/80"
                      }`}
                    >
                      <Zap className="h-2.5 w-2.5" />
                      {p.cansancio}
                    </span>
                  )}
                  {tropas > 0 && (
                    <span className="inline-flex items-center gap-0.5 tabular-nums text-foreground/45">
                      <Users className="h-2.5 w-2.5" />
                      {tropas}
                    </span>
                  )}
                  {p.caidas === 0 && p.cansancio === 0 && tropas === 0 && (
                    <span className="italic text-foreground/25">Sin novedad</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 3. Acciones + feed ────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex flex-col gap-3 lg:w-[27rem] lg:shrink-0">
          <div className={`${cardCls} flex min-h-0 flex-col overflow-hidden`}>
            {/* Pestañas */}
            <div className="flex border-b border-[#8B7355]/25">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 font-sans text-[11px] transition-colors ${
                    tab === key ? "text-gold" : "text-foreground/45 hover:text-foreground/70"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {tab === key && (
                    <motion.span
                      layoutId="dm-tab-underline"
                      transition={{ duration: 0.35, ease: EASE }}
                      className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {!enProgreso ? (
                <p className="py-8 text-center font-sans text-xs italic text-foreground/30">
                  Inicia la partida para activar el puesto de mando.
                </p>
              ) : !selectedParticipante ? (
                <p className="py-8 text-center font-sans text-xs italic text-rose-400/70">
                  Selecciona un personaje en la tira de arriba.
                </p>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    {/* ── Dados ── */}
                    {tab === "dados" && (
                      <DiceModule
                        token={token}
                        rollApiUrl={rollApiUrl}
                        extraBody={extraBody}
                        hideCost
                        personajeNombre={selectedParticipante.nombre}
                        onRollComplete={handleRollComplete}
                      />
                    )}

                    {/* ── Botín ── */}
                    {tab === "botin" && (
                      <div className="space-y-3">
                        <div className="flex gap-1.5">
                          {(["item", "oro"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAssignTab(t)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-sans text-xs transition-all ${
                                assignTab === t
                                  ? "border-gold bg-gold/10 text-gold"
                                  : "border-[#3a3020] text-foreground/50 hover:border-[#8B7355]"
                              }`}
                            >
                              {t === "item" ? <Package className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
                              {t === "item" ? "Ítem" : "Oro"}
                            </button>
                          ))}
                        </div>

                        {assignTab === "item" ? (
                          <div className="space-y-2">
                            {loadingObjects ? (
                              <div className="flex items-center gap-2 text-xs text-foreground/40">
                                <Loader2 className="h-3 w-3 animate-spin" /> Cargando catálogo...
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
                              <label className="shrink-0 font-sans text-[11px] text-foreground/50">Cant:</label>
                              <input
                                type="number"
                                min="1"
                                max="99"
                                value={cantidad}
                                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 rounded border border-border bg-background px-2 py-1 text-xs focus:border-gold/60 focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            placeholder="Cantidad de oro"
                            value={oroDelta}
                            onChange={(e) => setOroDelta(e.target.value)}
                            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs focus:border-gold/60 focus:outline-none"
                          />
                        )}

                        <button
                          type="button"
                          onClick={handleAsignar}
                          disabled={assigning}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 font-sans text-xs font-semibold text-gold transition-all hover:bg-gold/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {assigning && <Loader2 className="h-3 w-3 animate-spin" />}
                          Entregar a {selectedParticipante.nombre}
                        </button>

                        <p className="font-sans text-[10px] leading-relaxed text-foreground/30">
                          Las unidades de ejército no se reparten como botín: se compran en la
                          tienda y van a sus propias casillas.
                        </p>
                      </div>
                    )}

                    {/* ── Estado ── */}
                    {tab === "estado" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-900/30 bg-black/25 px-3 py-2.5">
                          <CaidasTracker caidas={selectedParticipante.caidas} size="md" showLabel />
                          {selectedParticipante.derrotado && (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] uppercase tracking-widest text-red-400">
                              <Skull className="h-3 w-3" /> Derrotado
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCaida(selectedParticipante.personajeId, -1)}
                            disabled={caidasLoading !== null || selectedParticipante.caidas <= 0}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 font-sans text-[11px] text-foreground/60 transition-all hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {caidasLoading === -1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />}
                            Quitar caída
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCaida(selectedParticipante.personajeId, 1)}
                            disabled={caidasLoading !== null || selectedParticipante.caidas >= MAX_CAIDAS}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/50 bg-red-900/20 px-2 py-2 font-sans text-[11px] text-red-300 transition-all hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {caidasLoading === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Marcar caída
                          </button>
                        </div>

                        <p className="font-sans text-[10px] leading-relaxed text-foreground/40">
                          A la {MAX_CAIDAS}.ª caída pierde la expedición, se retira al Nexo y carga
                          +{CANSANCIO_POR_DERROTA} punto de cansancio. Solo un descanso largo restaura
                          las caídas.
                        </p>

                        <div
                          className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/30 bg-black/25 px-3 py-2.5"
                          title={EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, selectedParticipante.cansancio)]}
                        >
                          <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest text-foreground/50">
                            <Zap
                              className={`h-3 w-3 ${
                                selectedParticipante.cansancio >= MAX_CANSANCIO - 2
                                  ? "text-red-500"
                                  : "text-amber-400/80"
                              }`}
                            />
                            Cansancio
                          </span>
                          <span
                            className={`font-sans text-xs font-semibold tabular-nums ${
                              selectedParticipante.cansancio >= MAX_CANSANCIO - 2
                                ? "text-red-400"
                                : "text-amber-300/90"
                            }`}
                          >
                            {selectedParticipante.cansancio}/{MAX_CANSANCIO}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCansancio(selectedParticipante.personajeId, -1)}
                            disabled={cansancioLoading !== null || selectedParticipante.cansancio <= 0}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 font-sans text-[11px] text-foreground/60 transition-all hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {cansancioLoading === -1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />}
                            Aliviar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCansancio(selectedParticipante.personajeId, 1)}
                            disabled={cansancioLoading !== null || selectedParticipante.cansancio >= MAX_CANSANCIO}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-900/20 px-2 py-2 font-sans text-[11px] text-amber-300 transition-all hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {cansancioLoading === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Agotar
                          </button>
                        </div>

                        {/* Desmembramiento */}
                        <div className="space-y-2 border-t border-rose-900/25 pt-3">
                          <p className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest text-rose-400/70">
                            <Scissors className="h-3 w-3" /> Desmembramiento
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {LIMBS.map(({ key, label }) => {
                              const pid = selectedParticipante.personajeId;
                              const isDismembered = extremidades[pid]?.[key] === false;
                              const loadKey = `${pid}-${key}`;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleDismember(pid, key, label, isDismembered)}
                                  disabled={dismembering === loadKey}
                                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 font-sans text-[11px] transition-all disabled:opacity-60 ${
                                    isDismembered
                                      ? "border-rose-500/60 bg-rose-900/30 text-rose-300"
                                      : "border-border text-foreground/50 hover:border-rose-500/40 hover:text-rose-300/70"
                                  }`}
                                >
                                  {dismembering === loadKey ? (
                                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                  ) : isDismembered ? (
                                    <Scissors className="h-3 w-3 shrink-0 text-rose-400" />
                                  ) : (
                                    <span className="shrink-0 text-[10px]">○</span>
                                  )}
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Ejército ── */}
                    {tab === "ejercito" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-sans text-[10px] uppercase tracking-widest text-foreground/45">
                            Regimientos de {selectedParticipante.nombre}
                          </p>
                          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gold tabular-nums">
                            <Users className="h-3 w-3 opacity-70" />
                            {totalTropas(selectedParticipante.ejercito).toLocaleString("es-ES")}
                          </span>
                        </div>

                        {selectedParticipante.ejercito.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[#3a3020] py-8 text-center font-sans text-xs italic text-foreground/30">
                            No comanda tropas en esta expedición.
                          </p>
                        ) : (
                          <>
                            <EjercitoGrid
                              unidades={selectedParticipante.ejercito}
                              seleccionable
                              unidadSeleccionadaId={unidadActual?.id ?? null}
                              onSelect={(u) => {
                                setUnidadSeleccionadaId(u.id);
                                setBajas(1);
                              }}
                              compacto
                            />

                            <AnimatePresence>
                              {unidadActual && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3, ease: EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2.5 rounded-lg border border-rose-900/40 bg-rose-950/10 p-3">
                                    <p className="flex items-center gap-1.5 font-sans text-[11px] text-foreground/70">
                                      {getIconForString(unidadActual.nombre, "w-3.5 h-3.5 shrink-0", unidadActual.icono)}
                                      <span className="font-semibold text-[#e8d8b0]">{unidadActual.nombre}</span>
                                      <span className="text-foreground/40">· {unidadActual.cantidad} en pie</span>
                                    </p>

                                    <div className="flex items-center gap-2">
                                      <label className="shrink-0 font-sans text-[11px] text-foreground/50">
                                        Bajas:
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={unidadActual.cantidad}
                                        value={bajas}
                                        onChange={(e) =>
                                          setBajas(
                                            Math.min(
                                              unidadActual.cantidad,
                                              Math.max(1, parseInt(e.target.value) || 1),
                                            ),
                                          )
                                        }
                                        className="w-20 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums focus:border-rose-500/60 focus:outline-none"
                                      />
                                      <span className="font-sans text-[10px] text-foreground/35">
                                        de {unidadActual.cantidad}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => aplicarBajas(false)}
                                        disabled={aplicandoBajas}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-900/20 px-2 py-2 font-sans text-[11px] text-rose-300 transition-all hover:bg-rose-900/40 disabled:opacity-50"
                                      >
                                        {aplicandoBajas ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Minus className="h-3 w-3" />
                                        )}
                                        Aplicar bajas
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => aplicarBajas(true)}
                                        disabled={aplicandoBajas}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-red-600/60 bg-red-950/40 px-2 py-2 font-sans text-[11px] font-semibold text-red-300 transition-all hover:bg-red-900/50 disabled:opacity-50"
                                      >
                                        <Skull className="h-3 w-3" />
                                        Aniquilar
                                      </button>
                                    </div>

                                    <p className="font-sans text-[10px] leading-relaxed text-foreground/35">
                                      Las bajas se descuentan del inventario del jugador al instante;
                                      si el regimiento cae entero, libera su casilla.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>

          <NotasWidget token={token} />
        </div>

        {/* Feed en vivo */}
        <div className={`${cardCls} max-h-[65vh] min-h-[18rem] flex-1 overflow-hidden p-3 lg:max-h-none lg:min-h-0`}>
          <SalaFeed eventos={eventos} />
        </div>
      </div>

      {/* ─── Modal de cierre ───────────────────────────────────────────────── */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-lg font-bold text-gold">Cerrar partida: {partida.titulo}</h2>
              <button
                onClick={() => setCloseModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
              <p className="text-sm text-muted-foreground">
                Asigna recompensas finales por personaje antes de cerrar la partida.
              </p>

              {loadingObjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gold" />
                </div>
              ) : (
                participantes.map((p) => {
                  const r = closeRewards[p.personajeId] ?? { gold: 0, levelUps: 0, items: [] };
                  return (
                    <div key={p.personajeId} className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{p.nombre}</p>
                        {p.derrotado && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-900/20 px-2 py-0.5 font-sans text-[10px] uppercase tracking-widest text-red-400">
                            <Skull className="h-3 w-3" /> Derrotado
                          </span>
                        )}
                        {!p.derrotado && p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" />}
                      </div>

                      {(() => {
                        const { oroTotal, items } = buildSessionSummary(p.personajeId);
                        const hasAnything = oroTotal > 0 || items.length > 0;
                        return (
                          <div className="flex flex-col gap-1.5 rounded border border-gold-dim/20 bg-black/20 p-2.5">
                            <p className="font-sans text-[10px] uppercase tracking-widest text-foreground/40">
                              Recibido en la sesión
                            </p>
                            {!hasAnything ? (
                              <p className="font-sans text-xs italic text-foreground/30">
                                Sin asignaciones en esta sesión
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {oroTotal > 0 && (
                                  <span className="font-sans text-xs font-semibold text-gold">
                                    +{oroTotal.toLocaleString("es-ES")} oro
                                  </span>
                                )}
                                {items.map((item) => (
                                  <span key={item.id} className="flex items-center gap-1.5 font-sans text-xs font-semibold text-green-400">
                                    {getIconForString(item.nombre, "w-3.5 h-3.5 shrink-0", item.icono)} {item.nombre}
                                    {item.qty > 1 ? ` ×${item.qty}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                              updateCloseReward(p.personajeId, {
                                levelUps: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Objetos</p>
                          <button
                            type="button"
                            onClick={() => addCloseItem(p.personajeId)}
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Agregar objeto
                          </button>
                        </div>

                        {r.items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin objetos</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {r.items.map((item) => (
                              <div key={item.id} className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
                                    updateCloseItem(p.personajeId, item.id, {
                                      qty: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => removeCloseItem(p.personajeId, item.id)}
                                  className="rounded border border-border px-3 py-2 text-xs hover:bg-muted"
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
                className="rounded border border-border bg-secondary px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitClose}
                disabled={closingGame}
                className="flex items-center gap-2 rounded bg-destructive/80 px-4 py-2 text-sm font-semibold text-white hover:bg-destructive disabled:opacity-60"
              >
                {closingGame && <Loader2 className="h-4 w-4 animate-spin" />}
                {closingGame ? "Cerrando..." : "Cerrar y guardar recompensas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de descanso ─────────────────────────────────────────────── */}
      {restModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-300">
                <Moon className="h-5 w-5" /> Descanso
              </h2>
              <button
                onClick={() => setRestModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
              <p className="text-sm text-muted-foreground">
                Cada descanso consume 1 ración por personaje activo; quien no tenga ración no se
                recupera y gana +1 de cansancio. Los muertos o derrotados ya abandonaron la
                expedición y no se ven afectados.
              </p>

              <button
                type="button"
                onClick={() => handleDescanso("corto")}
                disabled={resting}
                className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-3.5 text-left transition-all hover:border-emerald-600/50 hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="text-sm font-semibold text-emerald-300">Descanso corto</p>
                <p className="mt-0.5 font-sans text-[11px] text-foreground/50">
                  Un respiro junto al camino: cura 1 caída. Sin límite por expedición.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDescanso("largo")}
                disabled={resting || yaDescansaron}
                className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-3.5 text-left transition-all hover:border-emerald-600/50 hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="text-sm font-semibold text-emerald-300">Descanso largo</p>
                <p className="mt-0.5 font-sans text-[11px] text-foreground/50">
                  Acampar toda la noche: requiere 1 tienda de acampar del grupo. Caídas a 0,
                  −1 nivel de cansancio y todos los conjuros gastados vuelven. Solo uno por
                  expedición.
                  {yaDescansaron && (
                    <span className="mt-0.5 block italic text-foreground/35">
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
                      <p className="truncate text-sm font-semibold text-foreground">{p.nombre}</p>
                      <div className="flex shrink-0 items-center gap-3">
                        {p.cansancio > 0 && (
                          <span className="inline-flex items-center gap-1 font-sans text-xs text-amber-300/90">
                            <Zap className="h-3 w-3 text-amber-400/80" />
                            {p.cansancio}/{MAX_CANSANCIO}
                          </span>
                        )}
                        {p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" animated={false} />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-xs italic text-foreground/40">
                  Nadie acumula caídas ni cansancio; el grupo descansa igualmente.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border p-5">
              {resting && (
                <span className="mr-auto inline-flex items-center gap-2 font-sans text-sm text-emerald-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Descansando...
                </span>
              )}
              <button
                type="button"
                onClick={() => setRestModalOpen(false)}
                disabled={resting}
                className="rounded border border-border bg-secondary px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
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
