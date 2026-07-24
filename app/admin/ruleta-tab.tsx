"use client";

// Pestaña de ruleta del panel: premios de cada categoría, interruptor global e
// historial de tiradas.
// Aquí se edita QUÉ se puede ganar; las probabilidades son fijas y están en el
// código (lib/roulette.ts).

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Dices,
  Gift,
  Loader2,
  Plus,
  Power,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import ConfirmActionModal from "@/components/ui/confirm-action-modal";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { Select } from "@/components/ui/select";
import { categoryToLabel, type RouletteCategory } from "@/lib/roulette";
import { getIconForString } from "@/lib/iconMapper";
import { AdmHero, AdmPanel, AdmHeading } from "./section-ui";

const ACCENT = "#c084fc";

const CATEGORIES: RouletteCategory[] = [
  "jackpot",
  "muy_grande",
  "nada",
  "grande",
  "mediano",
  "pequeno",
];

// Colores de rareza por categoría (estética de botín de RPG)
const CATEGORY_ACCENT: Record<RouletteCategory, string> = {
  jackpot: "#f5c542",
  muy_grande: "#c084fc",
  grande: "#60a5fa",
  mediano: "#34d399",
  pequeno: "#fbbf24",
  nada: "#8a8172",
};

const CONFIGURABLE_CATEGORIES: RouletteCategory[] = CATEGORIES.filter(
  (category) => category !== "nada",
);

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

