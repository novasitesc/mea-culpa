"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Store,
  Box,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  ArrowRightLeft,
  Dice6,
  Skull,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import Header from "@/app/components/header";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import { Select } from "@/components/ui/select";
import { ITEM_RARITY_OPTIONS, ITEM_TYPE_OPTIONS } from "@/lib/item-catalog";
import { RuletaTab } from "./ruleta-tab";
import {
  MAX_ACCOUNT_LEVEL,
  MIN_ACCOUNT_LEVEL,
  getAccountLevelTitle,
  normalizeAccountLevel,
} from "@/lib/accountLevel";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  gold: number;
  home: string;
  isAdmin: boolean;
  rolSistema: string;
  createdAt: string;
};

type AdminShop = {
  id: string;
  name: string;
  description: string;
  icon: string;
  keeper: string;
  location: string;
  minLevel?: number;
  itemCount: number;
  createdAt: string;
};

type AdminObject = {
  id: number;
  name: string;
  description: string;
  icon: string;
  itemType: string;
  rarity: string;
  price: number;
  bonusStats: Record<string, unknown> | null;
  createdAt: string;
};

type AdminShopItem = {
  id: number;
  tiendaId: string;
  objetoId: number;
  precio: number;
  inventario: number | null;
  orden: number;
  createdAt: string;
  object: {
    id: number;
    name: string;
    icon: string;
    itemType: string;
    rarity: string;
  };
};

type AdminTransaction = {
  id: string;
  usuario_id: string;
  nombre_usuario: string;
  nombre_admin?: string;
  delta: number;
  balance_after: number;
  concepto: string;
  creado_en: string;
};

type AdminTaxStatus =
  | "cobrado_total"
  | "cobrado_parcial_y_muerto"
  | "cobrado_parcial_sin_personaje_vivo"
  | "error";

type AdminTaxRow = {
  userId: string;
  userName: string;
  goldBefore: number;
  requestedAmount: number;
  chargedAmount: number;
  goldAfter: number;
  shortfall: number;
  status: AdminTaxStatus;
  willDie: boolean;
  deathApplied: boolean;
  targetCharacterId: number | null;
  targetCharacterName: string | null;
  targetCharacterTotalLevel: number | null;
  tieCandidates: number;
  errorMessage: string | null;
};

type AdminTaxSummary = {
  totalAccounts: number;
  totalRequested: number;
  totalCharged: number;
  totalShortfall: number;
  fullPaidCount: number;
  partialWithDeathCount: number;
  partialWithoutLivingCharacterCount: number;
  errorCount: number;
  deathsProjectedCount: number;
  deathsAppliedCount: number;
};

type DeadCharacterRow = {
  id: number;
  name: string;
  slot: number;
  userId: string;
  userName: string;
  lifeStatus: string;
  deadAt: string | null;
  revivedAt: string | null;
};

type LifeHistoryRow = {
  id: string;
  characterId: number;
  characterName: string;
  userId: string;
  userName: string;
  event: string;
  reason: string | null;
  deadAt: string | null;
  revivedAt: string | null;
  createdAt: string | null;
};

type PartidaHistoryItem = {
  characterId: number;
  objectId: number;
  objectName: string;
  objectIcon: string;
  qty: number;
};

type PartidaHistoryParticipant = {
  id: string;
  characterId: number;
  characterName: string;
  userId: string | null;
  userName: string;
  gold: number;
  comment: string;
  dead: boolean;
};

type PartidaHistoryEntry = {
  id: string;
  title: string;
  comment: string;
  status: string;
  minPlayers: number;
  maxPlayers: number;
  playerLimit: number;
  participantCount: number;
  floor: number;
  startTime: string | null;
  tier: number;
  isFull: boolean;
  isJoinable: boolean;
  createdAt: string;
  finalizedAt: string | null;
  createdBy: string | null;
  participants: PartidaHistoryParticipant[];
  items: PartidaHistoryItem[];
};

type Tab =
  | "usuarios"
  | "tiendas"
  | "objetos"
  | "transacciones"
  | "partidas"
  | "partidas-activas"
  | "historial-partidas"
  | "impuestos"
  | "ruleta"
  | "muertes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Componente Modal genérico ────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  maxWidth = "max-w-lg", // defaultw
  children,
}: {
  title: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`bg-card border border-border rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-gold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ─── Campo de formulario ──────────────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all";

// ─── Confirmación de eliminación ──────────────────────────────────────────────

function ConfirmDelete({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal title="Confirmar eliminación" onClose={onCancel}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-foreground">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-destructive hover:bg-destructive/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Toast de notificación ────────────────────────────────────────────────────

function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-60 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 ${
        type === "success"
          ? "bg-green-900/90 border border-green-700 text-green-200"
          : "bg-destructive/90 border border-destructive text-white"
      }`}
    >
      {type === "success" ? (
        <Check className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {message}
    </div>
  );
}

// ─── Pestaña Transacciones ────────────────────────────────────────────────────

function TransactionsTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filter states
  const [fConcept, setFConcept] = useState("");
  const [fDelta, setFDelta] = useState<"all" | "positive" | "negative">("all");
  const [fUser, setFUser] = useState("");
  const [fAdmin, setFAdmin] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    
    // Build query params
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    if (fConcept) params.append("concepto", fConcept);
    if (fDelta !== "all") params.append("delta", fDelta);
    if (fUser) params.append("usuario", fUser);
    if (fAdmin) params.append("admin", fAdmin);
    if (fDateFrom) params.append("dateFrom", fDateFrom);
    if (fDateTo) params.append("dateTo", fDateTo);

    const res = await fetch(`/api/admin/oro?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const result = await res.json();
      setTransactions(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.count || 0);
    } else {
      onToast("Error cargando transacciones", "error");
    }
    setLoading(false);
  }, [page, limit, fConcept, fDelta, fUser, fAdmin, fDateFrom, fDateTo, token, onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResetFilters = () => {
    setFConcept("");
    setFDelta("all");
    setFUser("");
    setFAdmin("");
    setFDateFrom("");
    setFDateTo("");
    setPage(1);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset page on filter
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <form onSubmit={handleFilterSubmit} className="bg-secondary/20 p-4 rounded-lg border border-border grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
        <FormField label="Usuario">
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fUser}
            onChange={e => setFUser(e.target.value)}
          />
        </FormField>
        <FormField label="Realizado Por">
          <input 
            type="text" 
            placeholder="Admin o 'SISTEMA'..." 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fAdmin}
            onChange={e => setFAdmin(e.target.value)}
          />
        </FormField>
        <FormField label="Concepto">
          <input 
            type="text" 
            placeholder="Ej: Recompensa..." 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fConcept}
            onChange={e => setFConcept(e.target.value)}
          />
        </FormField>
        <FormField label="Cambio">
          <Select
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fDelta}
            onChange={e => setFDelta(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="positive">Ganancias (+)</option>
            <option value="negative">Pérdidas (-)</option>
          </Select>
        </FormField>
        <FormField label="Desde">
          <input 
            type="date" 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fDateFrom}
            onChange={e => setFDateFrom(e.target.value)}
          />
        </FormField>
        <FormField label="Hasta">
          <input 
            type="date" 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fDateTo}
            onChange={e => setFDateTo(e.target.value)}
          />
        </FormField>
        <div className="flex gap-2 xl:col-span-6 justify-end mt-2">
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border"
          >
            Limpiar Filtros
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
          >
            Buscar
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} transacciones encontradas (Página {page} de {totalPages})
        </p>
        <button
          onClick={load}
          className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fecha
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Usuario
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Realizado Por
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Concepto
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cambio
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Balance Final
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-secondary/10"
                  }`}
                >
                  <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(t.creado_en).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {t.nombre_usuario}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {t.nombre_admin ? (
                      <span className="text-gold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {t.nombre_admin}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">Sistema</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground max-w-xs truncate" title={t.concepto}>
                    {t.concepto}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.delta >= 0 ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-500"}`}>
                      {t.delta >= 0 ? "+" : ""}{t.delta}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gold font-medium">
                    {t.balance_after}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No hay transacciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border border-border mt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-background hover:bg-secondary text-sm font-medium rounded-lg transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-background hover:bg-secondary text-sm font-medium rounded-lg transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pestaña Partidas ───────────────────────────────────────────────────────

function PartidasTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [playerLimit, setPlayerLimit] = useState(6);
  const [floor, setFloor] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [tier, setTier] = useState<1 | 2>(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedStartTime = startTime.trim();
    if (!trimmedTitle) {
      onToast("El nombre de la partida es obligatorio", "error");
      return;
    }

    if (!trimmedStartTime) {
      onToast("La fecha y hora de inicio son obligatorias", "error");
      return;
    }

    const parsedStartTime = new Date(trimmedStartTime);
    if (Number.isNaN(parsedStartTime.getTime())) {
      onToast("La fecha y hora de inicio no son validas", "error");
      return;
    }

    if (!Number.isFinite(playerLimit) || playerLimit < 5 || playerLimit > 6) {
      onToast("La cantidad de jugadores debe estar entre 5 y 6", "error");
      return;
    }

    if (!Number.isFinite(floor) || floor < 1 || floor > 20) {
      onToast("El piso debe estar entre 1 y 20", "error");
      return;
    }

    if (tier !== 1 && tier !== 2) {
      onToast("El tier debe ser 1 o 2", "error");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/partidas", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: trimmedTitle,
        comment: comment.trim(),
        playerLimit: Math.floor(playerLimit),
        floor: Math.floor(floor),
        startTime: parsedStartTime.toISOString(),
        tier,
      }),
    });
    setSaving(false);

    if (res.ok) {
      onToast("Partida publicada", "success");
      setTitle("");
      setComment("");
      setPlayerLimit(6);
      setFloor(1);
      setStartTime("");
      setTier(1);
    } else {
      const err = await res.json().catch(() => ({}));
      onToast(err.error ?? "Error al crear partida", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Publica una partida abierta. Los jugadores se inscriben hasta completar el cupo.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 border border-border rounded-xl p-4 bg-secondary/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Nombre de la partida">
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Asalto a la Torre"
              required
            />
          </FormField>

          <FormField label="Jugadores (mínimo 5, máximo 6)">
            <input
              type="number"
              min={5}
              max={6}
              className={inputCls}
              value={playerLimit}
              onChange={(e) => setPlayerLimit(Math.max(5, Math.min(6, Number(e.target.value) || 6)))}
            />
          </FormField>

          <FormField label="Piso (1-20)">
            <input
              type="number"
              min={1}
              max={20}
              className={inputCls}
              value={floor}
              onChange={(e) => setFloor(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </FormField>

          <FormField label="Hora de inicio">
            <input
              type="datetime-local"
              className={`${inputCls} [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:[filter:invert(1)_brightness(2)_contrast(2)]`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Tier">
            <Select
              className={inputCls}
              value={tier}
              onChange={(e) => setTier((Number(e.target.value) === 2 ? 2 : 1) as 1 | 2)}
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
            </Select>
          </FormField>

          <FormField label="Comentario (opcional)">
            <input
              className={inputCls}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notas del master"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setComment("");
              setPlayerLimit(6);
              setFloor(1);
              setStartTime("");
              setTier(1);
            }}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Limpiar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Publicar partida
          </button>
        </div>
      </form>
    </div>
  );
}

function ActivePartidasTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [games, setGames] = useState<PartidaHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [rewardTarget, setRewardTarget] = useState<PartidaHistoryEntry | null>(null);
  const [rewards, setRewards] = useState<
    Record<
      number,
      {
        gold: number;
        levelUps: number;
        items: { id: string; objectId: number | null; qty: number }[];
      }
    >
  >({});

  const rewardObjectOptions = useMemo<ObjectSelectorItem[]>(
    () =>
      objects.map((obj) => ({
        value: obj.id,
        name: obj.name,
        icon: obj.icon,
        searchText: `${obj.id} ${obj.itemType} ${obj.rarity} ${obj.price}`,
      })),
    [objects],
  );

  const createId = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

  const loadGames = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/partidas?status=activa", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setGames(await res.json());
    } else {
      onToast("Error cargando partidas activas", "error");
    }
    setLoading(false);
  }, [token, onToast]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const loadObjects = useCallback(async () => {
    if (objects.length > 0) return;
    setLoadingObjects(true);
    const res = await fetch("/api/admin/objetos", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setObjects(await res.json());
    } else {
      onToast("Error cargando objetos", "error");
    }
    setLoadingObjects(false);
  }, [objects.length, token, onToast]);

  const openCloseModal = async (entry: PartidaHistoryEntry) => {
    await loadObjects();
    const initialRewards: Record<
      number,
      { gold: number; levelUps: number; items: { id: string; objectId: number | null; qty: number }[] }
    > = {};

    for (const participant of entry.participants) {
      initialRewards[participant.characterId] = {
        gold: 0,
        levelUps: 0,
        items: [],
      };
    }

    setRewards(initialRewards);
    setRewardTarget(entry);
  };

  const updateReward = (
    characterId: number,
    updates: Partial<{ gold: number; levelUps: number }>,
  ) => {
    setRewards((prev) => ({
      ...prev,
      [characterId]: {
        ...(prev[characterId] ?? { gold: 0, levelUps: 0, items: [] }),
        ...updates,
      },
    }));
  };

  const addItemToReward = (characterId: number) => {
    setRewards((prev) => {
      const current = prev[characterId] ?? { gold: 0, levelUps: 0, items: [] };
      return {
        ...prev,
        [characterId]: {
          ...current,
          items: [
            ...current.items,
            {
              id: createId("ri"),
              objectId: null,
              qty: 1,
            },
          ],
        },
      };
    });
  };

  const updateRewardItem = (
    characterId: number,
    itemId: string,
    updates: Partial<{ objectId: number | null; qty: number }>,
  ) => {
    setRewards((prev) => {
      const current = prev[characterId] ?? { gold: 0, levelUps: 0, items: [] };
      return {
        ...prev,
        [characterId]: {
          ...current,
          items: current.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item,
          ),
        },
      };
    });
  };

  const removeRewardItem = (characterId: number, itemId: string) => {
    setRewards((prev) => {
      const current = prev[characterId] ?? { gold: 0, levelUps: 0, items: [] };
      return {
        ...prev,
        [characterId]: {
          ...current,
          items: current.items.filter((item) => item.id !== itemId),
        },
      };
    });
  };

  const closeGame = async (partidaId: string, participantRewards?: unknown[]) => {
    setClosingId(partidaId);
    const res = await fetch("/api/admin/partidas", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        partidaId,
        action: "close",
        participantRewards: participantRewards ?? [],
      }),
    });
    setClosingId(null);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      onToast(err.error ?? "No se pudo cerrar la partida", "error");
      return;
    }

    onToast("Partida cerrada", "success");
    await loadGames();
  };

  const submitCloseWithRewards = async () => {
    if (!rewardTarget) return;

    const participantRewards = rewardTarget.participants.map((participant) => {
      const reward = rewards[participant.characterId] ?? {
        gold: 0,
        levelUps: 0,
        items: [],
      };
      return {
        characterId: participant.characterId,
        gold: Math.max(0, Number(reward.gold) || 0),
        levelUps: Math.max(0, Math.floor(Number(reward.levelUps) || 0)),
        items: reward.items
          .filter((it) => it.objectId != null)
          .map((it) => ({
            objectId: Number(it.objectId),
            qty: Math.max(1, Number(it.qty) || 1),
          })),
      };
    });

    const partidaId = rewardTarget.id;
    await closeGame(partidaId, participantRewards);
    setRewardTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay partidas activas.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Partidas activas (abiertas y en progreso)
        </p>
        <button
          type="button"
          onClick={loadGames}
          className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border"
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {games.map((entry) => (
          <div
            key={entry.id}
            className="border border-border rounded-xl p-4 bg-secondary/10 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.participantCount}/{entry.maxPlayers} jugadores
                  {entry.isFull
                    ? " · Completa"
                    : entry.status === "en_progreso"
                      ? " · En progreso"
                      : " · Abierta"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Min {entry.minPlayers} · Piso {entry.floor} · Tier {entry.tier}
                  {entry.startTime
                    ? ` · Inicio ${new Date(entry.startTime).toLocaleString("es-ES")}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCloseModal(entry)}
                disabled={closingId === entry.id}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-destructive/80 hover:bg-destructive text-white disabled:opacity-60 flex items-center gap-2"
              >
                {closingId === entry.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Cerrar y asignar
              </button>
            </div>

            {entry.participants.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {entry.participants.map((p) => p.characterName).join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>

      {rewardTarget && (
        <Modal
          title={`Cerrar partida: ${rewardTarget.title}`}
          onClose={() => setRewardTarget(null)}
          maxWidth="max-w-4xl"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Asigna recompensas finales por personaje antes de cerrar la partida.
            </p>

            {loadingObjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gold" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {rewardTarget.participants.map((participant) => {
                  const reward = rewards[participant.characterId] ?? {
                    gold: 0,
                    levelUps: 0,
                    items: [],
                  };

                  return (
                    <div
                      key={participant.id}
                      className="border border-border rounded-lg p-4 bg-secondary/10 flex flex-col gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {participant.characterName}
                        </p>
                        <p className="text-xs text-muted-foreground">{participant.userName}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Oro a asignar">
                          <GoldAmountInput
                            className={inputCls}
                            value={reward.gold}
                            min={0}
                            allowZero
                            emptyWhenZero
                            onChangeValue={(value) =>
                              updateReward(participant.characterId, {
                                gold: value === "" ? 0 : Math.max(0, Number(value) || 0),
                              })
                            }
                          />
                        </FormField>

                        <FormField label="Subidas de nivel (clase principal)">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            className={inputCls}
                            value={reward.levelUps}
                            onChange={(e) =>
                              updateReward(participant.characterId, {
                                levelUps: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                              })
                            }
                          />
                        </FormField>
                      </div>

                      <div className="border-t border-border pt-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Objetos</p>
                          <button
                            type="button"
                            onClick={() => addItemToReward(participant.characterId)}
                            className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                          >
                            Agregar objeto
                          </button>
                        </div>

                        {reward.items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin objetos</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {reward.items.map((item) => (
                              <div
                                key={item.id}
                                className="grid grid-cols-1 md:grid-cols-3 gap-2"
                              >
                                <ObjectSelector
                                  className={inputCls}
                                  items={rewardObjectOptions}
                                  value={item.objectId ?? null}
                                  onChange={(selectedObjectId) =>
                                    updateRewardItem(participant.characterId, item.id, {
                                      objectId: selectedObjectId,
                                    })
                                  }
                                  searchable
                                  searchPlaceholder="Buscar objeto para recompensa..."
                                  noSearchResultsLabel="No hay coincidencias"
                                  placeholder="Selecciona objeto"
                                  emptyLabel="Sin objetos disponibles"
                                />

                                <input
                                  type="number"
                                  min={1}
                                  className={inputCls}
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateRewardItem(participant.characterId, item.id, {
                                      qty: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />

                                <button
                                  type="button"
                                  onClick={() => removeRewardItem(participant.characterId, item.id)}
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
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setRewardTarget(null)}
                className="px-4 py-2 rounded border border-border bg-secondary hover:bg-muted text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitCloseWithRewards}
                disabled={closingId === rewardTarget.id}
                className="px-4 py-2 rounded bg-destructive/80 hover:bg-destructive text-white text-sm font-semibold disabled:opacity-60"
              >
                {closingId === rewardTarget.id ? "Cerrando..." : "Cerrar y guardar recompensas"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Historial de Partidas ───────────────────────────────────────────────────

function PartidasHistoryTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [history, setHistory] = useState<PartidaHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetch("/api/admin/partidas", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setHistory(await res.json());
    } else {
      onToast("Error cargando historial de partidas", "error");
    }
    setHistoryLoading(false);
  }, [token, onToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Registro de partidas creadas
        </p>
        <button
          type="button"
          onClick={loadHistory}
          className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border"
        >
          Actualizar
        </button>
      </div>

      {historyLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gold" />
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No hay partidas registradas.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((entry) => {
            const totalGold = entry.participants.reduce(
              (sum, p) => sum + (p.gold ?? 0),
              0,
            );
            const isOpen = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className="border border-border rounded-xl p-4 bg-secondary/10"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : entry.id)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {entry.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {entry.createdBy ? ` · ${entry.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{entry.participants.length} jugadores</span>
                    <span className="text-gold">+{totalGold} oro</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-4">
                    {entry.comment && (
                      <p className="text-xs text-muted-foreground">
                        {entry.comment}
                      </p>
                    )}

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/50 border-b border-border">
                          <tr>
                            <th className="px-2 py-2 text-left">Personaje</th>
                            <th className="px-2 py-2 text-left">Usuario</th>
                            <th className="px-2 py-2 text-center">Oro</th>
                            <th className="px-2 py-2 text-left">Estado</th>
                            <th className="px-2 py-2 text-left">Comentario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.participants.map((p) => (
                            <tr key={p.id} className="border-b border-border last:border-0">
                              <td className="px-2 py-2 text-foreground">
                                {p.characterName}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {p.userName}
                              </td>
                              <td className="px-2 py-2 text-center text-gold">
                                {p.gold}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {p.dead ? "Muerto" : "Vivo"}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {p.comment || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">
                        Objetos entregados
                      </p>
                      {entry.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Sin objetos registrados
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {entry.items.map((item, idx) => (
                            <div key={`${item.objectId}-${idx}`} className="text-xs text-muted-foreground">
                              <span className="mr-2">{item.objectIcon}</span>
                              {item.objectName} x{item.qty}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Pestaña Usuarios ─────────────────────────────────────────────────────────

function UsersTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [goldTarget, setGoldTarget] = useState<AdminUser | null>(null);
  const [editCharacterTarget, setEditCharacterTarget] = useState<AdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof AdminUser>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { headers });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (field: keyof AdminUser) => {
    if (sortField === field) setSortAsc((a) => !a);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sorted = [...users].sort((a, b) => {
    const va = a[sortField] ?? "";
    const vb = b[sortField] ?? "";
    return sortAsc
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const SortIcon = ({ field }: { field: keyof AdminUser }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  const thCls =
    "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors";

  const filtered = users.filter((u) => {
    const search = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.role.toLowerCase().includes(search) ||
      u.rolSistema.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {users.length} usuario{users.length !== 1 ? "s" : ""}
        </p>
        <input
          type="text"
          placeholder="Buscar por nombre, email o rol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 rounded border border-border bg-secondary/30 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className={thCls} onClick={() => handleSort("name")}>
                  Nombre <SortIcon field="name" />
                </th>
                <th className={thCls} onClick={() => handleSort("email")}>
                  Email <SortIcon field="email" />
                </th>
                <th className={thCls} onClick={() => handleSort("role")}>
                  Gremio <SortIcon field="role" />
                </th>
                <th className={thCls} onClick={() => handleSort("level")}>
                  Nivel <SortIcon field="level" />
                </th>
                <th className={thCls} onClick={() => handleSort("gold")}>
                  Oro <SortIcon field="gold" />
                </th>
                <th className={thCls} onClick={() => handleSort("isAdmin")}>
                  Admin <SortIcon field="isAdmin" />
                </th>
                <th className={thCls} onClick={() => handleSort("createdAt")}>
                  Registro <SortIcon field="createdAt" />
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No se encontraron usuarios que coincidan con "{searchTerm}"
                  </td>
                </tr>
              ) : (
                sorted.filter((u) => filtered.includes(u)).map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-secondary/10"
                  }`}
                >
                  <td className="px-3 py-3 font-medium text-foreground">
                    {u.name}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 bg-secondary rounded text-xs text-foreground">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-foreground">
                    <span title={getAccountLevelTitle(u.level)}>
                      {normalizeAccountLevel(u.level)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gold font-medium">
                    {u.gold}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    {u.rolSistema === "super_admin" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#5d7dcf]/60 bg-[#1a2648] text-[#c8d9ff] text-[11px] font-semibold whitespace-nowrap shadow-[0_0_10px_rgba(93,125,207,0.2)]">
                        👑 super_admin
                      </span>
                    ) : u.isAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-gold/20 text-gold rounded text-[11px] font-semibold whitespace-nowrap">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-secondary text-muted-foreground rounded text-[11px] whitespace-nowrap">
                        Usuario
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => setGoldTarget(u)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-yellow-500 transition-colors"
                        title="Gestionar Oro"
                      >
                        <Coins className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditTarget(u)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Editar */}
      {editTarget && (
        <UserFormModal
          title={`Editar: ${editTarget.name}`}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          loading={actionLoading}
          onEditCharacters={() => {
            setEditCharacterTarget(editTarget);
            setEditTarget(null);
          }}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/users?id=${editTarget.id}`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Usuario actualizado", "success");
              setEditTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al actualizar", "error");
            }
          }}
        />
      )}

      {/* Modal Crear */}
      {showCreate && (
        <UserFormModal
          title="Nuevo usuario"
          initial={null}
          onClose={() => setShowCreate(false)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch("/api/admin/users", {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Usuario creado", "success");
              setShowCreate(false);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al crear", "error");
            }
          }}
        />
      )}

      {/* Modal Oro */}
      {goldTarget && (
        <GoldFormModal
          user={goldTarget}
          onClose={() => setGoldTarget(null)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/users/oro`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ userId: goldTarget.id, ...data }),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Transacción de oro exitosa", "success");
              setGoldTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al gestionar oro", "error");
            }
          }}
        />
      )}

      {/* Modal Editar Personajes */}
      {editCharacterTarget && (
        <CharactersFormModal
          user={editCharacterTarget}
          onClose={() => setEditCharacterTarget(null)}
          onToast={onToast}
          token={token}
        />
      )}

      {/* Modal Eliminar */}
      {deleteTarget && (
        <ConfirmDelete
          message={`¿Eliminar al usuario "${deleteTarget.name}" (${deleteTarget.email})? Esta acción no se puede deshacer.`}
          loading={actionLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/users?id=${deleteTarget.id}`, {
              method: "DELETE",
              headers,
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Usuario eliminado", "success");
              setDeleteTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al eliminar", "error");
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Formulario de usuario ────────────────────────────────────────────────────

function UserFormModal({
  title,
  initial,
  onClose,
  onSubmit,
  loading,
  onEditCharacters,
}: {
  title: string;
  initial: AdminUser | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminUser> & { password?: string }) => void;
  loading: boolean;
  onEditCharacters?: () => void;
}) {
  const isEdit = initial !== null;

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    // Solo se usan en creación
    email: "",
    password: "",
    // Editables siempre
    role: initial?.role ?? "",
    level: normalizeAccountLevel(initial?.level ?? MIN_ACCOUNT_LEVEL),
  });

  const set = (key: string, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      // En edición solo se envían nombre, rol y nivel
      onSubmit({
        name: form.name,
        role: form.role,
        level: normalizeAccountLevel(form.level),
      });
    } else {
      onSubmit({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        level: normalizeAccountLevel(form.level),
      });
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* En edición mostramos el email como campo informativo (solo lectura) */}
        {isEdit && (
          <div className="p-3 bg-secondary/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-0.5">Cuenta</p>
            <p className="text-sm font-medium text-foreground">
              {initial.email}
            </p>
          </div>
        )}

        <FormField label="Nombre">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre del usuario"
            required
          />
        </FormField>

        {/* Email y contraseña solo al crear */}
        {!isEdit && (
          <>
            <FormField label="Email">
              <input
                className={inputCls}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </FormField>
            <FormField label="Contraseña">
              <input
                className={inputCls}
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Contraseña"
                required
              />
            </FormField>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Gremio">
            <input
              className={inputCls}
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Ej: Shadow Dancer"
            />
          </FormField>
          <FormField label="Nivel">
            <input
              className={inputCls}
              type="number"
              min={MIN_ACCOUNT_LEVEL}
              max={MAX_ACCOUNT_LEVEL}
              value={form.level}
              onChange={(e) =>
                set("level", normalizeAccountLevel(Number(e.target.value)))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              {getAccountLevelTitle(form.level)} (niveles {MIN_ACCOUNT_LEVEL}-{MAX_ACCOUNT_LEVEL})
            </p>
          </FormField>
        </div>

        {/* El toggle de Admin está reservado para SUPER_ADMIN (próximamente) */}

        <div className="flex gap-3 justify-end pt-2 border-t border-border">
          {isEdit && onEditCharacters && (
            <button
              type="button"
              onClick={onEditCharacters}
              className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors"
            >
              Editar Personajes
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Formulario de Oro ────────────────────────────────────────────────────────

function GoldFormModal({
  user,
  onClose,
  onSubmit,
  loading,
}: {
  user: AdminUser;
  onClose: () => void;
  onSubmit: (data: { amount: number; reason: string; action: "add" | "remove" }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"add" | "remove">("add");

  return (
    <Modal title={`Gestionar Oro: ${user.name}`} onClose={onClose}>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Oro actual: <span className="text-gold font-bold">{user.gold}</span></p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amountNum = amount === "" ? 0 : Number(amount);
          onSubmit({ amount: amountNum, reason, action });
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex bg-secondary/50 p-1 rounded-xl w-full border border-border">
          <button
            type="button"
            onClick={() => setAction("add")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              action === "add"
                ? "bg-gold text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Añadir Oro
          </button>
          <button
            type="button"
            onClick={() => setAction("remove")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              action === "remove"
                ? "bg-destructive text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Quitar Oro
          </button>
        </div>

        <FormField label="Cantidad">
          <GoldAmountInput
            className={inputCls}
            value={amount}
            onChangeValue={setAmount}
            min={1}
            allowZero={false}
            required
          />
        </FormField>
        <FormField label="Motivo (opcional)">
          <input
            type="text"
            className={inputCls}
            placeholder="Recompensa, ajuste, etc..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !amount || Number(amount) <= 0}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal para Editar Personajes ────────────────────────────────────────────

type Character = {
  id: number;
  nombre: string;
  raza: string;
  clases: Array<{
    nombre_clase: string;
    nivel: number;
  }>;
  estadisticas: {
    fuerza: number;
    destreza: number;
    constitucion: number;
    inteligencia: number;
    sabiduria: number;
    carisma: number;
  } | null;
};

function CharactersFormModal({
  user,
  onClose,
  onToast,
  token,
}: {
  user: AdminUser;
  onClose: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
  token: string;
}) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingChar, setEditingChar] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    raza: string;
    clases: Array<{ nombre_clase: string; nivel: number }>;
    estadisticas: {
      fuerza: number;
      destreza: number;
      constitucion: number;
      inteligencia: number;
      sabiduria: number;
      carisma: number;
    };
  } | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const res = await fetch(`/api/admin/characters?userId=${user.id}`, { headers });
        if (res.ok) {
          setCharacters(await res.json());
        } else {
          onToast("Error al cargar personajes", "error");
        }
      } catch (error) {
        onToast("Error al cargar personajes", "error");
      } finally {
        setLoading(false);
      }
    };
    loadCharacters();
  }, [user.id, token, headers, onToast]);

  const saveCharacter = async (characterId: number) => {
    if (!editForm) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/characters", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          raza: editForm.raza,
          clases: editForm.clases,
          estadisticas: editForm.estadisticas,
        }),
      });

      if (res.ok) {
        onToast("Personaje actualizado", "success");
        setEditingChar(null);
        setEditForm(null);
        // Recargar personajes
        const charsRes = await fetch(`/api/admin/characters?userId=${user.id}`, { headers });
        if (charsRes.ok) {
          setCharacters(await charsRes.json());
        }
      } else {
        const e = await res.json();
        onToast(e.error ?? "Error al guardar", "error");
      }
    } catch (error) {
      onToast("Error al guardar personaje", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Personajes de ${user.name}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
          </div>
        ) : characters.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Este usuario no tiene personajes
          </p>
        ) : (
          <>
            {characters.map((character) => (
              <div
                key={character.id}
                className="p-4 rounded border border-border bg-secondary/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    {character.nombre}
                  </h3>
                  {editingChar !== character.id && (
                    <button
                      onClick={() => {
                        setEditingChar(character.id);
                        setEditForm({
                          raza: character.raza,
                          clases: character.clases,
                          estadisticas: character.estadisticas || {
                            fuerza: 10,
                            destreza: 10,
                            constitucion: 10,
                            inteligencia: 10,
                            sabiduria: 10,
                            carisma: 10,
                          },
                        });
                      }}
                      className="px-3 py-1.5 bg-gold hover:bg-gold-dim text-background text-xs rounded transition-colors"
                    >
                      Editar
                    </button>
                  )}
                </div>

                {editingChar === character.id && editForm ? (
                  <div className="space-y-3">
                    {/* Raza */}
                    <FormField label="Raza">
                      <input
                        type="text"
                        value={editForm.raza}
                        onChange={(e) =>
                          setEditForm({ ...editForm, raza: e.target.value })
                        }
                        className={inputCls}
                        placeholder="Ej: Elfo, Humano, etc."
                      />
                    </FormField>

                    {/* Clases y Niveles */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Clases
                      </label>
                      <div className="space-y-2">
                        {editForm.clases.map((clase, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-sm text-foreground min-w-25">
                              {clase.nombre_clase}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                Nv.
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={clase.nivel}
                                onChange={(e) => {
                                  const newClases = [...editForm.clases];
                                  newClases[idx].nivel = Math.max(
                                    1,
                                    Math.min(20, Number(e.target.value))
                                  );
                                  setEditForm({ ...editForm, clases: newClases });
                                }}
                                className={`${inputCls} w-16`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Estadísticas */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Puntos de Habilidad
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(editForm.estadisticas).map(([stat, value]) => (
                          <FormField key={stat} label={stat.charAt(0).toUpperCase() + stat.slice(1)}>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={value}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  estadisticas: {
                                    ...editForm.estadisticas,
                                    [stat]: Math.max(1, Math.min(30, Number(e.target.value))),
                                  },
                                })
                              }
                              className={inputCls}
                            />
                          </FormField>
                        ))}
                      </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-2 justify-end pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingChar(null);
                          setEditForm(null);
                        }}
                        className="px-3 py-1.5 bg-secondary hover:bg-muted rounded text-sm font-medium text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => saveCharacter(character.id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-gold hover:bg-gold-dim text-background rounded text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
                      >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Raza: {character.raza}</p>
                    <p>
                      Clases:{" "}
                      {character.clases
                        .map((c) => `${c.nombre_clase} (Nv.${c.nivel})`)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Botón cerrar */}
        <div className="flex justify-end pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Pestaña Tiendas ──────────────────────────────────────────────────────────

function ShopsTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AdminShop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShop | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [itemsTarget, setItemsTarget] = useState<AdminShop | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tiendas", { headers });
    if (res.ok) setShops(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {shops.length} tienda{shops.length !== 1 ? "s" : ""} registrada
          {shops.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva tienda
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-gold/40 transition-colors"
            >
              {/* Cabecera de tarjeta */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{shop.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">
                      {shop.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shop.keeper}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setItemsTarget(shop)}
                    className="h-7 px-3 flex items-center justify-center rounded bg-gold/20 text-gold hover:bg-gold hover:text-background transition-colors text-xs font-bold shadow-sm"
                    title="Gestionar objetos"
                  >
                    Items
                  </button>
                  <button
                    onClick={() => setEditTarget(shop)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(shop)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Descripción */}
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {shop.description}
              </p>

              {/* Footer de tarjeta */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
                <span>📍 {shop.location}</span>
                <div className="flex items-center gap-2">
                  {shop.minLevel && (
                    <span className="px-1.5 py-0.5 bg-gold/10 text-gold rounded">
                      Nv. {shop.minLevel}+
                    </span>
                  )}
                  <span>{shop.itemCount} items</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Editar */}
      {editTarget && (
        <ShopFormModal
          title={`Editar: ${editTarget.name}`}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/tiendas?id=${editTarget.id}`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Tienda actualizada", "success");
              setEditTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al actualizar", "error");
            }
          }}
        />
      )}

      {/* Modal Crear */}
      {showCreate && (
        <ShopFormModal
          title="Nueva tienda"
          initial={null}
          onClose={() => setShowCreate(false)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch("/api/admin/tiendas", {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Tienda creada", "success");
              setShowCreate(false);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al crear", "error");
            }
          }}
        />
      )}

      {/* Modal Eliminar */}
      {deleteTarget && (
        <ConfirmDelete
          message={`¿Eliminar la tienda "${deleteTarget.name}"? Se perderán todos sus datos.`}
          loading={actionLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setActionLoading(true);
            const res = await fetch(
              `/api/admin/tiendas?id=${deleteTarget.id}`,
              {
                method: "DELETE",
                headers,
              },
            );
            setActionLoading(false);
            if (res.ok) {
              onToast("Tienda eliminada", "success");
              setDeleteTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al eliminar", "error");
            }
          }}
        />
      )}

      {itemsTarget && (
        <ShopItemsModal
          shop={itemsTarget}
          token={token}
          onClose={() => setItemsTarget(null)}
          onToast={onToast}
          refreshShops={load}
        />
      )}
    </div>
  );
}

// ─── Formulario de tienda ─────────────────────────────────────────────────────

function ShopFormModal({
  title,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  title: string;
  initial: AdminShop | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminShop>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    icon: initial?.icon ?? "🏪",
    keeper: initial?.keeper ?? "",
    location: initial?.location ?? "",
    minLevel: initial?.minLevel ?? "",
  });

  const set = (key: string, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    if (!payload.minLevel) delete payload.minLevel;
    else payload.minLevel = Number(payload.minLevel);
    onSubmit(payload);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[auto_1fr] gap-4 items-end">
          <FormField label="Icono">
            <input
              className={`${inputCls} w-16 text-center text-xl`}
              value={form.icon}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="🏪"
              maxLength={4}
            />
          </FormField>
          <FormField label="Nombre de la tienda">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="La Fragua del Oso"
              required
            />
          </FormField>
        </div>
        <FormField label="Descripción">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Descripción de la tienda..."
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tendero / Vendedor">
            <input
              className={inputCls}
              value={form.keeper}
              onChange={(e) => set("keeper", e.target.value)}
              placeholder="Nombre del tendero"
              required
            />
          </FormField>
          <FormField label="Ubicación">
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Barrio del Artesano"
              required
            />
          </FormField>
        </div>
        <FormField label="Nivel mínimo de acceso (opcional)">
          <input
            className={inputCls}
            type="number"
            min={1}
            max={99}
            value={form.minLevel}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d+$/.test(val)) {
                set("minLevel", val);
              }
            }}
            placeholder="Sin restricción"
          />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? "Guardar cambios" : "Crear tienda"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ShopItemsModal({
  shop,
  token,
  onClose,
  onToast,
  refreshShops,
}: {
  shop: AdminShop;
  token: string;
  onClose: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
  refreshShops: () => Promise<void>;
}) {
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminShopItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShopItem | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, objectsRes] = await Promise.all([
      fetch(`/api/admin/tiendas/articulos?tiendaId=${shop.id}`, { headers }),
      fetch("/api/admin/objetos", { headers }),
    ]);

    if (itemsRes.ok) setItems(await itemsRes.json());
    if (objectsRes.ok) setObjects(await objectsRes.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal title={`Objetos de tienda: ${shop.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {items.length} artículo{items.length !== 1 ? "s" : ""} configurado
            {items.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={objects.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-gold hover:bg-gold-dim text-background text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir objeto
          </button>
        </div>

        {objects.length === 0 && (
          <p className="text-xs text-destructive">
            No hay objetos en catálogo. Crea primero un objeto en la pestaña Objetos.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gold" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Esta tienda no tiene objetos configurados aún.
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-2 py-2 text-left">Objeto</th>
                  <th className="px-2 py-2 text-left">Tipo</th>
                  <th className="px-2 py-2 text-left">Precio</th>
                  <th className="px-2 py-2 text-left">Stock</th>
                  <th className="px-2 py-2 text-left">Orden</th>
                  <th className="px-2 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span>{item.object?.icon ?? "📦"}</span>
                        <span className="font-medium text-foreground">
                          {item.object?.name ?? `Objeto #${item.objetoId}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground capitalize">
                      {item.object?.itemType ?? "-"}
                    </td>
                    <td className="px-2 py-2 text-foreground">{item.precio}</td>
                    <td className="px-2 py-2 text-foreground">
                      {item.inventario ?? "Ilimitado"}
                    </td>
                    <td className="px-2 py-2 text-foreground">{item.orden}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditTarget(item)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                          title="Editar artículo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar artículo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {createOpen && (
        <ShopItemFormModal
          mode="create"
          objects={objects}
          loading={actionLoading}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (payload) => {
            setActionLoading(true);
            const res = await fetch("/api/admin/tiendas/articulos", {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, tiendaId: shop.id }),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Artículo añadido a la tienda", "success");
              setCreateOpen(false);
              await load();
              await refreshShops();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al añadir artículo", "error");
            }
          }}
        />
      )}

      {editTarget && (
        <ShopItemFormModal
          mode="edit"
          objects={objects}
          initial={editTarget}
          loading={actionLoading}
          onClose={() => setEditTarget(null)}
          onSubmit={async (payload) => {
            setActionLoading(true);
            const res = await fetch(
              `/api/admin/tiendas/articulos?id=${editTarget.id}`,
              {
                method: "PATCH",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
            setActionLoading(false);
            if (res.ok) {
              onToast("Artículo actualizado", "success");
              setEditTarget(null);
              await load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al actualizar artículo", "error");
            }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          message={`¿Quitar "${deleteTarget.object?.name ?? `#${deleteTarget.objetoId}`}" de la tienda?`}
          loading={actionLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setActionLoading(true);
            const res = await fetch(
              `/api/admin/tiendas/articulos?id=${deleteTarget.id}`,
              {
                method: "DELETE",
                headers,
              },
            );
            setActionLoading(false);
            if (res.ok) {
              onToast("Artículo eliminado de la tienda", "success");
              setDeleteTarget(null);
              await load();
              await refreshShops();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al eliminar artículo", "error");
            }
          }}
        />
      )}
    </Modal>
  );
}

function ShopItemFormModal({
  mode,
  objects,
  initial,
  loading,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  objects: AdminObject[];
  initial?: AdminShopItem;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: {
    objetoId?: number;
    inventario: number | null;
    orden: number;
  }) => void;
}) {
  const [invalidObjectAlertId, setInvalidObjectAlertId] = useState(0);
  const [objetoId, setObjetoId] = useState<number | null>(
    initial?.objetoId ?? objects[0]?.id ?? null,
  );

  const objectOptions = useMemo<ObjectSelectorItem[]>(
    () =>
      objects.map((obj) => ({
        value: obj.id,
        name: obj.name,
        icon: obj.icon,
        searchText: `${obj.id} ${obj.itemType} ${obj.price}`,
      })),
    [objects],
  );

  const [inventarioRaw, setInventarioRaw] = useState<string>(
    initial?.inventario === null || initial?.inventario === undefined
      ? ""
      : String(initial.inventario),
  );
  const [orden, setOrden] = useState<string>(
    initial?.orden || initial?.orden === 0 ? String(initial.orden) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "create" && objetoId == null) {
      setInvalidObjectAlertId((prev) => prev + 1);
      return;
    }

    const inventario =
      inventarioRaw.trim() === "" ? null : Number(inventarioRaw.trim());
    const ordenNum = orden.trim() === "" ? 0 : Number(orden.trim());

    onSubmit({
      ...(mode === "create" ? { objetoId: Number(objetoId) } : {}),
      inventario,
      orden: ordenNum,
    });
  };

  const selectedObject = objects.find((o) => o.id === objetoId);

  return (
    <>
      <FantasyAlert
        key={invalidObjectAlertId}
        open={invalidObjectAlertId > 0}
        title="Objeto requerido"
        message="Selecciona un objeto válido"
        variant="warning"
        onClose={() => setInvalidObjectAlertId(0)}
      />

      <Modal
        title={mode === "create" ? "Añadir artículo a tienda" : "Editar artículo"}
        maxWidth="max-w-2xl"
        onClose={onClose}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-visible">
        {mode === "create" && (
          <FormField label="Objeto">
            <div className="flex flex-col gap-2">
              <ObjectSelector
                className={inputCls}
                items={objectOptions}
                value={objetoId}
                onChange={setObjetoId}
                searchable
                searchPlaceholder="Buscar por nombre, ID o tipo..."
                placeholder="Selecciona objeto del catálogo"
                emptyLabel="No hay objetos en catálogo"
              />
              {selectedObject ? (
                <p className="text-xs text-muted-foreground">
                  Seleccionado: {selectedObject.icon} {selectedObject.name} ({selectedObject.itemType})
                </p>
              ) : null}
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Stock (vacío=ilimitado)">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={inventarioRaw}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d+$/.test(val)) {
                  setInventarioRaw(val);
                }
              }}
              placeholder="∞"
            />
          </FormField>
          <FormField label="Orden">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={orden}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d+$/.test(val)) {
                  setOrden(val);
                }
              }}
            />
          </FormField>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || (mode === "create" && objects.length === 0)}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? "Añadir" : "Guardar"}
          </button>
        </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Pestaña Objetos ──────────────────────────────────────────────────────────

function ObjectsTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AdminObject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminObject | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/objetos", { headers });
    if (res.ok) setObjects(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredObjects = useMemo(() => {
    if (!normalizedQuery) return objects;

    return objects.filter((obj) => {
      const haystack = [
        String(obj.id),
        obj.name,
        obj.itemType,
        obj.rarity,
        obj.description,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [objects, normalizedQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredObjects.length} de {objects.length} objeto{objects.length !== 1 ? "s" : ""} en catálogo
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo objeto
        </button>
      </div>

      <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, tipo, rareza, descripción o ID..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredObjects.map((obj) => (
            <div
              key={obj.id}
              className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{obj.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">
                      {obj.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {obj.itemType}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditTarget(obj)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(obj)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {obj.description || "Sin descripción"}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-gold/10 text-gold rounded capitalize">
                    {obj.rarity}
                  </span>
                  <span className="text-gold">{obj.price.toLocaleString()} 🪙</span>
                </div>
                <span>{formatDate(obj.createdAt)}</span>
              </div>
            </div>
          ))}
          {filteredObjects.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3 rounded-lg border border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
              No se encontraron objetos para "{searchQuery}".
            </div>
          )}
        </div>
      )}

      {editTarget && (
        <ObjectFormModal
          title={`Editar: ${editTarget.name}`}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/objetos?id=${editTarget.id}`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Objeto actualizado", "success");
              setEditTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al actualizar", "error");
            }
          }}
        />
      )}

      {showCreate && (
        <ObjectFormModal
          title="Nuevo objeto"
          initial={null}
          onClose={() => setShowCreate(false)}
          loading={actionLoading}
          onSubmit={async (data) => {
            setActionLoading(true);
            const res = await fetch("/api/admin/objetos", {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Objeto creado", "success");
              setShowCreate(false);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al crear", "error");
            }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          message={`¿Eliminar el objeto "${deleteTarget.name}"?`}
          loading={actionLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setActionLoading(true);
            const res = await fetch(`/api/admin/objetos?id=${deleteTarget.id}`, {
              method: "DELETE",
              headers,
            });
            setActionLoading(false);
            if (res.ok) {
              onToast("Objeto eliminado", "success");
              setDeleteTarget(null);
              load();
            } else {
              const e = await res.json();
              onToast(e.error ?? "Error al eliminar", "error");
            }
          }}
        />
      )}
    </div>
  );
}

function ObjectFormModal({
  title,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  title: string;
  initial: AdminObject | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminObject>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    icon: initial?.icon ?? "📦",
    itemType: initial?.itemType ?? "misc",
    rarity: initial?.rarity ?? "común",
    price: initial?.price ? String(initial.price) : "",
    bonusStats: initial?.bonusStats
      ? JSON.stringify(initial.bonusStats, null, 2)
      : "",
  });
  const [jsonError, setJsonError] = useState("");

  const set = (key: string, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let parsedBonus: Record<string, unknown> | null = null;
    if (form.bonusStats.trim()) {
      try {
        parsedBonus = JSON.parse(form.bonusStats);
        setJsonError("");
      } catch {
        setJsonError("El JSON de bonos no es válido");
        return;
      }
    }

    const priceNum = form.price === "" ? 0 : Number(form.price);

    onSubmit({
      name: form.name,
      description: form.description,
      icon: form.icon,
      itemType: form.itemType,
      rarity: form.rarity,
      price: priceNum,
      bonusStats: parsedBonus,
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[auto_1fr] gap-4 items-end">
          <FormField label="Icono">
            <input
              className={`${inputCls} w-16 text-center text-xl`}
              value={form.icon}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="📦"
              maxLength={4}
            />
          </FormField>
          <FormField label="Nombre del objeto">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Espada larga"
              required
            />
          </FormField>
        </div>

        <FormField label="Descripción">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Descripción del objeto"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Tipo de objeto">
            <Select
              className={inputCls}
              value={form.itemType}
              onChange={(e) => set("itemType", e.target.value)}
            >
              {ITEM_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Rareza">
            <Select
              className={inputCls}
              value={form.rarity}
              onChange={(e) => set("rarity", e.target.value)}
            >
              {ITEM_RARITY_OPTIONS.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {rarity}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Precio base">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d+$/.test(val)) {
                  set("price", val === "" ? "" : Number(val));
                }
              }}
              required
            />
          </FormField>
        </div>

        <FormField label="Bonos (JSON opcional)">
          <textarea
            className={`${inputCls} resize-none font-mono text-xs`}
            rows={5}
            value={form.bonusStats}
            onChange={(e) => set("bonusStats", e.target.value)}
            placeholder='{"fuerza": 2, "destreza": 1}'
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </FormField>

        <div className="flex gap-3 justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? "Guardar cambios" : "Crear objeto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaxesTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<AdminTaxRow[]>([]);
  const [summary, setSummary] = useState<AdminTaxSummary | null>(null);
  const [resultMode, setResultMode] = useState<"preview" | "apply" | null>(null);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);

  const parsedAmount = useMemo(() => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return null;
    const integer = Math.floor(numeric);
    return integer > 0 ? integer : null;
  }, [amount]);

  const hasFreshPreview = useMemo(
    () => parsedAmount !== null && previewAmount === parsedAmount,
    [parsedAmount, previewAmount],
  );

  const loadPreview = useCallback(async () => {
    if (!parsedAmount) {
      onToast("Ingresa un monto de impuesto válido", "error");
      return;
    }

    setLoadingPreview(true);
    const res = await fetch("/api/admin/impuestos/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: parsedAmount }),
    });

    setLoadingPreview(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onToast(data.error ?? "No se pudo generar la vista previa", "error");
      return;
    }

    const data = await res.json();
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setResultMode(data.mode === "apply" ? "apply" : "preview");
    setPreviewAmount(parsedAmount);
    onToast("Vista previa generada", "success");
  }, [parsedAmount, token, onToast]);

  const applyTax = useCallback(async () => {
    if (!parsedAmount) {
      onToast("Ingresa un monto de impuesto válido", "error");
      return;
    }

    if (!hasFreshPreview) {
      onToast("Debes generar vista previa del monto actual antes de cobrar", "error");
      return;
    }

    setLoadingApply(true);
    const res = await fetch("/api/admin/impuestos/cobrar", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: parsedAmount }),
    });

    setLoadingApply(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onToast(data.error ?? "No se pudo aplicar el impuesto", "error");
      return;
    }

    const data = await res.json();
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setResultMode(data.mode === "preview" ? "preview" : "apply");
    const totalCharged = Number(data?.summary?.totalCharged ?? 0);
    const deathsApplied = Number(data?.summary?.deathsAppliedCount ?? 0);
    onToast(
      `Cobro ejecutado. Oro cobrado: ${totalCharged}. Muertes aplicadas: ${deathsApplied}.`,
      "success",
    );
  }, [parsedAmount, hasFreshPreview, token, onToast]);

  useEffect(() => {
    if (!amount.trim()) {
      setPreviewAmount(null);
      setResultMode(null);
      setRows([]);
      setSummary(null);
      return;
    }

    const numeric = Number(amount);
    const current = Number.isFinite(numeric) ? Math.floor(numeric) : null;
    if (current === null || current <= 0 || current !== previewAmount) {
      setPreviewAmount(null);
      setResultMode(null);
      setRows([]);
      setSummary(null);
    }
  }, [amount, previewAmount]);

  const statusLabel = (status: AdminTaxStatus) => {
    if (status === "cobrado_total") return "Cobrado total";
    if (status === "cobrado_parcial_y_muerto") return "Cobrado parcial + muerte";
    if (status === "cobrado_parcial_sin_personaje_vivo") {
      return "Cobrado parcial sin personaje vivo";
    }
    return "Error";
  };

  const statusClass = (status: AdminTaxStatus) => {
    if (status === "cobrado_total") return "bg-green-900/30 text-green-300";
    if (status === "cobrado_parcial_y_muerto") return "bg-orange-900/30 text-orange-300";
    if (status === "cobrado_parcial_sin_personaje_vivo") {
      return "bg-amber-900/30 text-amber-300";
    }
    return "bg-destructive/30 text-destructive";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-secondary/20 p-4 rounded-lg border border-border flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gold">Cobrar Impuestos Globales</h3>
        <p className="text-sm text-muted-foreground">
          Se cobrará el mismo monto a todas las cuentas de jugadores y admins. Si una cuenta no
          alcanza, se cobra todo su oro disponible y muere su personaje vivo de mayor nivel total.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_1fr] gap-4 items-end">
          <FormField label="Monto fijo de impuesto">
            <GoldAmountInput
              className={inputCls}
              value={amount}
              onChangeValue={setAmount}
              min={1}
              required
              placeholder="Ej: 50"
            />
          </FormField>

          <div className="flex gap-3 md:justify-end">
            <button
              type="button"
              onClick={loadPreview}
              disabled={loadingPreview || loadingApply}
              className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border disabled:opacity-60 flex items-center gap-2"
            >
              {loadingPreview && <Loader2 className="w-4 h-4 animate-spin" />}
              Vista previa
            </button>
            <button
              type="button"
              onClick={applyTax}
              disabled={loadingPreview || loadingApply || !parsedAmount || !hasFreshPreview}
              className="px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {loadingApply && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar cobro
            </button>
          </div>
        </div>

        {parsedAmount && !hasFreshPreview && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-900/20 p-3 flex items-center gap-2 text-amber-200 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Debes generar una vista previa del monto actual antes de confirmar el cobro.
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-secondary/15 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cuentas</p>
            <p className="text-lg font-semibold text-foreground">{summary.totalAccounts}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/15 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Oro cobrado</p>
            <p className="text-lg font-semibold text-gold">{summary.totalCharged}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/15 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Faltante total</p>
            <p className="text-lg font-semibold text-orange-300">{summary.totalShortfall}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/15 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {resultMode === "preview" ? "Muertes proyectadas" : "Muertes aplicadas"}
            </p>
            <p className="text-lg font-semibold text-destructive">
              {resultMode === "preview"
                ? summary.deathsProjectedCount
                : summary.deathsAppliedCount}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Jugador</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Oro antes</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Impuesto</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Cobrado</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Oro final</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Personaje afectado</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.userId}-${idx}`}
                className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}
              >
                <td className="px-3 py-3 font-medium text-foreground">{row.userName}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{row.goldBefore}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{row.requestedAmount}</td>
                <td className="px-3 py-3 text-center text-gold font-medium">{row.chargedAmount}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{row.goldAfter}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {row.targetCharacterName ? (
                    <span>
                      {row.targetCharacterName} (Nv. {row.targetCharacterTotalLevel ?? 0})
                      {row.tieCandidates > 1 ? " · empate al azar" : ""}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/70">Sin personaje vivo</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                  {row.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{row.errorMessage}</p>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Genera una vista previa para ver el impacto del cobro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeadCharactersTab({
  token,
  onToast,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [view, setView] = useState<"actuales" | "historial">("actuales");
  const [search, setSearch] = useState("");
  const [deadRows, setDeadRows] = useState<DeadCharacterRow[]>([]);
  const [historyRows, setHistoryRows] = useState<LifeHistoryRow[]>([]);
  const [loadingDead, setLoadingDead] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const loadCurrentDead = useCallback(async () => {
    setLoadingDead(true);
    const res = await fetch("/api/admin/personajes/muertos?limit=300", {
      headers: { Authorization: `Bearer ${token}` },
    });

    setLoadingDead(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onToast(data.error ?? "No se pudo cargar personajes muertos", "error");
      return;
    }

    const data = await res.json();
    setDeadRows(data.data ?? []);
  }, [token, onToast]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const params = new URLSearchParams({
      page: String(historyPage),
      limit: "30",
    });

    const res = await fetch(`/api/admin/personajes/muertes-historial?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    setLoadingHistory(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onToast(data.error ?? "No se pudo cargar historial de muertes", "error");
      return;
    }

    const data = await res.json();
    setHistoryRows(data.data ?? []);
    setHistoryTotalPages(Math.max(1, Number(data.totalPages ?? 1)));
  }, [historyPage, token, onToast]);

  useEffect(() => {
    loadCurrentDead();
  }, [loadCurrentDead]);

  useEffect(() => {
    if (view === "historial") {
      loadHistory();
    }
  }, [view, loadHistory]);

  const searchTerm = search.trim().toLowerCase();

  const filteredDeadRows = useMemo(() => {
    if (!searchTerm) return deadRows;
    return deadRows.filter((row) => {
      const haystack = `${row.name} ${row.userName}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [deadRows, searchTerm]);

  const filteredHistoryRows = useMemo(() => {
    if (!searchTerm) return historyRows;
    return historyRows.filter((row) => {
      const haystack = `${row.characterName} ${row.userName} ${row.reason ?? ""}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [historyRows, searchTerm]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("actuales")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              view === "actuales"
                ? "bg-gold/20 border-gold/50 text-gold"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Muertos actuales
          </button>
          <button
            type="button"
            onClick={() => {
              setHistoryPage(1);
              setView("historial");
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              view === "historial"
                ? "bg-gold/20 border-gold/50 text-gold"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Historial completo
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar personaje o jugador"
            className="w-64 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <button
            type="button"
            onClick={view === "actuales" ? loadCurrentDead : loadHistory}
            className="px-4 py-2 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border"
          >
            Actualizar
          </button>
        </div>
      </div>

      {view === "actuales" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          {loadingDead ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Personaje</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Jugador</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Slot</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Murió</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Revivió</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeadRows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                    <td className="px-3 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.userName}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{row.slot}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.deadAt)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.revivedAt)}</td>
                  </tr>
                ))}
                {filteredDeadRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No hay personajes muertos en este momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === "historial" && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gold" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Fecha evento</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Personaje</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Jugador</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Evento</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Motivo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Murió</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Revivió</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryRows.map((row, idx) => (
                    <tr key={row.id} className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-secondary/10" : ""}`}>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{row.characterName}</td>
                      <td className="px-3 py-3 text-muted-foreground">{row.userName}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${row.event === "muerto" ? "bg-destructive/25 text-destructive" : "bg-green-900/30 text-green-300"}`}>
                          {row.event === "muerto" ? "Muerto" : "Revivido"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{row.reason ?? "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.deadAt)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.revivedAt)}</td>
                    </tr>
                  ))}
                  {filteredHistoryRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        No hay eventos de historial para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {historyPage} de {historyTotalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1 || loadingHistory}
                className="px-3 py-1.5 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage >= historyTotalPages || loadingHistory}
                className="px-3 py-1.5 bg-secondary hover:bg-muted text-sm font-medium rounded-lg transition-colors border border-border disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal del panel ───────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading, token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Redirigir si no está autenticado o no es admin
  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    },
    [],
  );

  // Mientras se verifica el auth
  if (isLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const isSuperAdmin = user.rolSistema === "super_admin";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "usuarios", label: "Usuarios", icon: Users },
    { id: "tiendas", label: "Tiendas", icon: Store },
    { id: "objetos", label: "Objetos", icon: Box },
    { id: "transacciones", label: "Transacciones", icon: ArrowRightLeft },
    { id: "ruleta", label: "Ruleta", icon: Dice6 },
    { id: "muertes", label: "Personajes Muertos", icon: Skull },
    { id: "partidas", label: "Publicar Partida", icon: Shield },
    { id: "partidas-activas", label: "Partidas Activas", icon: Shield },
    { id: "historial-partidas", label: "Historial", icon: Shield },
  ];

  if (isSuperAdmin) {
    tabs.splice(4, 0, {
      id: "impuestos",
      label: "Cobrar Impuestos",
      icon: Coins,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fondo textura */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto p-4 flex flex-col gap-6">
        <Header />

        {/* Cabecera del panel */}
        <div className="bg-card border border-border rounded-xl p-6 medieval-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gold/20 border border-gold/40 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gold tracking-wide">
                Panel de Administrador
              </h1>
              <p className="text-sm text-muted-foreground">
                Bienvenido,{" "}
                <span className="text-foreground font-medium">{user.name}</span>{" "}
                · Gestión del servidor Mea Culpa
              </p>
            </div>
          </div>
        </div>

        {/* Contenedor principal con tabs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-border overflow-x-auto overflow-y-hidden admin-tabs-scroll">
            <div className="flex min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
                    activeTab === tab.id
                      ? "border-gold text-gold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido de pestaña */}
          <div className="p-6">
            {activeTab === "usuarios" && (
              <UsersTab token={token} onToast={showToast} />
            )}
            {activeTab === "tiendas" && (
              <ShopsTab token={token} onToast={showToast} />
            )}
            {activeTab === "objetos" && (
              <ObjectsTab token={token} onToast={showToast} />
            )}
            {activeTab === "transacciones" && (
              <TransactionsTab token={token} onToast={showToast} />
            )}
            {activeTab === "ruleta" && (
              <RuletaTab token={token} onToast={showToast} isSuperAdmin={isSuperAdmin} />
            )}
            {isSuperAdmin && activeTab === "impuestos" && (
              <TaxesTab token={token} onToast={showToast} />
            )}
            {activeTab === "muertes" && (
              <DeadCharactersTab token={token} onToast={showToast} />
            )}
            {activeTab === "partidas" && (
              <PartidasTab token={token} onToast={showToast} />
            )}
            {activeTab === "partidas-activas" && (
              <ActivePartidasTab token={token} onToast={showToast} />
            )}
            {activeTab === "historial-partidas" && (
              <PartidasHistoryTab token={token} onToast={showToast} />
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </div>
  );
}
