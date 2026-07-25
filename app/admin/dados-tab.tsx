"use client";

// Pestaña de dados del panel: editor de las tablas de recompensas — las 20
// caras del d20, las sub-tablas anidadas y las sublistas.
// Es lo que configura al motor de dados (lib/dice/engine.ts).

import ModalPortal from "@/components/ui/modal-portal";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Pencil, Loader2, Check, X, Dices, Dice6, GripVertical } from "lucide-react";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { Select } from "@/components/ui/select";
import ConfirmActionModal from "@/components/ui/confirm-action-modal";
import { modalOverlayCls, modalPanelCls, MODAL_EXIT_MS } from "@/lib/useModalTransition";
import { DICE_TYPES, REWARD_TYPES } from "@/lib/types/dados";
import { TIPO_EJERCITO } from "@/lib/ejercito";
import type { DiceType, RewardType, LutCaraTipo } from "@/lib/types/dados";
import DiceVisual from "@/app/components/dice-visual";
import DiceModule from "@/app/components/dice-module";
import { AdmHero, AdmPanel } from "./section-ui";

const ACCENT = "#d4af37";

type AdminObject = {
  id: number;
  name: string;
  icon: string;
  itemType: string;
  rarity: string;
};

type SublistaFormItem = {
  objetoId: number | null;
};

type LutCaraForm = {
  numeroCara: number;
  tipo: LutCaraTipo;
  oroMin: string;
  oroMax: string;
  objetoId: number | null;
  cantidadMin: string;
  cantidadMax: string;
  subtablaId: number | null;
};

type SubtablaCaraTipo = "nada" | "item" | "oro";

type SubtablaCaraForm = {
  numeroCara: number;
  tipo: SubtablaCaraTipo;
  objetoId: number | null;
  cantidadMin: string;
  cantidadMax: string;
  oroMin: string;
  oroMax: string;
};

type RecompensaFull = {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo: RewardType;
  tipoDado: DiceType;
  costoOro: number;
  activo: boolean;
  orden: number;
  objetoId: number | null;
  objetoNombre: string | null;
  objetoIcono: string | null;
  cantidadDados: number;
  multiplicadorOro: number;
  sublistaItems: Array<{
    id: number;
    objetoId: number;
    objetoNombre: string;
    objetoIcono: string;
    valorMin: number;
    valorMax: number;
    orden: number;
  }>;
  lutCaras?: Array<{
    id: number;
    numeroCara: number;
    tipo: LutCaraTipo;
    oroMin: number;
    oroMax: number;
    objetoId: number | null;
    cantidadMin: number;
    cantidadMax: number;
    subtablaId: number | null;
  }>;
  subtablaCaras?: Array<{
    id: number;
    numeroCara: number;
    tipo: SubtablaCaraTipo;
    objetoId: number | null;
    cantidadMin: number;
    cantidadMax: number;
    oroMin: number;
    oroMax: number;
  }>;
};

const TIPO_LABEL: Record<RewardType, string> = {
  item_fijo: "Ítem garantizado",
  sublista: "Tabla de ítems (sublista)",
  oro_dados: "Oro por dados",
  lut: "LUT — D20 por caras",
  subtabla: "Sub-tabla D20",
};

const DICE_FACES: Record<DiceType, number> = {
  d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20,
};

function makeEmptySublistaItems(tipoDado: DiceType): SublistaFormItem[] {
  return Array.from({ length: DICE_FACES[tipoDado] }, () => ({ objetoId: null }));
}

function makeEmptyLutCaras(): LutCaraForm[] {
  return Array.from({ length: 20 }, (_, i) => ({
    numeroCara: i + 1,
    tipo: "nada" as LutCaraTipo,
    oroMin: "10",
    oroMax: "50",
    objetoId: null,
    cantidadMin: "1",
    cantidadMax: "1",
    subtablaId: null,
  }));
}