export function RuletaTab({
  token,
  onToast,
  isSuperAdmin,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
  isSuperAdmin: boolean;
}) {
  const [config, setConfig] = useState<RuletaConfig | null>(null);
  const [pools, setPools] = useState<RuletaPool[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
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
    if (!isSuperAdmin) {
      onToast("Solo super_admin puede activar o desactivar la ruleta", "error");
      return;
    }

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
    setActionId(`toggle:${id}`);
    const res = await fetch(`/api/admin/ruleta/premios/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !currentActive }),
    });
    setActionId(null);

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

  const handleDeletePrize = (id: string, label: string) => {
    setDeleteTarget({ id, label });
  };

  const handleConfirmDeletePrize = async () => {
    if (!deleteTarget) return;

    const id = deleteTarget.id;
    setActionId(`delete:${id}`);
    const res = await fetch(`/api/admin/ruleta/premios/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    setActionId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      onToast(data?.error ?? "No se pudo borrar el premio", "error");
      return;
    }

    setDeleteTarget(null);
    onToast("Premio eliminado", "success");
    await load();
  };

  const totalPrizes = pools.length;
  const activePrizes = pools.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      {/* Hero: estado de la ruleta con rueda decorativa girando */}
      <AdmHero
        accent={ACCENT}
        icon={Dices}
        title="La Rueda del Destino"
        subtitle="Habilita la ruleta y forja las pools de premios reales por categoría."
        right={
          <button
            onClick={handleToggle}
            disabled={!isSuperAdmin}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
              config?.habilitada
                ? "border-emerald-600/60 bg-emerald-700/20 text-emerald-300"
                : "border-destructive/50 bg-destructive/15 text-destructive"
            } ${!isSuperAdmin ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <Power className="h-4 w-4" />
            {config?.habilitada ? "Ruleta activa" : "Ruleta apagada"}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="relative inline-flex h-4 w-4">
              <span
                className="adm-spin-slow absolute inset-0 rounded-full border-2 border-dashed"
                style={{ borderColor: `${ACCENT}88` }}
              />
            </span>
            {totalPrizes} premios en las pools
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-700/10 px-3 py-1.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {activePrizes} activos
          </span>
        </div>
      </AdmHero>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        {/* Formulario de nuevo premio */}
        <form onSubmit={handleCreate}>
          <AdmPanel accent={ACCENT} className="space-y-4">
            <AdmHeading
              accent={ACCENT}
              icon={Plus}
              title="Nuevo premio"
              subtitle="Crea entradas para la pool de una categoría."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Categoría</span>
                <Select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as RouletteCategory }))}>
                  {CONFIGURABLE_CATEGORIES.map((category) => (
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

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Etiqueta opcional</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40"
                value={form.label}
                onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
                placeholder="Ej: Cofre legendario"
              />
            </label>

            {form.rewardType === "oro" ? (
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Monto de oro</span>
                <GoldAmountInput
                  value={Number(form.goldAmount) || 0}
                  onChangeValue={(value) => setForm((current) => ({ ...current, goldAmount: String(value ?? 0) }))}
                  placeholder="Cantidad de oro"
                />
              </label>
            ) : (
              <label className="block space-y-1 text-sm">
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40"
                    value={form.objectQuantity}
                    onChange={(e) => setForm((current) => ({ ...current, objectQuantity: e.target.value }))}
                    placeholder="Cantidad"
                  />
                  <div className="w-full" />
                </div>
              </label>
            )}

            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                form.active
                  ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {form.active ? "Se creará activa" : "Se creará inactiva"}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-background transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: ACCENT, boxShadow: `0 8px 24px -10px ${ACCENT}` }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar premio
            </button>
          </AdmPanel>
        </form>

        {/* Pools por categoría */}
        <div className="space-y-4">
          {loading ? (
            <AdmPanel accent={ACCENT} className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando pools...
            </AdmPanel>
          ) : (
            groupByCategory(pools).map((group) => {
              const catAccent = CATEGORY_ACCENT[group.category];
              return (
                <AdmPanel key={group.category} accent={catAccent} className="space-y-3">
                  <AdmHeading
                    accent={catAccent}
                    icon={Gift}
                    title={group.label}
                    subtitle={`${group.items.length} premios configurados`}
                    right={
                      <button
                        onClick={() => void load()}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Recargar
                      </button>
                    }
                  />

                  <div className="space-y-2">
                    {group.items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-sm text-muted-foreground">
                        Sin premios todavía.
                      </p>
                    ) : (
                      group.items.map((pool, idx) => (
                        <div
                          key={pool.id}
                          className="adm-row-in flex flex-col gap-2 rounded-lg border border-border/70 bg-background/50 p-3 transition-colors hover:border-border md:flex-row md:items-center md:justify-between"
                          style={{ ["--adm-delay" as string]: `${idx * 0.04}s` }}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                              style={{ borderColor: `${catAccent}55`, background: `${catAccent}1a`, color: catAccent }}
                            >
                              {pool.rewardType === "oro" ? (
                                <Sparkles className="h-4 w-4" />
                              ) : (
                                getIconForString(pool.object?.name ?? "📦", "w-4 h-4", pool.object?.icon)
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {pool.rewardType === "oro"
                                  ? pool.label || `Oro x${pool.goldAmount ?? 0}`
                                  : pool.label || pool.object?.name || "Objeto"}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pool.rewardType === "oro"
                                  ? `${pool.goldAmount?.toLocaleString("es-ES") ?? 0} oro`
                                  : `${pool.objectQuantity} unidad${pool.objectQuantity === 1 ? "" : "es"}`}
                                {" · "}
                                <span className={pool.active ? "text-emerald-400" : "text-muted-foreground/70"}>
                                  {pool.active ? "Activa" : "Inactiva"}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleToggleActive(pool.id, pool.active)}
                              disabled={actionId === `toggle:${pool.id}` || actionId === `delete:${pool.id}`}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-60 ${
                                pool.active
                                  ? "border-amber-600/40 bg-amber-900/20 text-amber-300 hover:bg-amber-900/30"
                                  : "border-emerald-700 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/30"
                              }`}
                            >
                              {actionId === `toggle:${pool.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : pool.active ? (
                                <Power className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {pool.active ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePrize(pool.id, pool.label || (pool.rewardType === "oro" ? `Oro x${pool.goldAmount ?? 0}` : pool.object?.name || "Objeto"))}
                              disabled={actionId === `toggle:${pool.id}` || actionId === `delete:${pool.id}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/25 disabled:opacity-60"
                            >
                              {actionId === `delete:${pool.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Borrar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </AdmPanel>
              );
            })
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Eliminar premio"
        description={`¿Seguro que quieres borrar "${deleteTarget?.label ?? "este premio"}" de la pool? Esta acción no se puede deshacer.`}
        confirmText="Sí, borrar"
        cancelText="Cancelar"
        isLoading={Boolean(deleteTarget && actionId === `delete:${deleteTarget.id}`)}
        onCancel={() => {
          if (deleteTarget && actionId === `delete:${deleteTarget.id}`) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          void handleConfirmDeletePrize();
        }}
      />
    </div>
  );
}
