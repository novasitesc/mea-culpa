"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import Header from "@/app/components/header";

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

type AdminCharacter = {
  id: number;
  name: string;
  slot: number;
  userId: string;
  userName: string;
};

type PartidaItemDraft = {
  id: string;
  objectId: number | "";
  qty: number;
};

type PartidaParticipantDraft = {
  id: string;
  characterId: number | "";
  gold: number;
  comment: string;
  dead: boolean;
  items: PartidaItemDraft[];
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
  createdAt: string;
  finalizedAt: string | null;
  createdBy: string | null;
  participants: PartidaHistoryParticipant[];
  items: PartidaHistoryItem[];
};

const ITEM_TYPES = [
  "cabeza",
  "pecho",
  "guante",
  "botas",
  "collar",
  "anillo",
  "amuleto",
  "arma",
  "consumible",
  "ingrediente",
  "misc",
];

const RARITY_OPTIONS = ["común", "poco común", "raro", "épico", "legendario"];

type Tab =
  | "usuarios"
  | "tiendas"
  | "objetos"
  | "transacciones"
  | "partidas"
  | "historial-partidas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Componente Modal genérico ────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  maxWidth = "max-w-lg", // default
  children,
}: {
  title: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`bg-card border border-border rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-visible`}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-gold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
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
          <select 
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            value={fDelta}
            onChange={e => setFDelta(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="positive">Ganancias (+)</option>
            <option value="negative">Pérdidas (-)</option>
          </select>
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
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [objects, setObjects] = useState<AdminObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [participants, setParticipants] = useState<PartidaParticipantDraft[]>([
    {
      id: "p-1",
      characterId: "",
      gold: 0,
      comment: "",
      dead: false,
      items: [],
    },
  ]);

  const createId = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

  const loadOptions = useCallback(async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const [charsRes, objsRes] = await Promise.all([
      fetch("/api/admin/personajes", { headers }),
      fetch("/api/admin/objetos", { headers }),
    ]);

    if (charsRes.ok) {
      setCharacters(await charsRes.json());
    } else {
      onToast("Error cargando personajes", "error");
    }

    if (objsRes.ok) {
      setObjects(await objsRes.json());
    } else {
      onToast("Error cargando objetos", "error");
    }

    setLoading(false);
  }, [token, onToast]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const updateParticipant = (
    id: string,
    updates: Partial<PartidaParticipantDraft>,
  ) =>
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );

  const addParticipant = () =>
    setParticipants((prev) => [
      ...prev,
      {
        id: createId("p"),
        characterId: "",
        gold: 0,
        comment: "",
        dead: false,
        items: [],
      },
    ]);

  const removeParticipant = (id: string) =>
    setParticipants((prev) => prev.filter((p) => p.id !== id));

  const addItem = (participantId: string) =>
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? {
              ...p,
              items: [
                ...p.items,
                { id: createId("i"), objectId: "", qty: 1 },
              ],
            }
          : p,
      ),
    );

  const updateItem = (
    participantId: string,
    itemId: string,
    updates: Partial<PartidaItemDraft>,
  ) =>
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? {
              ...p,
              items: p.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item,
              ),
            }
          : p,
      ),
    );

  const removeItem = (participantId: string, itemId: string) =>
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? { ...p, items: p.items.filter((item) => item.id !== itemId) }
          : p,
      ),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onToast("El nombre de la partida es obligatorio", "error");
      return;
    }

    const validParticipants = participants.filter((p) => p.characterId !== "");
    if (validParticipants.length === 0) {
      onToast("Agrega al menos un participante", "error");
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
        participants: validParticipants.map((p) => ({
          characterId: p.characterId,
          gold: p.gold,
          comment: p.comment,
          dead: p.dead,
          items: p.items
            .filter((item) => item.objectId !== "")
            .map((item) => ({
              objectId: item.objectId,
              qty: item.qty,
            })),
        })),
      }),
    });
    setSaving(false);

    if (res.ok) {
      onToast("Partida creada", "success");
      setTitle("");
      setComment("");
      setParticipants([
        {
          id: "p-1",
          characterId: "",
          gold: 0,
          comment: "",
          dead: false,
          items: [],
        },
      ]);
    } else {
      const err = await res.json().catch(() => ({}));
      onToast(err.error ?? "Error al crear partida", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crea una nueva partida e invita personajes
        </p>
        <button
          type="button"
          onClick={addParticipant}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar participante
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nombre de la partida">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Asalto a la Torre"
                required
              />
            </FormField>
            <FormField label="Comentario general (opcional)">
              <input
                className={inputCls}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Notas del master"
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Invitados</h3>
            {participants.map((p, index) => (
              <div
                key={p.id}
                className="border border-border rounded-xl p-4 bg-secondary/20 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Participante {index + 1}
                  </p>
                  {participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <FormField label="Personaje">
                    <select
                      className={inputCls}
                      value={p.characterId}
                      onChange={(e) =>
                        updateParticipant(p.id, {
                          characterId: e.target.value
                            ? Number(e.target.value)
                            : "",
                        })
                      }
                    >
                      <option value="">Selecciona personaje</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.userName} (Slot {c.slot})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Oro a otorgar">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={p.gold}
                      onChange={(e) =>
                        updateParticipant(p.id, {
                          gold: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Comentario">
                    <input
                      className={inputCls}
                      value={p.comment}
                      onChange={(e) =>
                        updateParticipant(p.id, { comment: e.target.value })
                      }
                      placeholder="Notas individuales"
                    />
                  </FormField>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      id={`dead-${p.id}`}
                      type="checkbox"
                      checked={p.dead}
                      onChange={(e) =>
                        updateParticipant(p.id, { dead: e.target.checked })
                      }
                      className="w-4 h-4 accent-red-500"
                    />
                    <label
                      htmlFor={`dead-${p.id}`}
                      className="text-sm text-muted-foreground"
                    >
                      Se murio
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Objetos</p>
                    <button
                      type="button"
                      onClick={() => addItem(p.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted"
                    >
                      Agregar objeto
                    </button>
                  </div>

                  {p.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin objetos asignados
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {p.items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center"
                        >
                          <select
                            className={inputCls}
                            value={item.objectId}
                            onChange={(e) =>
                              updateItem(p.id, item.id, {
                                objectId: e.target.value
                                  ? Number(e.target.value)
                                  : "",
                              })
                            }
                          >
                            <option value="">Selecciona objeto</option>
                            {objects.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.icon} {o.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            className={inputCls}
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(p.id, item.id, {
                                qty: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(p.id, item.id)}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setTitle("");
                setComment("");
                setParticipants([
                  {
                    id: "p-1",
                    characterId: "",
                    gold: 0,
                    comment: "",
                    dead: false,
                    items: [],
                  },
                ]);
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
              Crear partida
            </button>
          </div>
        </form>
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
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof AdminUser>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} usuario{users.length !== 1 ? "s" : ""} registrado
          {users.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
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
                  Rol <SortIcon field="role" />
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
              {sorted.map((u, i) => (
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
                    {u.level}
                  </td>
                  <td className="px-3 py-3 text-center text-gold font-medium">
                    {u.gold}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {u.isAdmin ? (
                      <span className="px-2 py-0.5 bg-gold/20 text-gold rounded text-xs font-semibold">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs">
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
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
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

      {/* Modal Editar */}
      {editTarget && (
        <UserFormModal
          title={`Editar: ${editTarget.name}`}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          loading={actionLoading}
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
}: {
  title: string;
  initial: AdminUser | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminUser> & { password?: string }) => void;
  loading: boolean;
}) {
  const isEdit = initial !== null;

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    // Solo se usan en creación
    email: "",
    password: "",
    // Editables siempre
    role: initial?.role ?? "",
    level: initial?.level ?? 1,
  });

  const set = (key: string, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      // En edición solo se envían nombre, rol y nivel
      onSubmit({ name: form.name, role: form.role, level: form.level });
    } else {
      onSubmit({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        level: form.level,
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
          <FormField label="Rol / Clase">
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
              min={1}
              max={99}
              value={form.level}
              onChange={(e) => set("level", Number(e.target.value))}
            />
          </FormField>
        </div>

        {/* El toggle de Admin está reservado para SUPER_ADMIN (próximamente) */}

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
  const [amount, setAmount] = useState<number>(0);
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
          onSubmit({ amount, reason, action });
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
          <input
            type="number"
            min="1"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
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
            disabled={loading || amount <= 0}
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
            onChange={(e) => set("minLevel", e.target.value)}
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
          <div className="overflow-x-auto rounded-lg border border-border">
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
    precio: number;
    inventario: number | null;
    orden: number;
  }) => void;
}) {
  const [objetoId, setObjetoId] = useState<number>(
    initial?.objetoId ?? objects[0]?.id ?? 0,
  );
  
  // --- Estados de búsqueda de objeto ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [precio, setPrecio] = useState<number>(initial?.precio ?? 0);
  const [inventarioRaw, setInventarioRaw] = useState<string>(
    initial?.inventario === null || initial?.inventario === undefined
      ? ""
      : String(initial.inventario),
  );
  const [orden, setOrden] = useState<number>(initial?.orden ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "create" && !objetoId) {
      alert("Selecciona un objeto válido");
      return;
    }

    const inventario =
      inventarioRaw.trim() === "" ? null : Number(inventarioRaw.trim());

    onSubmit({
      ...(mode === "create" ? { objetoId } : {}),
      precio,
      inventario,
      orden,
    });
  };

  const selectedObject = objects.find((o) => o.id === objetoId);
  const filteredObjects = objects
    .filter(
      (obj) =>
        obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obj.id.toString() === searchTerm ||
        obj.itemType.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 10);

  return (
    <Modal
      title={mode === "create" ? "Añadir artículo a tienda" : "Editar artículo"}
      maxWidth="max-w-2xl"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-visible">
        {mode === "create" && (
          <FormField label="Objeto">
            <div className="relative">
              {selectedObject ? (
                <div className="flex items-center justify-between bg-black/20 border border-gold/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{selectedObject.icon}</span>
                    <span className="font-medium text-foreground">{selectedObject.name}</span>
                    <span className="text-muted-foreground text-xs">({selectedObject.itemType})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setObjetoId(0);
                      setSearchTerm("");
                      setShowDropdown(true);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Buscar por nombre, ID o tipo..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  />
                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-full bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredObjects.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron objetos</div>
                      ) : (
                        filteredObjects.map((obj) => (
                          <div
                            key={obj.id}
                            className="px-3 py-2 text-sm hover:bg-secondary cursor-pointer flex items-center gap-2"
                            onClick={() => {
                              setObjetoId(obj.id);
                              setShowDropdown(false);
                            }}
                          >
                            <span>{obj.icon}</span>
                            <span className="font-medium">{obj.name}</span>
                            <span className="text-muted-foreground text-xs">ID: {obj.id} • {obj.itemType}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Precio">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={precio}
              onChange={(e) => setPrecio(Number(e.target.value))}
              required
            />
          </FormField>
          <FormField label="Stock (vacío=ilimitado)">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={inventarioRaw}
              onChange={(e) => setInventarioRaw(e.target.value)}
              placeholder="∞"
            />
          </FormField>
          <FormField label="Orden">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value))}
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {objects.length} objeto{objects.length !== 1 ? "s" : ""} en catálogo
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dim text-background text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo objeto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {objects.map((obj) => (
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
                <span className="px-1.5 py-0.5 bg-gold/10 text-gold rounded capitalize">
                  {obj.rarity}
                </span>
                <span>{formatDate(obj.createdAt)}</span>
              </div>
            </div>
          ))}
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

    onSubmit({
      name: form.name,
      description: form.description,
      icon: form.icon,
      itemType: form.itemType,
      rarity: form.rarity,
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

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo de objeto">
            <select
              className={inputCls}
              value={form.itemType}
              onChange={(e) => set("itemType", e.target.value)}
            >
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Rareza">
            <select
              className={inputCls}
              value={form.rarity}
              onChange={(e) => set("rarity", e.target.value)}
            >
              {RARITY_OPTIONS.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {rarity}
                </option>
              ))}
            </select>
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

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "usuarios", label: "Usuarios", icon: Users },
    { id: "tiendas", label: "Tiendas", icon: Store },
    { id: "objetos", label: "Objetos", icon: Box },
    { id: "transacciones", label: "Transacciones", icon: ArrowRightLeft },
    { id: "partidas", label: "Partidas", icon: Shield },
    { id: "historial-partidas", label: "Historial", icon: Shield },
  ];

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
          <div className="flex border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
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
            {activeTab === "partidas" && (
              <PartidasTab token={token} onToast={showToast} />
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
