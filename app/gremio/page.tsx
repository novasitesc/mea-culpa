"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import { useAuth } from "@/lib/useAuth";
import { emitAuthRefresh } from "@/lib/authRefresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { Crown, Package, Shield, Users } from "lucide-react";

type Character = {
  id: number;
  name: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  bag: {
    items: Array<{
      bagRowId: number;
      objectId: number | null;
      name: string;
      type: string;
      cantidad?: number;
      publicadoEnTrade?: boolean;
    }>;
  };
};

type ProfileResponse = {
  player: {
    oro: number;
  };
  characters: Character[];
};

type GuildSummary = {
  id: number;
  nombre: string;
  descripcion: string | null;
  liderUsuarioId: string;
  miembrosCount: number;
  limiteIntegrantes: number;
  limiteBaulItems: number;
  baulCount: number;
};

type GuildMember = {
  id: number;
  role: "lider" | "integrante";
  joinedAt: string;
  userId: string;
  name: string;
};

type BaulItem = {
  id: number;
  cantidad: number;
  createdAt: string;
  object: {
    id: number | null;
    nombre: string;
    icono: string;
    rareza: string;
    tipo: string;
    precio: number;
  };
  depositBy: {
    userId: string;
    name: string;
  };
};

type GuildRequest = {
  id: number;
  estado: "pendiente" | "aprobada" | "rechazada" | "cancelada";
  nota: string | null;
  createdAt: string;
  resolvedAt: string | null;
  baulItemId: number;
  requesterUserId: string;
  requesterName: string;
  targetCharacter: {
    id: number;
    name: string;
  };
  item: {
    id: number;
    cantidad: number;
    nombre: string;
    icono: string;
  };
};

type GuildApiResponse = {
  hasGuild: boolean;
  myMembership: { guildId: number; role: "lider" | "integrante" } | null;
  myGuild: GuildSummary | null;
  guilds: GuildSummary[];
  members?: GuildMember[];
  baul?: BaulItem[];
  solicitudes?: GuildRequest[];
};

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
};

const INITIAL_ALERT: AlertState = {
  open: false,
  title: "",
  message: "",
  variant: "info",
};

