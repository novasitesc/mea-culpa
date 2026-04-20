"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, RotateCw, Shield, Trash2 } from "lucide-react";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { Select } from "@/components/ui/select";
import { categoryToLabel, type RouletteCategory } from "@/lib/roulette";

const CATEGORIES: RouletteCategory[] = [
  "jackpot",
  "muy_grande",
  "nada",
  "grande",
  "mediano",
  "pequeno",
];

type RuletaConfig = {
  habilitada: boolean;
  actualizadoEn: string | null;
  actualizadoPor: string | null;
};

type RuletaPool = {
  id: string;
  category: RouletteCategory;
  categoryLabel: string;
  rewardType: "oro" | "objeto";
  label: string;
  goldAmount: number | null;
  objectId: number | null;
  objectQuantity: number;
  active: boolean;
  object: { name: string; icon: string; price: number } | null;
};

type AdminObject = {
  id: number;
  name: string;
  icon: string;
  itemType: string;
  rarity: string;
};

type TabState = {
  category: RouletteCategory;
  rewardType: "oro" | "objeto";
  label: string;
  goldAmount: string;
  objectId: number | null;
  objectQuantity: string;
  active: boolean;
};

const defaultState: TabState = {
  category: "jackpot",
  rewardType: "oro",
  label: "",
  goldAmount: "1000",
  objectId: null,
  objectQuantity: "1",
  active: true,
};

function groupByCategory(pools: RuletaPool[]) {
  return CATEGORIES.map((category) => ({
    category,
    label: categoryToLabel(category),
    items: pools.filter((pool) => pool.category === category),
  }));
}

