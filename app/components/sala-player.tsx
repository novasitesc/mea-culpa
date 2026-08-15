"use client";

// Vista del jugador dentro de la sala, hermana de sala-dm.tsx: su personaje y
// su estado a la izquierda (caídas, cansancio, tropas y acciones), el feed en
// vivo a la derecha. Comparte lenguaje visual con el puesto de mando del DM
// para que jugador y DM lean la misma partida de la misma forma.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Skull, Moon, Zap, Sparkles, Users, Swords, Shield } from "lucide-react";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO } from "@/lib/caidas";
import SalaFeed from "@/app/components/sala-feed";
import ConsumableModal from "@/app/components/consumable-modal";
import SpellCastModal from "@/app/components/spell-cast-modal";
import CaidasTracker from "@/app/components/caidas-tracker";
import EjercitoGrid from "@/app/components/ejercito-grid";
import { totalTropas } from "@/lib/ejercito";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";

type Props = {
  partida: SalaPartida;
  participantes: SalaParticipante[];
  eventos: SalaEvento[];
  token: string | null;
  usuarioId: string | null;
  onEvent: (ev: SalaEvento) => void;
};

const EASE = [0.16, 1, 0.3, 1] as const;
const cardCls = "rounded-xl border border-[#8B7355]/40 bg-gradient-to-b from-card to-[#100e0b]";

