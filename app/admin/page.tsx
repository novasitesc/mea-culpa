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

type Tab = "usuarios" | "tiendas" | "objetos" | "transacciones";
type ActiveGameSession = {
  id: string;
  name: string;
  characters: Array<{
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
  }>;
  splitGoldOnClose: boolean;
  splitLootOnClose: boolean;
  startedAt: string;
};

const GAME_SESSION_STORAGE_KEY = "mc_admin_active_game_session";

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

function GameSessionInitModal({
  token,
  onToast,
  onClose,
}: {
  token: string;
  onToast: (msg: string, type: "success" | "error") => void;
  onClose: () => void;
}) {
  type SelectableCharacter = {
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
  };

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [characters, setCharacters] = useState<SelectableCharacter[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionName, setSessionName] = useState("Partida de hoy");
  const [splitGoldOnClose, setSplitGoldOnClose] = useState(true);
  const [splitLootOnClose, setSplitLootOnClose] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveGameSession | null>(
    null,
  );
  const [lastCloseSummary, setLastCloseSummary] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(GAME_SESSION_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ActiveGameSession>;
        if (parsed && Array.isArray(parsed.characters)) {
          setActiveSession(parsed as ActiveGameSession);
        } else {
          // Limpiar esquema anterior basado en jugadores
          localStorage.removeItem(GAME_SESSION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(GAME_SESSION_STORAGE_KEY);
      }
    }

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("No se pudieron cargar usuarios");

        const data = await res.json();
        const rows: AdminUser[] = Array.isArray(data)
          ? data
          : Array.isArray(data.users)
            ? data.users
            : [];

        setUsers(rows);

        setLoadingCharacters(true);
        const profileResponses = await Promise.all(
          rows.map(async (u) => {
            const r = await fetch(`/api/profile?userId=${u.id}`);
            if (!r.ok) return { user: u, characters: [] as any[] };
            const profileData = await r.json();
            return {
              user: u,
              characters: Array.isArray(profileData?.characters)
                ? profileData.characters
                : [],
            };
          }),
        );

        const flattened: SelectableCharacter[] = profileResponses.flatMap(
          ({ user, characters: chars }) =>
            chars.map((c: any) => ({
              id: String(c.id),
              name: c.name ?? "Personaje sin nombre",
              ownerId: user.id,
              ownerName: user.name,
              ownerEmail: user.email,
            })),
        );

        setCharacters(flattened);
      } catch {
        onToast("No se pudieron cargar los jugadores", "error");
      } finally {
        setLoadingUsers(false);
        setLoadingCharacters(false);
      }
    };

    loadUsers();
  }, [token, onToast]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const createSession = () => {
    if (selectedIds.length === 0) {
      onToast("Selecciona al menos un personaje", "error");
      return;
    }

    const selectedCharacters = characters.filter((c) =>
      selectedIds.includes(c.id),
    );

    const session: ActiveGameSession = {
      id: crypto.randomUUID(),
      name: sessionName.trim() || "Partida sin nombre",
      characters: selectedCharacters,
      splitGoldOnClose,
      splitLootOnClose,
      startedAt: new Date().toISOString(),
    };

    localStorage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(session));
    setActiveSession(session);
    setSelectedIds([]);
    onToast("Partida inicializada (modo provisional)", "success");
  };

  const closeSession = () => {
    if (!activeSession) return;

    const count = activeSession.characters.length;
    const goldPerPlayer = activeSession.splitGoldOnClose ? 150 : 0;
    const totalGold = goldPerPlayer * count;

    const lootPool = [
      "cofre comun",
      "gema misteriosa",
      "pocion mayor",
      "anillo antiguo",
      "pergamino arcano",
    ];

    const lootSummary = activeSession.splitLootOnClose
      ? activeSession.characters
          .map(
            (c, idx) => `${c.name} (${c.ownerName}): ${lootPool[idx % lootPool.length]}`,
          )
          .join(" | ")
      : "sin reparto de loot";

    const summary =
      `Cierre de partida '${activeSession.name}'. ` +
      (activeSession.splitGoldOnClose
        ? `Oro total repartido: ${totalGold} (${goldPerPlayer} por jugador). `
        : "Sin reparto de oro. ") +
      `Loot: ${lootSummary}.`;

    localStorage.removeItem(GAME_SESSION_STORAGE_KEY);
    setActiveSession(null);
    setLastCloseSummary(summary);
    onToast("Partida cerrada y reparto simulado aplicado", "success");
  };

  return (
    <Modal title="Inicializacion de partida (provisional)" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {activeSession ? (
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-4 space-y-3">
            <p className="text-sm text-foreground">
              Partida activa: <span className="font-semibold">{activeSession.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Personajes: {activeSession.characters.map((c) => `${c.name} (${c.ownerName})`).join(", ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Cierre configurado: oro {activeSession.splitGoldOnClose ? "SI" : "NO"} · loot {activeSession.splitLootOnClose ? "SI" : "NO"}
            </p>
            <button
              onClick={closeSession}
              className="px-4 py-2 bg-destructive hover:bg-destructive/80 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cerrar partida y ejecutar reparto
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
            No hay una partida activa. Crea una nueva inicializacion abajo.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre de la partida">
            <input
              className={inputCls}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Partida de hoy"
            />
          </FormField>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Opciones al cerrar</label>
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <input
                type="checkbox"
                checked={splitGoldOnClose}
                onChange={(e) => setSplitGoldOnClose(e.target.checked)}
              />
              Repartir oro al cerrar
            </label>
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <input
                type="checkbox"
                checked={splitLootOnClose}
                onChange={(e) => setSplitLootOnClose(e.target.checked)}
              />
              Repartir loot al cerrar
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Seleccion de personajes</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(characters.map((c) => c.id))}
                className="px-2 py-1 text-xs rounded bg-secondary hover:bg-muted text-foreground"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-xs rounded bg-secondary hover:bg-muted text-foreground"
              >
                Limpiar
              </button>
            </div>
          </div>

          {loadingUsers || loadingCharacters ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gold" />
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {characters.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-3">
                  No se encontraron personajes disponibles.
                </div>
              )}
              {characters.map((c) => (
                <label
                  key={`${c.ownerId}-${c.id}`}
                  className="flex items-center justify-between gap-2 text-sm bg-secondary/20 border border-border rounded px-3 py-2"
                >
                  <span className="text-foreground">
                    {c.name}{" "}
                    <span className="text-muted-foreground">· {c.ownerName} ({c.ownerEmail})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleUser(c.id)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {lastCloseSummary && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-300">{lastCloseSummary}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={createSession}
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background rounded-lg text-sm font-medium transition-colors"
          >
            Crear modulo de inicializacion
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Página principal del panel ───────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading, token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [showGameInitModal, setShowGameInitModal] = useState(false);
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
          <div className="flex items-start justify-between gap-4">
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
            <button
              onClick={() => setShowGameInitModal(true)}
              className="px-4 py-2 rounded-lg bg-gold hover:bg-gold-dim text-background text-sm font-semibold transition-colors"
            >
              Crear modulo de inicializacion de partida
            </button>
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
          </div>
        </div>

        {/* Toast */}
        {showGameInitModal && (
          <GameSessionInitModal
            token={token}
            onToast={showToast}
            onClose={() => setShowGameInitModal(false)}
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </div>
  );
}
