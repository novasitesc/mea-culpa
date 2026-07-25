"use client";

// Botón "Forjar partida" (solo DM / SuperAdmin) + modal de creación.
//
// SEGURIDAD: `isAdmin` aquí solo decide si se DIBUJA el botón — no es una barrera.
// La barrera real es el servidor: POST /api/admin/partidas pasa por requireAdmin
// (es_admin), así que un usuario normal recibe 403 aunque fuerce esta UI. No se
// crea ningún endpoint nuevo: reutilizamos el ya protegido del panel de admin.
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Crown, X, Loader2 } from "lucide-react";
import ModalPortal from "@/components/ui/modal-portal";

type Variant = "info" | "success" | "warning" | "error";

type Props = {
  token: string;
  isAdmin: boolean;
  onCreated: () => void | Promise<unknown>;
  showAlert: (title: string, message: string, variant: Variant) => void;
};

/** "YYYY-MM-DDTHH:mm" en hora local, para el min del datetime-local. */
function nowLocalMin(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function CreatePartidaButton({ token, isAdmin, onCreated, showAlert }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [floor, setFloor] = useState(1);
  const [tier, setTier] = useState(1);
  const [startTime, setStartTime] = useState("");
  const minStart = useMemo(() => nowLocalMin(), [open]);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Defensa en profundidad en el cliente: si no es DM/SuperAdmin, no hay botón.
  // (El backend rechaza igualmente a cualquiera que no sea es_admin.)
  if (!isAdmin) return null;

  const reset = () => {
    setTitle("");
    setComment("");
    setMaxPlayers(6);
    setFloor(1);
    setTier(1);
    setStartTime("");
    setError("");
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setError("El nombre de la partida es obligatorio.");
    if (!startTime) return setError("Indica la fecha y hora de inicio.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/partidas", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          comment: comment.trim(),
          playerLimit: maxPlayers,
          floor,
          tier,
          startTime,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la partida.");

      setOpen(false);
      reset();
      showAlert("Partida forjada", `«${trimmedTitle}» está lista para reclutar héroes.`, "success");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la partida.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Botón dinámico y fantasioso: aura pulsante, brillo que barre y brasas. */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border border-[#f6dd8a]/60 bg-gradient-to-r from-[#f5d67b] via-[#D4AF37] to-[#a9791f] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-[#20180a] shadow-[0_10px_30px_-10px_rgba(212,175,55,0.8)]"
        aria-haspopup="dialog"
      >
        {/* Aura pulsante detrás */}
        <span
          aria-hidden
          className="asc-pulse-glow pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-[radial-gradient(circle,_rgba(245,214,123,0.75),_transparent_70%)] blur-md"
        />
        {/* Brillo diagonal que barre en bucle */}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="asc-shine absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </span>
        {/* Brasas que suben */}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="asc-ember" style={{ left: "22%", animationDelay: "0s" }} />
          <span className="asc-ember" style={{ left: "55%", animationDelay: "1.6s" }} />
          <span className="asc-ember" style={{ left: "80%", animationDelay: "3.1s" }} />
        </span>
        <Wand2 className="relative w-4 h-4 transition-transform group-hover:-rotate-12" />
        <span className="relative">Forjar partida</span>
        <Crown className="relative w-4 h-4 opacity-80" />
      </motion.button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Forjar nueva partida"
            onPointerDown={close}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onPointerDown={(e) => e.stopPropagation()}
              onAnimationComplete={() => firstFieldRef.current?.focus()}
              className="relative w-full max-w-md overflow-hidden rounded-[1.5rem] border border-[#5f4b2f] bg-[#0d0b07]/98 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.9)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.1),_transparent_45%)] pointer-events-none" />

              <div className="relative flex items-center justify-between gap-3 border-b border-[#4c3d1f]/50 px-5 py-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80">Mesa del DM</p>
                  <h2 className="flex items-center gap-2 text-lg font-serif text-[#F5E6B8]">
                    <Wand2 className="w-5 h-5 text-[#D4AF37]" /> Forjar nueva partida
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-[#6b531f]/60 p-1.5 text-[#c8b78e] transition hover:bg-[#2a2318]"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative space-y-3.5 px-5 py-5">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-[#b99d42]/80">
                    Nombre de la partida
                  </span>
                  <input
                    ref={firstFieldRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="La cripta del rey caído"
                    className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#D4AF37]/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-[#b99d42]/80">
                    Descripción <span className="text-[#6b6152]">(opcional)</span>
                  </span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder="Tono, requisitos, botín esperado…"
                    className="w-full resize-none rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#D4AF37]/60"
                  />
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] uppercase tracking-[0.25em] text-[#b99d42]/80">
                      Jugadores
                    </span>
                    <select
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none focus:border-[#D4AF37]/60"
                    >
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] uppercase tracking-[0.25em] text-[#b99d42]/80">
                      Piso
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={floor}
                      onChange={(e) =>
                        setFloor(Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))))
                      }
                      className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none focus:border-[#D4AF37]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] uppercase tracking-[0.25em] text-[#b99d42]/80">
                      Tier
                    </span>
                    <select
                      value={tier}
                      onChange={(e) => setTier(Number(e.target.value))}
                      className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none focus:border-[#D4AF37]/60"
                    >
                      <option value={1}>I</option>
                      <option value={2}>II</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-[#b99d42]/80">
                    Inicio
                  </span>
                  <input
                    type="datetime-local"
                    min={minStart}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#D4AF37]/60 [color-scheme:dark]"
                  />
                </label>

                {error && (
                  <p className="rounded-2xl border border-rose-500/30 bg-[#2b1814] px-3 py-2 text-xs text-rose-200">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    disabled={saving}
                    className="rounded-2xl border border-[#453b28] px-4 py-2 text-xs uppercase tracking-[0.15em] text-[#c8b78e] transition hover:bg-[#1c1912] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#f5d67b] via-[#D4AF37] to-[#a9791f] px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#20180a] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Forjando…
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" /> Forjar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
