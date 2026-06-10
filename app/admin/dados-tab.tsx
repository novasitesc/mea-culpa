"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, Loader2, Check, X } from "lucide-react";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { Select } from "@/components/ui/select";
import ConfirmActionModal from "@/components/ui/confirm-action-modal";
import { DICE_TYPES, REWARD_TYPES } from "@/lib/types/dados";
import type { DiceType, RewardType } from "@/lib/types/dados";
import DiceVisual from "@/app/components/dice-visual";

type AdminObject = {
  id: number;
  name: string;
  icon: string;
  itemType: string;
  rarity: string;
};

type SublistaFormItem = {
  objetoId: number | null;
  valorMin: string;
  valorMax: string;
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
};

const TIPO_LABEL: Record<RewardType, string> = {
  item_fijo: "Ítem garantizado",
  sublista: "Tabla de ítems (sublista)",
  oro_dados: "Oro por dados",
};

const DICE_LABEL: Record<DiceType, string> = {
  d4: "D4 (1-4)",
  d6: "D6 (1-6)",
  d8: "D8 (1-8)",
  d10: "D10 (1-10)",
  d12: "D12 (1-12)",
  d20: "D20 (1-20)",
};

const emptyForm = {
  nombre: "",
  descripcion: "",
  tipo: "item_fijo" as RewardType,
  tipoDado: "d6" as DiceType,
  costoOro: "0",
  activo: true,
  orden: "0",
  objetoId: null as number | null,
  cantidadDados: "1",
  multiplicadorOro: "10",
  sublistaItems: [] as SublistaFormItem[],
};