function makeEmptySubtablaCaras(): SubtablaCaraForm[] {
  return Array.from({ length: 20 }, (_, i) => ({
    numeroCara: i + 1,
    tipo: "nada" as SubtablaCaraTipo,
    objetoId: null,
    cantidadMin: "1",
    cantidadMax: "1",
    oroMin: "10",
    oroMax: "50",
  }));
}

const emptyForm = {
  nombre: "",
  descripcion: "",
  tipo: "lut" as RewardType,
  tipoDado: "d6" as DiceType,
  costoOro: "0",
  activo: true,
  orden: "0",
  objetoId: null as number | null,
  cantidadDados: "1",
  multiplicadorOro: "10",
  sublistaItems: [] as SublistaFormItem[],
  lutCaras: makeEmptyLutCaras(),
  subtablaCaras: makeEmptySubtablaCaras(),
};

export function DadosTab({ token }: { token: string | null }) {
  const [recompensas, setRecompensas] = useState<RecompensaFull[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editClosing, setEditClosing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<RecompensaFull | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const fetches: Promise<Response>[] = [
        fetch("/api/dados/admin", { headers: headers() }),
        fetch("/api/admin/objetos", { headers: headers() }),
      ];
      const [rRes, oRes] = await Promise.all(fetches);
      if (rRes.ok) {
        const d = await rRes.json();
        setRecompensas(d.recompensas ?? []);
      }
      if (oRes.ok) {
        const d = await oRes.json();
        setObjects(Array.isArray(d) ? d : (d.objects ?? d.objetos ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Las unidades de ejército no pueden salir en un dado: solo se compran en
  // tienda y viven fuera de la bolsa (lib/ejercito.ts).
  const objectSelectorItems: ObjectSelectorItem[] = objects
    .filter((o) => o.itemType !== TIPO_EJERCITO)
    .map((o) => ({
      value: o.id,
      name: o.name,
      icon: o.icon,
      searchText: `${o.name} ${o.itemType} ${o.rarity}`,
    }));

  const subtablaOptions = recompensas.filter((r) => r.tipo === "subtabla");

  function openNew() {
    setForm(emptyForm);
    setEditingId("new");
    setErrorMsg(null);
  }

  function openEdit(r: RecompensaFull) {
    const lutCaras = makeEmptyLutCaras().map((empty) => {
      const saved = r.lutCaras?.find((c) => c.numeroCara === empty.numeroCara);
      if (!saved) return empty;
      return {
        numeroCara: saved.numeroCara,
        tipo: saved.tipo,
        oroMin: String(saved.oroMin ?? 10),
        oroMax: String(saved.oroMax ?? 50),
        objetoId: saved.objetoId,
        cantidadMin: String(saved.cantidadMin ?? 1),
        cantidadMax: String(saved.cantidadMax ?? 1),
        subtablaId: saved.subtablaId,
      };
    });

    const subtablaCaras = makeEmptySubtablaCaras().map((empty) => {
      const saved = r.subtablaCaras?.find((c) => c.numeroCara === empty.numeroCara);
      if (!saved) return empty;
      return {
        numeroCara: saved.numeroCara,
        tipo: (saved.tipo ?? "nada") as SubtablaCaraTipo,
        objetoId: saved.objetoId,
        cantidadMin: String(saved.cantidadMin ?? 1),
        cantidadMax: String(saved.cantidadMax ?? 1),
        oroMin: String(saved.oroMin ?? 10),
        oroMax: String(saved.oroMax ?? 50),
      };
    });

    setForm({
      nombre: r.nombre,
      descripcion: r.descripcion ?? "",
      tipo: r.tipo,
      tipoDado: r.tipoDado,
      costoOro: String(r.costoOro),
      activo: r.activo,
      orden: String(r.orden),
      objetoId: r.objetoId,
      cantidadDados: String(r.cantidadDados),
      multiplicadorOro: String(r.multiplicadorOro),
      sublistaItems: (() => {
        const n = DICE_FACES[r.tipoDado as DiceType] ?? 6;
        const sorted = [...r.sublistaItems].sort((a, b) => a.orden - b.orden);
        return Array.from({ length: n }, (_, i) => ({ objetoId: sorted[i]?.objetoId ?? null }));
      })(),
      lutCaras,
      subtablaCaras,
    });
    setEditingId(r.id);
    setErrorMsg(null);
  }

  function closeEdit() {
    if (editClosing) return;
    setEditClosing(true);
    window.setTimeout(() => {
      setEditingId(null);
      setErrorMsg(null);
      setEditClosing(false);
    }, MODAL_EXIT_MS);
  }

  function updateSublistaRow(idx: number, objetoId: number | null) {
    setForm((f) => ({
      ...f,
      sublistaItems: f.sublistaItems.map((si, i) => (i === idx ? { objetoId } : si)),
    }));
  }

  const dragSublistaIdx = useRef<number | null>(null);

  function handleSublistaDragStart(idx: number) {
    dragSublistaIdx.current = idx;
  }

  function handleSublistaDrop(targetIdx: number) {
    const from = dragSublistaIdx.current;
    if (from === null || from === targetIdx) return;
    setForm((f) => {
      const items = [...f.sublistaItems];
      const [moved] = items.splice(from, 1);
      items.splice(targetIdx, 0, moved);
      return { ...f, sublistaItems: items };
    });
    dragSublistaIdx.current = null;
  }

  function updateLutCara(idx: number, field: keyof LutCaraForm, value: unknown) {
    setForm((f) => ({
      ...f,
      lutCaras: f.lutCaras.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  }

  function updateSubtablaCara(idx: number, field: keyof SubtablaCaraForm, value: unknown) {
    setForm((f) => ({
      ...f,
      subtablaCaras: f.subtablaCaras.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        tipoDado: form.tipo === "lut" || form.tipo === "subtabla" ? "d20" : form.tipoDado,
        costoOro: parseInt(form.costoOro) || 0,
        activo: form.activo,
        orden: editingId === "new"
          ? (recompensas.length > 0 ? Math.max(...recompensas.map((r) => r.orden)) + 1 : 0)
          : parseInt(form.orden) || 0,
        objetoId: form.tipo === "item_fijo" ? form.objetoId : null,
        cantidadDados: parseInt(form.cantidadDados) || 1,
        multiplicadorOro: parseInt(form.multiplicadorOro) || 1,
        sublistaItems:
          form.tipo === "sublista"
            ? form.sublistaItems.map((si, i) => ({
                objetoId: si.objetoId,
                valorMin: i + 1,
                valorMax: i + 1,
              }))
            : [],
        lutCaras:
          form.tipo === "lut"
            ? form.lutCaras.map((c) => ({
                numeroCara: c.numeroCara,
                tipo: c.tipo,
                oroMin: parseInt(c.oroMin) || 0,
                oroMax: parseInt(c.oroMax) || 0,
                objetoId: c.tipo === "item" ? c.objetoId : null,
                cantidadMin: c.tipo === "item" ? (parseInt(c.cantidadMin) || 1) : 1,
                cantidadMax: c.tipo === "item" ? (parseInt(c.cantidadMax) || 1) : 1,
                subtablaId: c.tipo === "subtabla" ? c.subtablaId : null,
              }))
            : [],
        subtablaCaras:
          form.tipo === "subtabla"
            ? form.subtablaCaras.map((c) => ({
                numeroCara: c.numeroCara,
                tipo: c.tipo,
                objetoId: c.tipo === "item" ? c.objetoId : null,
                cantidadMin: c.tipo === "item" ? (parseInt(c.cantidadMin) || 1) : 1,
                cantidadMax: c.tipo === "item" ? (parseInt(c.cantidadMax) || 1) : 1,
                oroMin: c.tipo === "oro" ? parseInt(c.oroMin) || 0 : 0,
                oroMax: c.tipo === "oro" ? parseInt(c.oroMax) || 0 : 0,
              }))
            : [],
        ...(editingId !== "new" ? { id: editingId } : {}),
      };

      const res = await fetch("/api/dados/admin", {
        method: editingId === "new" ? "POST" : "PUT",
        headers: headers(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Error al guardar");
        return;
      }

      setSuccessMsg(editingId === "new" ? "Recompensa creada" : "Recompensa actualizada");
      setTimeout(() => setSuccessMsg(null), 2500);
      closeEdit();
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/dados/admin?id=${deleteTarget.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    setDeleteTarget(null);
    if (res.ok) {
      setSuccessMsg("Recompensa eliminada");
      setTimeout(() => setSuccessMsg(null), 2000);
      fetchData();
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <AdmHero
        accent={ACCENT}
        icon={Dice6}
        title="Dados del Destino"
        subtitle="Configura las tiradas y tablas de botín que aparecen en la homepage."
        right={
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-background transition-all active:scale-95"
            style={{ background: ACCENT, boxShadow: `0 8px 24px -10px ${ACCENT}` }}
          >
            <Plus className="h-4 w-4" />
            Nueva recompensa
          </button>
        }
      />

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-900/25 px-3 py-2.5 text-sm text-emerald-300 animate-in fade-in slide-in-from-top-1">
          <Check className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {recompensas.length === 0 && (
            <AdmPanel accent={ACCENT} className="py-10 text-center text-sm text-muted-foreground">
              Sin recompensas configuradas. Crea la primera.
            </AdmPanel>
          )}

          {recompensas.map((r, idx) => (
            <div
              key={r.id}
              className={`adm-row-in group flex items-center gap-3 rounded-xl border p-3 transition-all hover:border-gold/50 ${
                r.activo
                  ? "border-gold-dim/40 bg-gradient-to-br from-secondary/40 to-black/30"
                  : "border-border/30 bg-card/50 opacity-60"
              }`}
              style={{ ["--adm-delay" as string]: `${idx * 0.04}s` }}
            >
              <div className="dice-idle shrink-0">
                <DiceVisual type={r.tipoDado} rolling={false} size={40} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground/90">
                  {r.nombre}
                  {!r.activo && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-foreground/40">inactivo</span>
                  )}
                </p>
                <p className="text-xs text-foreground/50">
                  {TIPO_LABEL[r.tipo]} · {r.tipoDado.toUpperCase()} · {r.costoOro} oro
                  {r.tipo === "sublista" && ` · ${r.sublistaItems.length} ítems`}
                  {r.tipo === "oro_dados" && ` · ${r.cantidadDados} dados × ${r.multiplicadorOro}`}
                  {r.tipo === "lut" && ` · ${r.lutCaras?.filter((c) => c.tipo !== "nada").length ?? 0} caras activas`}
                  {r.tipo === "subtabla" && ` · ${r.subtablaCaras?.filter((c) => c.objetoId !== null).length ?? 0} ítems`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(r)}
                  className="rounded-lg p-2 text-foreground/50 transition-colors hover:bg-gold/10 hover:text-gold"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(r)}
                  className="rounded-lg p-2 text-foreground/50 transition-colors hover:bg-red-900/20 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editingId !== null && (
        <ModalPortal>
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${modalOverlayCls(editClosing)}`}>
          <div
            className={`adm-modal relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl ${form.tipo === "lut" || form.tipo === "subtabla" ? "max-w-2xl" : "max-w-lg"} ${modalPanelCls(editClosing)}`}
            style={{ ["--adm-accent" as string]: ACCENT }}
          >
            <span className="adm-modal-line" aria-hidden />
            <div className="adm-modal-head relative flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}1a`, color: ACCENT }}
                >
                  <Dices className="h-5 w-5" />
                </span>
                <h3 className="truncate font-serif text-base text-foreground">
                  {editingId === "new" ? "Nueva recompensa" : "Editar recompensa"}
                </h3>
              </div>
              <button
                onClick={closeEdit}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="adm-grain relative min-h-0 space-y-4 overflow-y-auto p-5">
              {/* Nombre */}
              <div>
                <label className="block text-xs text-foreground/60 mb-1 font-sans">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                  placeholder="Ej: Cofre del aventurero"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-foreground/60 mb-1 font-sans">Descripción</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                  placeholder="Descripción opcional"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs text-foreground/60 mb-1 font-sans">Tipo de recompensa *</label>
                <Select
                  value={form.tipo}
                  onChange={(e) => {
                    const newTipo = e.target.value as RewardType;
                    setForm((f) => ({
                      ...f,
                      tipo: newTipo,
                      sublistaItems: newTipo === "sublista" ? makeEmptySublistaItems(f.tipoDado) : f.sublistaItems,
                    }));
                  }}
                >
                  {REWARD_TYPES.filter((t) => t !== "item_fijo" && t !== "sublista" && t !== "oro_dados").map((t) => (
                    <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                  ))}
                </Select>
              </div>

              {/* Tipo de dado — ocultar para lut y subtabla (siempre D20) */}
              {form.tipo !== "lut" && form.tipo !== "subtabla" && (
                <div>
                  <label className="block text-xs text-foreground/60 mb-1 font-sans">Tipo de dado *</label>
                  <div className="flex gap-2 flex-wrap">
                    {DICE_TYPES.map((d) => (
                      <button
                        key={d}
                        onClick={() => setForm((f) => {
                          const n = DICE_FACES[d];
                          const sublistaItems = f.tipo === "sublista"
                            ? Array.from({ length: n }, (_, i) => f.sublistaItems[i] ?? { objetoId: null })
                            : f.sublistaItems;
                          return { ...f, tipoDado: d, sublistaItems };
                        })}
                        className={`px-2.5 py-1.5 rounded border text-xs font-sans transition-all ${
                          form.tipoDado === d
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-border/50 text-foreground/50 hover:border-gold/50"
                        }`}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(form.tipo === "lut" || form.tipo === "subtabla") && (
                <p className="text-xs text-foreground/40 font-sans italic">
                  Este tipo siempre usa un D20.
                </p>
              )}


              {/* item_fijo */}
              {form.tipo === "item_fijo" && (
                <div>
                  <label className="block text-xs text-foreground/60 mb-1 font-sans">Ítem a entregar *</label>
                  <ObjectSelector
                    items={objectSelectorItems}
                    value={form.objetoId}
                    onChange={(v) => setForm((f) => ({ ...f, objetoId: v }))}
                    placeholder="Buscar ítem…"
                  />
                </div>
              )}

              {/* oro_dados */}
              {form.tipo === "oro_dados" && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-foreground/60 mb-1 font-sans">Cantidad de dados</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={form.cantidadDados}
                      onChange={(e) => setForm((f) => ({ ...f, cantidadDados: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-foreground/60 mb-1 font-sans">Multiplicador de oro</label>
                    <input
                      type="number"
                      min="1"
                      value={form.multiplicadorOro}
                      onChange={(e) => setForm((f) => ({ ...f, multiplicadorOro: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                    />
                    <p className="text-[10px] text-foreground/40 mt-1">
                      Resultado × {form.multiplicadorOro} = oro ganado
                    </p>
                  </div>
                </div>
              )}

              {/* sublista */}
              {form.tipo === "sublista" && (
                <div className="space-y-2">
                  <label className="text-xs text-foreground/60 font-sans">
                    Ítems del {form.tipoDado.toUpperCase()} — arrastra para reordenar
                  </label>
                  {form.sublistaItems.map((si, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => handleSublistaDragStart(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSublistaDrop(idx)}
                      className="flex items-center gap-2 p-2 rounded border border-border/30 bg-background/40 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-foreground/20 shrink-0" />
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gold/10 border border-gold/30 text-gold text-xs font-bold font-sans">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <ObjectSelector
                          items={objectSelectorItems}
                          value={si.objetoId}
                          onChange={(v) => updateSublistaRow(idx, v)}
                          placeholder="Sin ítem (nada)"
                          searchable
                          searchPlaceholder="Buscar ítem…"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LUT — 20 caras configurables */}
              {form.tipo === "lut" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-foreground/60 font-sans">Caras del D20</label>
                    {subtablaOptions.length === 0 && (
                      <span className="text-[10px] text-amber-400/70">Sin sub-tablas disponibles</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {form.lutCaras.map((cara, idx) => (
                      <div
                        key={cara.numeroCara}
                        className="p-2.5 rounded border border-border/30 bg-background/40 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-gold/10 border border-gold/30 text-gold text-xs font-bold font-sans">
                            {cara.numeroCara}
                          </span>
                          <Select
                            value={cara.tipo}
                            onChange={(e) => updateLutCara(idx, "tipo", e.target.value as LutCaraTipo)}
                            className="flex-1 text-xs py-1 h-auto"
                          >
                            <option value="nada">Nada</option>
                            <option value="item">Ítem</option>
                            <option value="oro">Oro</option>
                            <option value="subtabla">Sub-tabla</option>
                          </Select>
                        </div>

                        {cara.tipo === "item" && (
                          <>
                            <ObjectSelector
                              items={objectSelectorItems}
                              value={cara.objetoId}
                              onChange={(v) => updateLutCara(idx, "objetoId", v)}
                              placeholder="Elegir ítem…"
                              searchable
                              searchPlaceholder="Buscar…"
                            />
                            <div className="flex items-center gap-1.5">
                              <GoldAmountInput
                                value={cara.cantidadMin}
                                onChangeValue={(v) => updateLutCara(idx, "cantidadMin", v)}
                                min={1}
                                className="w-14 text-xs px-1.5 py-1 h-auto"
                              />
                              <span className="text-foreground/40 text-xs">–</span>
                              <GoldAmountInput
                                value={cara.cantidadMax}
                                onChangeValue={(v) => updateLutCara(idx, "cantidadMax", v)}
                                min={1}
                                className="w-14 text-xs px-1.5 py-1 h-auto"
                              />
                              <span className="text-foreground/30 text-[10px]">uds.</span>
                            </div>
                          </>
                        )}

                        {cara.tipo === "oro" && (
                          <div className="flex items-center gap-1.5">
                            <GoldAmountInput
                              value={cara.oroMin}
                              onChangeValue={(v) => updateLutCara(idx, "oroMin", v)}
                              min={0}
                              allowZero
                              className="w-14 text-xs px-1.5 py-1 h-auto"
                            />
                            <span className="text-foreground/40 text-xs">–</span>
                            <GoldAmountInput
                              value={cara.oroMax}
                              onChangeValue={(v) => updateLutCara(idx, "oroMax", v)}
                              min={0}
                              allowZero
                              className="w-14 text-xs px-1.5 py-1 h-auto"
                            />
                            <span className="text-foreground/30 text-[10px]">oro</span>
                          </div>
                        )}

                        {cara.tipo === "subtabla" && (
                          <Select
                            value={cara.subtablaId ?? ""}
                            onChange={(e) =>
                              updateLutCara(idx, "subtablaId", e.target.value ? Number(e.target.value) : null)
                            }
                            className="w-full text-xs py-1 h-auto"
                          >
                            <option value="">— sub-tabla —</option>
                            {subtablaOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtabla — 20 caras: ítem, oro o nada */}
              {form.tipo === "subtabla" && (
                <div className="space-y-2">
                  <label className="text-xs text-foreground/60 font-sans">
                    Caras del D20 — ítem, oro o nada
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {form.subtablaCaras.map((cara, idx) => (
                      <div key={cara.numeroCara} className="p-2.5 rounded border border-border/30 bg-background/40 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-gold/10 border border-gold/30 text-gold text-xs font-bold font-sans">
                            {cara.numeroCara}
                          </span>
                          <Select
                            value={cara.tipo}
                            onChange={(e) => {
                              updateSubtablaCara(idx, "tipo", e.target.value as SubtablaCaraTipo);
                              if (e.target.value !== "item") updateSubtablaCara(idx, "objetoId", null);
                            }}
                            className="flex-1 text-xs py-1 h-auto"
                          >
                            <option value="nada">Nada</option>
                            <option value="item">Ítem</option>
                            <option value="oro">Oro</option>
                          </Select>
                        </div>

                        {cara.tipo === "item" && (
                          <>
                            <ObjectSelector
                              items={objectSelectorItems}
                              value={cara.objetoId}
                              onChange={(v) => updateSubtablaCara(idx, "objetoId", v)}
                              placeholder="Seleccionar ítem…"
                              searchable
                              searchPlaceholder="Buscar ítem…"
                            />
                            <div className="flex items-center gap-1.5">
                              <GoldAmountInput
                                value={cara.cantidadMin}
                                onChangeValue={(v) => updateSubtablaCara(idx, "cantidadMin", v)}
                                min={1}
                                className="w-14 text-xs px-1.5 py-1 h-auto"
                              />
                              <span className="text-foreground/40 text-xs">–</span>
                              <GoldAmountInput
                                value={cara.cantidadMax}
                                onChangeValue={(v) => updateSubtablaCara(idx, "cantidadMax", v)}
                                min={1}
                                className="w-14 text-xs px-1.5 py-1 h-auto"
                              />
                              <span className="text-foreground/30 text-[10px]">uds.</span>
                            </div>
                          </>
                        )}

                        {cara.tipo === "oro" && (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="number"
                              min={0}
                              value={cara.oroMin}
                              onChange={(e) => updateSubtablaCara(idx, "oroMin", e.target.value)}
                              placeholder="Mín"
                              className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground placeholder:text-foreground/30 outline-none"
                            />
                            <span className="text-foreground/40 text-xs shrink-0">–</span>
                            <input
                              type="number"
                              min={0}
                              value={cara.oroMax}
                              onChange={(e) => updateSubtablaCara(idx, "oroMax", e.target.value)}
                              placeholder="Máx"
                              className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground placeholder:text-foreground/30 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activo */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-sans">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="accent-yellow-400"
                />
                Activo
              </label>

              {errorMsg && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
                  {errorMsg}
                </p>
              )}

            </div>

            <div className="relative flex shrink-0 items-center justify-end gap-2 border-t border-border/70 bg-secondary/30 px-5 py-4">
              <button
                onClick={closeEdit}
                className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-background transition-all active:scale-95 disabled:opacity-50"
                style={{ background: ACCENT, boxShadow: `0 8px 24px -10px ${ACCENT}` }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Sección de prueba — visible si hay recompensas activas */}
      {!loading && recompensas.filter((r) => r.tipo !== "subtabla" && r.activo).length > 0 && (
        <div className="adm-panel overflow-hidden rounded-xl" style={{ ["--adm-accent" as string]: ACCENT }}>
          <div className="relative flex items-center gap-2.5 border-b border-gold-dim/30 px-4 py-3">
            <span
              className="dice-idle inline-flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}1a`, color: ACCENT }}
            >
              <Dices className="h-4 w-4" />
            </span>
            <span className="font-serif text-sm text-gold">Probar tirador</span>
          </div>
          <div className="relative p-3">
            <DiceModule token={token} />
          </div>
        </div>
      )}

      {/* Modal de confirmación de borrado */}
      <ConfirmActionModal
        open={deleteTarget !== null}
        title="Eliminar recompensa"
        description={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