export default function GremioPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [guildState, setGuildState] = useState<GuildApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [guildName, setGuildName] = useState("");
  const [guildDescription, setGuildDescription] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [selectedBagRowId, setSelectedBagRowId] = useState<number | null>(null);
  const [selectedTargetCharacterId, setSelectedTargetCharacterId] = useState<number | null>(null);
  const [requestNote, setRequestNote] = useState("");
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);

  const authHeaders = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [token]);

  const showAlert = useCallback(
    (title: string, message: string, variant: AlertState["variant"]) => {
      setAlert({ open: true, title, message, variant });
    },
    [],
  );

  const loadData = useCallback(async () => {
    if (!user?.id || !token) return;

    setLoading(true);
    try {
      const [profileRes, guildRes] = await Promise.all([
        fetch(`/api/profile?userId=${user.id}`),
        fetch("/api/gremio", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [profileData, guildData] = await Promise.all([
        profileRes.json(),
        guildRes.json(),
      ]);

      if (!profileRes.ok) {
        throw new Error(profileData.error ?? "No se pudo cargar el perfil");
      }
      if (!guildRes.ok) {
        throw new Error(guildData.error ?? "No se pudo cargar gremio");
      }

      const safeProfile = profileData as ProfileResponse;
      const safeGuild = guildData as GuildApiResponse;

      setProfile(safeProfile);
      setGuildState(safeGuild);

      const firstCharacterId =
        safeProfile.characters?.find((character) => character.lifeStatus !== "muerto")?.id ??
        null;
      setSelectedCharacterId((prev) => prev ?? firstCharacterId);
      setSelectedTargetCharacterId((prev) => prev ?? firstCharacterId);
    } catch (err) {
      showAlert(
        "Error",
        err instanceof Error ? err.message : "No se pudo cargar gremio",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showAlert, token, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const characters = profile?.characters ?? [];
    if (characters.length === 0) return;
    const hasAnyAlive = characters.some((character) => character.lifeStatus !== "muerto");
    if (!hasAnyAlive) {
      router.replace("/profile?dead=1");
    }
  }, [profile?.characters, router]);

  const aliveCharacters = useMemo(
    () => (profile?.characters ?? []).filter((character) => character.lifeStatus !== "muerto"),
    [profile?.characters],
  );

  const selectedCharacter = useMemo(
    () => profile?.characters.find((c) => c.id === selectedCharacterId) ?? null,
    [profile?.characters, selectedCharacterId],
  );

  const depositableItems = useMemo(() => {
    if (!selectedCharacter) return [];
    if (selectedCharacter.lifeStatus === "muerto") return [];
    return selectedCharacter.bag.items.filter(
      (item) => !item.publicadoEnTrade && Number(item.objectId) > 0,
    );
  }, [selectedCharacter]);

  useEffect(() => {
    if (depositableItems.length === 0) {
      setSelectedBagRowId(null);
      return;
    }

    setSelectedBagRowId((prev) => {
      if (!prev) return depositableItems[0].bagRowId;
      const exists = depositableItems.some((item) => item.bagRowId === prev);
      return exists ? prev : depositableItems[0].bagRowId;
    });
  }, [depositableItems]);

  const pendingRequests = useMemo(
    () => (guildState?.solicitudes ?? []).filter((s) => s.estado === "pendiente"),
    [guildState?.solicitudes],
  );

  const createGuild = async () => {
    if (!authHeaders) return;

    const trimmedName = guildName.trim();
    if (trimmedName.length < 3) {
      showAlert("Nombre invalido", "El nombre debe tener al menos 3 caracteres", "warning");
      return;
    }

    setBusy("createGuild");
    try {
      const res = await fetch("/api/gremio", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          nombre: trimmedName,
          descripcion: guildDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo crear el gremio");
      }

      showAlert("Gremio creado", "Se descontaron 100 de oro", "success");
      emitAuthRefresh(typeof data?.oro === "number" ? data.oro : undefined);
      await refreshUser();
      await loadData();
    } catch (err) {
      showAlert(
        "Error al crear gremio",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const joinGuild = async (gremioId: number) => {
    if (!authHeaders) return;

    setBusy(`join-${gremioId}`);
    try {
      const res = await fetch("/api/gremio/join", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ gremioId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo unir al gremio");
      }

      showAlert("Te uniste al gremio", "Ya perteneces a este clan", "success");
      await loadData();
    } catch (err) {
      showAlert(
        "No se pudo unir",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const leaveGuild = async () => {
    if (!authHeaders) return;

    setBusy("leaveGuild");
    try {
      const res = await fetch("/api/gremio/leave", {
        method: "POST",
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo salir del gremio");
      }

      showAlert(
        "Salida confirmada",
        data?.disuelto
          ? "Eras el ultimo miembro, el gremio fue disuelto"
          : "Saliste del gremio correctamente",
        "info",
      );
      await loadData();
    } catch (err) {
      showAlert(
        "No se pudo salir",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const depositItem = async () => {
    if (!authHeaders) return;
    if (!selectedCharacterId || !selectedBagRowId) {
      showAlert("Faltan datos", "Selecciona personaje y objeto", "warning");
      return;
    }

    setBusy("deposit");
    try {
      const res = await fetch("/api/gremio/baul/deposit", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          characterId: selectedCharacterId,
          bagRowId: selectedBagRowId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo depositar el objeto");
      }

      showAlert("Objeto depositado", "El objeto ya esta en el baul", "success");
      await loadData();
    } catch (err) {
      showAlert(
        "No se pudo depositar",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const requestItem = async (baulItemId: number) => {
    if (!authHeaders) return;
    if (!selectedTargetCharacterId) {
      showAlert("Falta personaje", "Selecciona el personaje destino", "warning");
      return;
    }

    setBusy(`request-${baulItemId}`);
    try {
      const res = await fetch("/api/gremio/baul/solicitudes", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          baulItemId,
          targetCharacterId: selectedTargetCharacterId,
          note: requestNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo crear la solicitud");
      }

      showAlert("Solicitud enviada", "El lider debe aprobar o rechazar", "success");
      setRequestNote("");
      await loadData();
    } catch (err) {
      showAlert(
        "No se pudo solicitar",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const resolveRequest = async (
    requestId: number,
    action: "aprobar" | "rechazar",
  ) => {
    if (!authHeaders) return;

    setBusy(`resolve-${requestId}-${action}`);
    try {
      const res = await fetch(`/api/gremio/baul/solicitudes/${requestId}/resolver`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo resolver la solicitud");
      }

      showAlert(
        "Solicitud resuelta",
        action === "aprobar" ? "Objeto entregado al solicitante" : "Solicitud rechazada",
        action === "aprobar" ? "success" : "info",
      );
      await loadData();
    } catch (err) {
      showAlert(
        "No se pudo resolver",
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const role = guildState?.myMembership?.role;
  const hasGuild = Boolean(guildState?.hasGuild);
  const myGuild = guildState?.myGuild ?? null;
  const isBaulLimitReached =
    hasGuild && !!myGuild
      ? (guildState?.baul ?? []).length >= myGuild.limiteBaulItems
      : false;

  return (
    <div className="min-h-screen p-6 text-foreground bg-background relative z-10 space-y-4">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <Sidebar activeSection="gremio" />
        </div>

        <main className="lg:col-span-9 space-y-4">
          <Card className="bg-card/70 border-border">
            <CardHeader>
              <CardTitle className="text-gold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Gremio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sistema de clanes con baul compartido. El chat en tiempo real se
                implementara en una siguiente fase.
              </p>
              <p className="text-xs mt-2 text-muted-foreground">
                Oro disponible: <span className="text-gold font-semibold">{profile?.player.oro ?? 0}</span>
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <Card className="bg-card/60 border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                Cargando informacion de gremio...
              </CardContent>
            </Card>
          ) : !hasGuild ? (
            <>
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle>Crear gremio (costo: 100 oro)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={guildName}
                    onChange={(e) => setGuildName(e.target.value)}
                    maxLength={40}
                    placeholder="Nombre del gremio"
                  />
                  <textarea
                    value={guildDescription}
                    onChange={(e) => setGuildDescription(e.target.value)}
                    maxLength={200}
                    placeholder="Descripcion breve (opcional)"
                    className="w-full min-h-22.5 rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  />
                  <Button
                    onClick={createGuild}
                    disabled={busy === "createGuild"}
                    className="bg-gold text-background hover:bg-gold-dim"
                  >
                    {busy === "createGuild" ? "Creando..." : "Crear gremio"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Gremios disponibles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(guildState?.guilds ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aun no hay gremios creados. Crea el primero.
                    </p>
                  ) : (
                    (guildState?.guilds ?? []).map((g) => (
                      <div
                        key={g.id}
                        className="rounded-lg border border-border p-3 bg-card/50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gold">{g.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.descripcion || "Sin descripcion"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Integrantes: {g.miembrosCount}/{g.limiteIntegrantes}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Baul: {g.baulCount}/{g.limiteBaulItems}
                            </p>
                          </div>
                          <Button
                            onClick={() => joinGuild(g.id)}
                            disabled={busy === `join-${g.id}` || g.miembrosCount >= g.limiteIntegrantes}
                          >
                            {busy === `join-${g.id}`
                              ? "Uniendo..."
                              : g.miembrosCount >= g.limiteIntegrantes
                                ? "Lleno"
                                : "Unirme"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gold">
                    {role === "lider" ? <Crown className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    {guildState?.myGuild?.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {guildState?.myGuild?.descripcion || "Sin descripcion"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rol actual: <span className="text-gold">{role === "lider" ? "Lider" : "Integrante"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Miembros: {(guildState?.members ?? []).length}/{myGuild?.limiteIntegrantes ?? 10}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Baul: {(guildState?.baul ?? []).length}/{myGuild?.limiteBaulItems ?? 10}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(guildState?.members ?? []).map((m) => (
                      <span
                        key={m.id}
                        className="px-2 py-1 rounded bg-secondary text-xs text-muted-foreground"
                      >
                        {m.name} {m.role === "lider" ? "(Lider)" : ""}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    onClick={leaveGuild}
                    disabled={busy === "leaveGuild"}
                  >
                    {busy === "leaveGuild" ? "Saliendo..." : "Salir del gremio"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Depositar en baul
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      value={selectedCharacterId?.toString() ?? ""}
                      onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    >
                      {aliveCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={selectedBagRowId?.toString() ?? ""}
                      onChange={(e) => setSelectedBagRowId(Number(e.target.value))}
                    >
                      {depositableItems.length === 0 ? (
                        <option value="">Sin objetos disponibles</option>
                      ) : (
                        depositableItems.map((item) => (
                          <option key={item.bagRowId} value={item.bagRowId}>
                            {item.name} x{item.cantidad ?? 1}
                          </option>
                        ))
                      )}
                    </Select>
                  </div>

                  <Button
                    onClick={depositItem}
                    disabled={busy === "deposit" || depositableItems.length === 0 || isBaulLimitReached}
                  >
                    {busy === "deposit" ? "Depositando..." : "Depositar objeto"}
                  </Button>
                  {isBaulLimitReached && (
                    <p className="text-xs text-amber-300">
                      El baul del gremio esta lleno. Limite actual: {myGuild?.limiteBaulItems ?? 10} items.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle>Baul del gremio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      value={selectedTargetCharacterId?.toString() ?? ""}
                      onChange={(e) => setSelectedTargetCharacterId(Number(e.target.value))}
                    >
                      {aliveCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          Destino: {c.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      maxLength={120}
                      placeholder="Nota para el lider (opcional)"
                    />
                  </div>

                  {(guildState?.baul ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay objetos en el baul.</p>
                  ) : (
                    (guildState?.baul ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border p-3 bg-card/50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gold">
                              {item.object.icono} {item.object.nombre} x{item.cantidad}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Depositado por {item.depositBy.name}
                            </p>
                          </div>
                          <Button
                            onClick={() => requestItem(item.id)}
                            disabled={busy === `request-${item.id}`}
                          >
                            {busy === `request-${item.id}` ? "Solicitando..." : "Solicitar"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {role === "lider" && (
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle>Solicitudes pendientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pendingRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
                    ) : (
                      pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="rounded-lg border border-border p-3 bg-card/50"
                        >
                          <p className="text-sm text-gold font-semibold">
                            {req.item.icono} {req.item.nombre} x{req.item.cantidad}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Solicitante: {req.requesterName} | Destino: {req.targetCharacter.name}
                          </p>
                          {req.nota && (
                            <p className="text-xs text-muted-foreground mt-1">Nota: {req.nota}</p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button
                              onClick={() => resolveRequest(req.id, "aprobar")}
                              disabled={busy === `resolve-${req.id}-aprobar`}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Aprobar
                            </Button>
                            <Button
                              onClick={() => resolveRequest(req.id, "rechazar")}
                              disabled={busy === `resolve-${req.id}-rechazar`}
                              variant="destructive"
                            >
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>
      </div>

      <FantasyAlert
        open={alert.open}
        onClose={() => setAlert(INITIAL_ALERT)}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
}