export function DadosTab({ token }: { token: string | null }) {
  const [recompensas, setRecompensas] = useState<RecompensaFull[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
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
      const [rRes, oRes] = await Promise.all([
        fetch("/api/dados/admin", { headers: headers() }),
        fetch("/api/admin/objetos", { headers: headers() }),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setRecompensas(d.recompensas ?? []);
      }
      if (oRes.ok) {
        const d = await oRes.json();
        setObjects(d.objects ?? d.objetos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const objectSelectorItems: ObjectSelectorItem[] = objects.map((o) => ({
    value: o.id,
    name: o.name,
    icon: o.icon,
    searchText: `${o.name} ${o.itemType} ${o.rarity}`,
  }));

  function openNew() {
    setForm(emptyForm);
    setEditingId("new");
    setErrorMsg(null);
  }

  function openEdit(r: RecompensaFull) {
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
      sublistaItems: r.sublistaItems.map((si) => ({
        objetoId: si.objetoId,
        valorMin: String(si.valorMin),
        valorMax: String(si.valorMax),
      })),
    });
    setEditingId(r.id);
    setErrorMsg(null);
  }

  function closeEdit() {
    setEditingId(null);
    setErrorMsg(null);
  }

  function addSublistaRow() {
    setForm((f) => ({
      ...f,
      sublistaItems: [...f.sublistaItems, { objetoId: null, valorMin: "1", valorMax: "1" }],
    }));
  }

  function removeSublistaRow(idx: number) {
    setForm((f) => ({
      ...f,
      sublistaItems: f.sublistaItems.filter((_, i) => i !== idx),
    }));
  }

  function updateSublistaRow(idx: number, field: keyof SublistaFormItem, value: string | number | null) {
    setForm((f) => ({
      ...f,
      sublistaItems: f.sublistaItems.map((si, i) => (i === idx ? { ...si, [field]: value } : si)),
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
        tipoDado: form.tipoDado,
        costoOro: parseInt(form.costoOro) || 0,
        activo: form.activo,
        orden: parseInt(form.orden) || 0,
        objetoId: form.tipo === "item_fijo" ? form.objetoId : null,
        cantidadDados: parseInt(form.cantidadDados) || 1,
        multiplicadorOro: parseInt(form.multiplicadorOro) || 1,
        sublistaItems:
          form.tipo === "sublista"
            ? form.sublistaItems.map((si) => ({
                objetoId: si.objetoId,
                valorMin: parseInt(si.valorMin) || 1,
                valorMax: parseInt(si.valorMax) || 1,
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif text-gold">Dados — Recompensas</h2>
          <p className="text-xs text-foreground/50 font-sans mt-0.5">
            Configura las opciones de dados que aparecen en la homepage.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/50 text-gold text-sm hover:bg-gold/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva recompensa
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-900/30 border border-green-500/40 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-gold animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {recompensas.length === 0 && (
            <p className="text-center text-sm text-foreground/40 py-8">
              Sin recompensas configuradas. Crea la primera.
            </p>
          )}

          {recompensas.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-3 py-3 rounded border ${
                r.activo ? "border-gold-dim/40 bg-card" : "border-border/30 bg-card/50 opacity-60"
              }`}
            >
              <div className="shrink-0">
                <DiceVisual type={r.tipoDado} rolling={false} size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-foreground/90 truncate">
                  {r.nombre}
                  {!r.activo && (
                    <span className="ml-2 text-[10px] text-foreground/40 uppercase tracking-wider">inactivo</span>
                  )}
                </p>
                <p className="text-xs text-foreground/50">
                  {TIPO_LABEL[r.tipo]} · {r.tipoDado.toUpperCase()} · {r.costoOro} oro
                  {r.tipo === "sublista" && ` · ${r.sublistaItems.length} ítems`}
                  {r.tipo === "oro_dados" && ` · ${r.cantidadDados} dados × ${r.multiplicadorOro}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(r)}
                  className="p-1.5 rounded text-foreground/50 hover:text-gold hover:bg-gold/10 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(r)}
                  className="p-1.5 rounded text-foreground/50 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4">
          <div className="bg-card border border-gold-dim/60 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h3 className="font-serif text-gold text-base">
                {editingId === "new" ? "Nueva recompensa" : "Editar recompensa"}
              </h3>
              <button onClick={closeEdit} className="text-foreground/40 hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
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
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as RewardType }))}
                >
                  {REWARD_TYPES.map((t) => (
                    <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                  ))}
                </Select>
              </div>

              {/* Tipo de dado */}
              <div>
                <label className="block text-xs text-foreground/60 mb-1 font-sans">Tipo de dado *</label>
                <div className="flex gap-2 flex-wrap">
                  {DICE_TYPES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm((f) => ({ ...f, tipoDado: d }))}
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

              {/* Costo en oro */}
              <div>
                <label className="block text-xs text-foreground/60 mb-1 font-sans">Costo en oro</label>
                <GoldAmountInput
                  value={form.costoOro}
                  onChangeValue={(v) => setForm((f) => ({ ...f, costoOro: v }))}
                  allowZero
                />
              </div>

              {/* Campos específicos por tipo */}
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

              {form.tipo === "sublista" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-foreground/60 font-sans">Ítems de la tabla</label>
                    <button
                      onClick={addSublistaRow}
                      className="flex items-center gap-1 text-xs text-gold/70 hover:text-gold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar fila
                    </button>
                  </div>
                  <p className="text-[10px] text-foreground/40">
                    Rango del dado {form.tipoDado.toUpperCase()} → 1 a {form.tipoDado.slice(1)}. Los rangos deben cubrir todos los resultados posibles.
                  </p>
                  {form.sublistaItems.length === 0 && (
                    <p className="text-xs text-foreground/30 italic text-center py-2">Sin filas. Agrega ítems.</p>
                  )}
                  {form.sublistaItems.map((si, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-foreground/40 shrink-0 w-5 text-right">{idx + 1}.</span>
                      <input
                        type="number"
                        value={si.valorMin}
                        onChange={(e) => updateSublistaRow(idx, "valorMin", e.target.value)}
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                        placeholder="Min"
                      />
                      <span className="text-foreground/30 text-xs">–</span>
                      <input
                        type="number"
                        value={si.valorMax}
                        onChange={(e) => updateSublistaRow(idx, "valorMax", e.target.value)}
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                        placeholder="Max"
                      />
                      <div className="flex-1">
                        <ObjectSelector
                          items={objectSelectorItems}
                          value={si.objetoId}
                          onChange={(v) => updateSublistaRow(idx, "objetoId", v)}
                          placeholder="Ítem…"
                        />
                      </div>
                      <button
                        onClick={() => removeSublistaRow(idx)}
                        className="p-1 text-foreground/30 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Activo / Orden */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-sans">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                    className="accent-yellow-400"
                  />
                  Activo
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-foreground/60 font-sans">Orden</label>
                  <input
                    type="number"
                    value={form.orden}
                    onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                    className="w-16 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:border-gold/60"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
                  {errorMsg}
                </p>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-gold/20 border border-gold/50 text-gold text-sm font-sans hover:bg-gold/30 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  onClick={closeEdit}
                  className="px-4 py-2 rounded border border-border/50 text-foreground/60 text-sm hover:border-border hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
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