export function RuletaTab({ token, onToast }: { token: string; onToast: (msg: string, type: "success" | "error") => void; }) {
  const [config, setConfig] = useState<RuletaConfig | null>(null);
  const [pools, setPools] = useState<RuletaPool[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TabState>(defaultState);

  const objectOptions = useMemo<ObjectSelectorItem[]>(() => {
    return objects.map((item) => ({
      value: item.id,
      name: item.name,
      icon: item.icon,
      searchText: `${item.itemType} ${item.rarity}`,
    }));
  }, [objects]);

  const load = async () => {
    setLoading(true);
    try {
      const [configRes, poolsRes, objectsRes] = await Promise.all([
        fetch("/api/admin/ruleta/config", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/ruleta/premios", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/objetos", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (configRes.ok) {
        setConfig(await configRes.json());
      }
      if (poolsRes.ok) {
        const data = await poolsRes.json();
        setPools(data.pools ?? []);
      }
      if (objectsRes.ok) {
        setObjects(await objectsRes.json());
      }
    } catch {
      onToast("No se pudo cargar la ruleta", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const handleToggle = async () => {
    if (!config) return;
    const nextValue = !config.habilitada;
    const res = await fetch("/api/admin/ruleta/config", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ habilitada: nextValue }),
    });

    if (!res.ok) {
      onToast("No se pudo actualizar la ruleta", "error");
      return;
    }

    setConfig({ ...config, habilitada: nextValue });
    onToast(nextValue ? "Ruleta habilitada" : "Ruleta deshabilitada", "success");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload: Record<string, unknown> = {
      category: form.category,
      rewardType: form.rewardType,
      label: form.label,
      active: form.active,
    };

    if (form.rewardType === "oro") {
      payload.goldAmount = Number(form.goldAmount);
    } else {
      payload.objectId = form.objectId;
      payload.objectQuantity = Number(form.objectQuantity);
    }

    const res = await fetch("/api/admin/ruleta/premios", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      onToast(data?.error ?? "No se pudo crear el premio", "error");
      return;
    }

    onToast("Premio agregado a la pool", "success");
    setForm((current) => ({ ...defaultState, category: current.category }));
    await load();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setDeletingId(id);
    const res = await fetch(`/api/admin/ruleta/premios/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !currentActive }),
    });
    setDeletingId(null);

    if (!res.ok) {
      onToast(
        currentActive
          ? "No se pudo desactivar el premio"
          : "No se pudo activar el premio",
        "error",
      );
      return;
    }

    onToast(currentActive ? "Premio desactivado" : "Premio activado", "success");
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gold/30 bg-card/90 p-4 shadow-lg medieval-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Configuración de ruleta
            </h3>
            <p className="text-sm text-muted-foreground">
              Habilita la ruleta y administra las pools reales por categoría.
            </p>
          </div>
          <button
            onClick={handleToggle}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              config?.habilitada
                ? "bg-green-900/30 border-green-700 text-green-200"
                : "bg-destructive/20 border-destructive/40 text-destructive"
            }`}
          >
            {config?.habilitada ? "Ruleta activa" : "Ruleta apagada"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Nuevo premio</h3>
            <p className="text-xs text-muted-foreground">Crea entradas para la pool de una categoría.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Categoría</span>
              <Select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as RouletteCategory }))}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryToLabel(category)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Tipo</span>
              <Select value={form.rewardType} onChange={(e) => setForm((current) => ({ ...current, rewardType: e.target.value as "oro" | "objeto" }))}>
                <option value="oro">Oro</option>
                <option value="objeto">Objeto</option>
              </Select>
            </label>
          </div>

          <label className="space-y-1 text-sm block">
            <span className="text-muted-foreground">Etiqueta opcional</span>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.label}
              onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
              placeholder="Ej: Cofre legendario"
            />
          </label>

          {form.rewardType === "oro" ? (
            <label className="space-y-1 text-sm block">
              <span className="text-muted-foreground">Monto de oro</span>
              <GoldAmountInput
                value={Number(form.goldAmount) || 0}
                onChangeValue={(value) => setForm((current) => ({ ...current, goldAmount: String(value ?? 0) }))}
                placeholder="Cantidad de oro"
              />
            </label>
          ) : (
            <label className="space-y-1 text-sm block">
              <span className="text-muted-foreground">Objeto</span>
              <ObjectSelector
                items={objectOptions}
                value={form.objectId}
                onChange={(value) => setForm((current) => ({ ...current, objectId: value }))}
                searchable
                searchPlaceholder="Buscar objeto para la pool..."
                emptyLabel="No hay objetos configurados"
              />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={form.objectQuantity}
                  onChange={(e) => setForm((current) => ({ ...current, objectQuantity: e.target.value }))}
                  placeholder="Cantidad"
                />
                <div className="w-full" />
              </div>
            </label>
          )}

          {form.rewardType === "oro" ? (
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                className={`rounded-lg border px-3 py-2 text-sm ${form.active ? "border-green-700 bg-green-950/30 text-green-200" : "border-border bg-secondary text-muted-foreground"}`}
              >
                {form.active ? "Activa" : "Inactiva"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
              className={`rounded-lg border px-3 py-2 text-sm ${form.active ? "border-green-700 bg-green-950/30 text-green-200" : "border-border bg-secondary text-muted-foreground"}`}
            >
              {form.active ? "Activa" : "Inactiva"}
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-gold px-4 py-2 text-background font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar premio
          </button>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando pools...
            </div>
          ) : (
            groupByCategory(pools).map((group) => (
              <section key={group.category} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gold">{group.label}</h4>
                    <p className="text-xs text-muted-foreground">{group.items.length} premios configurados</p>
                  </div>
                  <button onClick={() => void load()} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <RotateCw className="w-3.5 h-3.5" />
                    Recargar
                  </button>
                </div>

                <div className="space-y-2">
                  {group.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin premios todavía.</p>
                  ) : (
                    group.items.map((pool) => (
                      <div key={pool.id} className="rounded-lg border border-border/80 bg-background/60 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {pool.rewardType === "oro"
                              ? pool.label || `Oro x${pool.goldAmount ?? 0}`
                              : `${pool.object?.icon ?? "📦"} ${pool.label || pool.object?.name || "Objeto"}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pool.rewardType === "oro"
                              ? `${pool.goldAmount?.toLocaleString("es-ES") ?? 0} oro`
                              : `${pool.objectQuantity} unidad${pool.objectQuantity === 1 ? "" : "es"}`}
                            {" · "}
                            Estado: {pool.active ? "Activa" : "Inactiva"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(pool.id, pool.active)}
                          disabled={deletingId === pool.id}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 ${
                            pool.active
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : "border-green-700 bg-green-950/30 text-green-300"
                          }`}
                        >
                          {deletingId === pool.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : pool.active ? (
                            <Trash2 className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {pool.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