export default function SalaPlayer({ partida, participantes, eventos, token, usuarioId, onEvent }: Props) {
  const tierRoman =
    ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][partida.tier] ?? partida.tier;

  const [consumablesOpen, setConsumablesOpen] = useState(false);
  const [spellsOpen, setSpellsOpen] = useState(false);

  const me = usuarioId ? participantes.find((p) => p.usuarioId === usuarioId) ?? null : null;
  // Mismo gate para consumibles y conjuros: solo actúa quien sigue en pie.
  const canAct = partida.estado === "en_progreso" && me != null && !me.muerto && !me.derrotado;
  const tropas = me ? totalTropas(me.ejercito) : 0;
  const companeros = participantes.filter((p) => p.personajeId !== me?.personajeId);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ─── Cabecera de expedición ────────────────────────────────────────── */}
      <div className={`${cardCls} relative overflow-hidden px-4 py-3`}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-sans text-[11px] uppercase tracking-widest text-gold">
            Tier {tierRoman}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-sans text-[11px] uppercase tracking-widest text-foreground/60">
            Piso {partida.piso}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-[11px] uppercase tracking-widest ${
              partida.estado === "en_progreso"
                ? "border-emerald-600/40 bg-emerald-950/20 text-emerald-300"
                : "border-amber-600/40 bg-amber-950/20 text-amber-300"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {partida.estado === "en_progreso" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  partida.estado === "en_progreso" ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
            </span>
            {partida.estado === "en_progreso" ? "En curso" : "Esperando al DM"}
          </span>

          {canAct && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("seccion-ejercito-player");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-950/25 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-widest text-amber-300 transition-all hover:bg-amber-900/40 active:scale-95"
              >
                <Swords className="h-3.5 w-3.5" />
                Ejército ({tropas})
              </button>
              <button
                type="button"
                onClick={() => setSpellsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-widest text-gold transition-all hover:bg-gold/30 active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Conjuros
              </button>
              <button
                type="button"
                onClick={() => setConsumablesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-widest text-gold transition-all hover:bg-gold/30 active:scale-95"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Consumibles
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* ─── Columna del personaje ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3 lg:w-[27rem] lg:shrink-0">
          {me && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className={`${cardCls} p-4`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/50 font-serif text-base text-gold">
                  {me.muerto || me.derrotado ? (
                    <Skull className="h-5 w-5 text-red-500" />
                  ) : (
                    me.nombre.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                    Tu personaje
                  </p>
                  <h2 className="truncate font-serif text-lg leading-tight text-[#D4AF37]">
                    {me.nombre}
                  </h2>
                </div>
              </div>

              {/* Caídas */}
              <div className="mt-3.5 flex items-center justify-between gap-2 rounded-lg border border-red-900/30 bg-black/25 px-3 py-2.5">
                <CaidasTracker caidas={me.caidas} size="md" showLabel />
                <span className="font-sans text-[10px] uppercase tracking-widest text-foreground/35 tabular-nums">
                  {me.caidas}/{MAX_CAIDAS}
                </span>
              </div>

              {/* Cansancio */}
              <div
                className="mt-2 rounded-lg border border-amber-900/30 bg-black/25 px-3 py-2.5"
                title={EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, me.cansancio)]}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest text-foreground/50">
                    <Zap
                      className={`h-3 w-3 ${
                        me.cansancio >= MAX_CANSANCIO - 2 ? "text-red-500" : "text-amber-400/80"
                      }`}
                    />
                    Cansancio
                  </span>
                  <span
                    className={`font-sans text-xs font-semibold tabular-nums ${
                      me.cansancio >= MAX_CANSANCIO - 2 ? "text-red-400" : "text-amber-300/90"
                    }`}
                  >
                    {me.cansancio}/{MAX_CANSANCIO}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    initial={false}
                    animate={{ width: `${(me.cansancio / MAX_CANSANCIO) * 100}%` }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className={`h-full rounded-full ${
                      me.cansancio >= MAX_CANSANCIO - 2 ? "bg-red-500" : "bg-amber-400/80"
                    }`}
                  />
                </div>
                {me.cansancio > 0 && (
                  <p className="mt-1.5 font-sans text-[10px] leading-relaxed text-foreground/35">
                    {EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, me.cansancio)]}
                  </p>
                )}
              </div>

              {/* Derrota */}
              <AnimatePresence>
                {me.derrotado && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 rounded-lg border border-red-900/50 bg-gradient-to-r from-red-950/40 via-black/40 to-red-950/40 p-3">
                      <Skull className="cd-token-doom h-6 w-6 shrink-0 rounded-full text-red-500" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-red-300">
                          Derrotado — de vuelta al Nexo
                        </p>
                        <p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 font-sans text-[11px] text-foreground/50">
                          Perdiste la expedición y cargas puntos de cansancio.
                          <span className="inline-flex items-center gap-1">
                            <Moon className="h-3 w-3 text-gold/70" /> Un descanso largo restaurará
                            tus caídas.
                          </span>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ─── Ejército (siempre visible para el jugador) ────────────────── */}
          {me && (
            <motion.div
              id="seccion-ejercito-player"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: EASE }}
              className={`${cardCls} p-4`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                  <Swords className="h-3 w-3 text-amber-400" /> Tu ejército
                </p>
                <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gold tabular-nums">
                  <Users className="h-3 w-3 opacity-70" />
                  {tropas.toLocaleString("es-ES")} soldados
                </span>
              </div>
              <EjercitoGrid unidades={me.ejercito ?? []} compacto />
              <p className="mt-2.5 flex items-start gap-1.5 font-sans text-[10px] leading-relaxed text-foreground/30">
                <Shield className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                {me.ejercito && me.ejercito.length > 0
                  ? "El DM retira las unidades que caen en batalla; lo que sobrevive vuelve contigo al Nexo."
                  : "Sin regimientos en marcha. Puedes reclutar tropas si el DM abre una tienda durante la expedición."}
              </p>
            </motion.div>
          )}

          {/* ─── Compañeros ────────────────────────────────────────────────── */}
          {companeros.length > 0 && (
            <div className={`${cardCls} p-3.5`}>
              <p className="mb-2.5 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                Compañeros de expedición
              </p>
              <div className="flex flex-col gap-1.5">
                {companeros.map((p) => {
                  const fuera = p.muerto || p.derrotado;
                  return (
                    <div
                      key={p.personajeId}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                        fuera
                          ? "border-red-900/40 bg-red-950/15"
                          : "border-[#3a3020] bg-black/25"
                      }`}
                    >
                      <span
                        className={`inline-flex min-w-0 items-center gap-1.5 font-sans text-[11px] ${
                          fuera
                            ? "text-foreground/35 line-through decoration-red-800/60"
                            : "text-foreground/70"
                        }`}
                      >
                        {fuera && <Skull className="h-3 w-3 shrink-0 text-red-600" />}
                        <span className="truncate">{p.nombre}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 font-sans text-[10px] text-foreground/40">
                        {p.caidas > 0 && <CaidasTracker caidas={p.caidas} size="sm" animated={false} />}
                        {p.cansancio > 0 && (
                          <span className="inline-flex items-center gap-0.5 tabular-nums text-amber-300/70">
                            <Zap className="h-2.5 w-2.5" />
                            {p.cansancio}
                          </span>
                        )}
                        {totalTropas(p.ejercito) > 0 && (
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Users className="h-2.5 w-2.5" />
                            {totalTropas(p.ejercito)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Feed ────────────────────────────────────────────────────────── */}
        <div className={`${cardCls} max-h-[65vh] min-h-[18rem] flex-1 overflow-hidden p-4 lg:max-h-none lg:min-h-0`}>
          {partida.estado === "abierta" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold-dim/30"
              >
                <span className="text-lg">⏳</span>
              </motion.div>
              <p className="font-sans text-sm text-foreground/50">
                Esperando al DM para iniciar la partida...
              </p>
            </div>
          ) : (
            <SalaFeed eventos={eventos} />
          )}
        </div>
      </div>

      {consumablesOpen && (
        <ConsumableModal
          partidaId={partida.id}
          token={token}
          onClose={() => setConsumablesOpen(false)}
          onUsed={onEvent}
        />
      )}

      {spellsOpen && (
        <SpellCastModal
          partidaId={partida.id}
          token={token}
          onClose={() => setSpellsOpen(false)}
          onCast={onEvent}
        />
      )}
    </div>
  );
}
