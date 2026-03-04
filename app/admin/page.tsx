"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Store,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  home: string;
  isAdmin: boolean;
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

type Tab = "usuarios" | "tiendas";

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
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

// ─── Pestaña Usuarios ─────────────────────────────────────────────────────────

function UsersTab({
  userId,
  onToast,
}: {
  userId: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof AdminUser>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  const headers = { "x-user-id": userId };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { headers });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "",
    level: initial?.level ?? 1,
    home: initial?.home ?? "",
    isAdmin: initial?.isAdmin ?? false,
  });

  const set = (key: string, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    // Si no se ingresa contraseña en edición, no la enviamos
    if (!payload.password) delete payload.password;
    onSubmit(payload);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre del usuario"
            required
          />
        </FormField>
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
        <FormField
          label={
            initial
              ? "Nueva contraseña (dejar vacío para no cambiar)"
              : "Contraseña"
          }
        >
          <input
            className={inputCls}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={initial ? "••••••••" : "Contraseña"}
            {...(!initial && { required: true })}
          />
        </FormField>
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
        <FormField label="Ciudad natal">
          <input
            className={inputCls}
            value={form.home}
            onChange={(e) => set("home", e.target.value)}
            placeholder="Ej: Eldergrove"
          />
        </FormField>
        <FormField label="Permisos">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => set("isAdmin", !form.isAdmin)}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                form.isAdmin ? "bg-gold" : "bg-secondary border border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form.isAdmin ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-foreground group-hover:text-gold transition-colors">
              Administrador
            </span>
          </label>
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
            {initial ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Pestaña Tiendas ──────────────────────────────────────────────────────────

function ShopsTab({
  userId,
  onToast,
}: {
  userId: string;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AdminShop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShop | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = { "x-user-id": userId };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tiendas", { headers });
    if (res.ok) setShops(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

// ─── Página principal del panel ───────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "usuarios", label: "Usuarios", icon: Users },
    { id: "tiendas", label: "Tiendas", icon: Store },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
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
              <span className="text-foreground font-medium">{user.name}</span> ·
              Gestión del servidor Mea Culpa
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
            <UsersTab userId={user.id} onToast={showToast} />
          )}
          {activeTab === "tiendas" && (
            <ShopsTab userId={user.id} onToast={showToast} />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
