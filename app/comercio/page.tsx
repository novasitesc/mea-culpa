"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import { useAuth } from "@/lib/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { Coins, ShoppingBag, UserRound, Check, X } from "lucide-react";

type BagItem = {
  bagRowId: number;
  objectId: number | null;
  name: string;
  type: string;
  price?: number;
  cantidad?: number;
  fueComerciado?: boolean;
  publicadoEnTrade?: boolean;
};

type Character = {
  id: number;
  name: string;
  portrait: string;
  bag: {
    items: BagItem[];
    maxSlots: number;
  };
};

type ProfileResponse = {
  player: {
    oro: number;
  };
  characters: Character[];
};

type Publicacion = {
  id: number;
  precio: number;
  estado: "publicado" | "solicitado" | "rechazado" | "aceptado" | "cancelado";
  creadoEn: string;
  actualizadoEn: string;
  vendedorUsuarioId: string;
  vendedorPersonajeId: number;
  compradorUsuarioId: string | null;
  compradorPersonajeId: number | null;
  item: {
    bagRowId: number | null;
    cantidad: number;
    fueComerciado: boolean;
    publicadoEnTrade: boolean;
    objetoId: number | null;
    nombre: string;
    icono: string;
    rareza: string;
    tipo: string;
    precioBase: number;
  };
  vendedor: {
    nombre: string;
    retrato: string;
  };
  comprador: {
    nombre: string;
    retrato: string;
  } | null;
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

export default function ComercioPage() {
  const { user, token, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [market, setMarket] = useState<Publicacion[]>([]);
  const [mine, setMine] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [selectedSellerCharacterId, setSelectedSellerCharacterId] = useState<number | null>(null);
  const [selectedBuyerCharacterId, setSelectedBuyerCharacterId] = useState<number | null>(null);
  const [selectedBagRowId, setSelectedBagRowId] = useState<number | null>(null);
  const [publishPrice, setPublishPrice] = useState<string>("0");
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);

  const showAlert = useCallback(
    (title: string, message: string, variant: AlertState["variant"]) => {
      setAlert({ open: true, title, message, variant });
    },
    [],
  );

  const authHeaders = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [token]);

  const loadData = useCallback(async () => {
    if (!user?.id || !token) return;

    setLoading(true);
    try {
      const [profileRes, marketRes, mineRes] = await Promise.all([
        fetch(`/api/profile?userId=${user.id}`),
        fetch("/api/comercio/publicaciones?includeSolicitados=1", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/comercio/mis-publicaciones", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [profileData, marketData, mineData] = await Promise.all([
        profileRes.json(),
        marketRes.json(),
        mineRes.json(),
      ]);

      if (!profileRes.ok) {
        throw new Error(profileData.error ?? "No se pudo cargar el perfil");
      }
      if (!marketRes.ok) {
        throw new Error(marketData.error ?? "No se pudo cargar el mercado");
      }
      if (!mineRes.ok) {
        throw new Error(mineData.error ?? "No se pudo cargar tus publicaciones");
      }

      const safeProfile = profileData as ProfileResponse;
      const safeMarket = (marketData ?? []) as Publicacion[];
      const safeMine = (mineData ?? []) as Publicacion[];

      setProfile(safeProfile);
      setMarket(safeMarket);
      setMine(safeMine);

      const firstCharacterId = safeProfile.characters?.[0]?.id ?? null;
      setSelectedSellerCharacterId((prev) => prev ?? firstCharacterId);
      setSelectedBuyerCharacterId((prev) => prev ?? firstCharacterId);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "No se pudo cargar comercio",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showAlert, token, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sellerCharacter = useMemo(
    () => profile?.characters.find((c) => c.id === selectedSellerCharacterId) ?? null,
    [profile?.characters, selectedSellerCharacterId],
  );

  const publishableItems = useMemo(() => {
    if (!sellerCharacter) return [];
    return sellerCharacter.bag.items.filter(
      (item) => !item.fueComerciado && !item.publicadoEnTrade,
    );
  }, [sellerCharacter]);

  useEffect(() => {
    if (publishableItems.length === 0) {
      setSelectedBagRowId(null);
      return;
    }

    setSelectedBagRowId((prev) => {
      if (!prev) return publishableItems[0].bagRowId;
      const exists = publishableItems.some((item) => item.bagRowId === prev);
      return exists ? prev : publishableItems[0].bagRowId;
    });
  }, [publishableItems]);

  const myPendingRequests = useMemo(
    () =>
      mine.filter(
        (p) => p.vendedorUsuarioId === user?.id && p.estado === "solicitado",
      ),
    [mine, user?.id],
  );

  const myActivePublications = useMemo(
    () =>
      mine.filter(
        (p) =>
          p.vendedorUsuarioId === user?.id &&
          (p.estado === "publicado" || p.estado === "solicitado"),
      ),
    [mine, user?.id],
  );

  const marketItems = useMemo(
    () => market.filter((p) => p.vendedorUsuarioId !== user?.id),
    [market, user?.id],
  );

  const myRequestedPublications = useMemo(
    () =>
      mine.filter(
        (p) => p.compradorUsuarioId === user?.id && p.estado === "solicitado",
      ),
    [mine, user?.id],
  );

  const publishItem = async () => {
    if (!authHeaders) return;
    if (!selectedSellerCharacterId || !selectedBagRowId) {
      showAlert("Datos faltantes", "Selecciona personaje y objeto", "warning");
      return;
    }

    const parsedPrice = Math.floor(Number(publishPrice));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showAlert("Precio inválido", "El precio debe ser mayor a 0", "warning");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/comercio/publicaciones", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          characterId: selectedSellerCharacterId,
          bagRowId: selectedBagRowId,
          price: parsedPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo publicar el objeto");
      }

      showAlert("Publicado", "Tu objeto fue publicado en el mercado", "success");
      await loadData();
    } catch (error) {
      showAlert(
        "No se pudo publicar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setPublishing(false);
    }
  };

  const requestPurchase = async (publicationId: number) => {
    if (!authHeaders) return;
    if (!selectedBuyerCharacterId) {
      showAlert(
        "Falta personaje",
        "Selecciona el personaje comprador antes de solicitar",
        "warning",
      );
      return;
    }

    setRequestingId(publicationId);
    try {
      const res = await fetch(
        `/api/comercio/publicaciones/${publicationId}/solicitar`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ buyerCharacterId: selectedBuyerCharacterId }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo solicitar la compra");
      }

      showAlert("Solicitud enviada", "El vendedor debe aprobar la compra", "success");
      await refreshUser();
      await loadData();
    } catch (error) {
      showAlert(
        "No se pudo solicitar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setRequestingId(null);
    }
  };

  const cancelRequest = async (publicationId: number) => {
    if (!authHeaders) return;

    setCancelingId(publicationId);
    try {
      const res = await fetch(
        `/api/comercio/publicaciones/${publicationId}/cancelar-solicitud`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cancelar la solicitud");
      }

      showAlert(
        "Solicitud cancelada",
        "Se devolvió el oro reservado por esta compra",
        "info",
      );
      await refreshUser();
      await loadData();
    } catch (error) {
      showAlert(
        "No se pudo cancelar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setCancelingId(null);
    }
  };

  const resolveRequest = async (publicationId: number, action: "aceptar" | "rechazar") => {
    if (!authHeaders) return;

    setResolvingId(publicationId);
    try {
      const res = await fetch(`/api/comercio/publicaciones/${publicationId}/resolver`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo resolver la solicitud");
      }

      showAlert(
        action === "aceptar" ? "Venta completada" : "Solicitud rechazada",
        action === "aceptar"
          ? "La venta fue completada y el objeto ya no podrá re-comerciarse"
          : "La publicación vuelve a estar disponible",
        action === "aceptar" ? "success" : "info",
      );

      await refreshUser();
      await loadData();
    } catch (error) {
      showAlert(
        "No se pudo resolver",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setResolvingId(null);
    }
  };

  const selectedSellerItem = publishableItems.find(
    (item) => item.bagRowId === selectedBagRowId,
  );

  return (
    <div className="min-h-screen bg-background">
      <FantasyAlert
        open={alert.open}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
        onClose={() => setAlert(INITIAL_ALERT)}
      />

      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 mt-4">
          <Sidebar />

          <div className="space-y-4">
            <Card className="medieval-border border-gold-dim">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Comercio entre personajes
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Personaje vendedor
                  </p>
                  <Select
                    value={selectedSellerCharacterId?.toString() ?? ""}
                    onChange={(e) => setSelectedSellerCharacterId(Number(e.target.value))}
                  >
                    {(profile?.characters ?? []).map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Objeto para publicar
                  </p>
                  <Select
                    value={selectedBagRowId?.toString() ?? ""}
                    onChange={(e) => setSelectedBagRowId(Number(e.target.value))}
                    disabled={publishableItems.length === 0}
                  >
                    {publishableItems.length === 0 ? (
                      <option value="">Sin objetos disponibles</option>
                    ) : (
                      publishableItems.map((item) => (
                        <option key={item.bagRowId} value={item.bagRowId}>
                          {item.name} x{item.cantidad ?? 1}
                        </option>
                      ))
                    )}
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Precio en oro
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                      value={publishPrice}
                      onChange={(e) => setPublishPrice(e.target.value)}
                    />
                    <Button
                      onClick={publishItem}
                      disabled={publishing || !selectedBagRowId || !selectedSellerCharacterId}
                    >
                      {publishing ? "Publicando..." : "Publicar"}
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-3 text-xs text-muted-foreground">
                  {selectedSellerItem ? (
                    <span>
                      Publicarás {selectedSellerItem.name}. Si se vende, ese mismo objeto no podrá volver a comerciarse.
                    </span>
                  ) : (
                    <span>
                      No hay objetos comerciables en este personaje. Los objetos ya comerciados o ya publicados no aparecen aquí.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
              <Card className="medieval-border">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-gold flex items-center gap-2">
                    <Coins className="w-5 h-5" /> Mercado
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Personaje comprador
                    </p>
                    <Select
                      value={selectedBuyerCharacterId?.toString() ?? ""}
                      onChange={(e) => setSelectedBuyerCharacterId(Number(e.target.value))}
                    >
                      {(profile?.characters ?? []).map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {loading ? (
                    <p className="text-sm text-muted-foreground">Cargando mercado...</p>
                  ) : marketItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay publicaciones activas.</p>
                  ) : (
                    <div className="space-y-3">
                      {marketItems.map((pub) => {
                        const isAvailable = pub.estado === "publicado";
                        const isMyPendingRequest =
                          pub.estado === "solicitado" &&
                          pub.compradorUsuarioId === user?.id;
                        const userGold = Number(user?.oro ?? profile?.player?.oro ?? 0);
                        const canAfford = userGold >= pub.precio;
                        return (
                          <div
                            key={pub.id}
                            className="rounded-lg border border-border p-3 bg-card/40 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">
                                {pub.item.icono} {pub.item.nombre} x{pub.item.cantidad}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Vendedor: {pub.vendedor.nombre} · Estado: {pub.estado}
                              </p>
                              <p className="text-sm text-gold font-bold mt-1">
                                {pub.precio.toLocaleString()} 🪙
                              </p>
                            </div>
                            <Button
                              onClick={() =>
                                isMyPendingRequest
                                  ? cancelRequest(pub.id)
                                  : requestPurchase(pub.id)
                              }
                              disabled={
                                requestingId === pub.id ||
                                cancelingId === pub.id ||
                                (!isMyPendingRequest &&
                                  (!isAvailable || !canAfford))
                              }
                              size="sm"
                            >
                              {requestingId === pub.id
                                ? "Solicitando..."
                                : cancelingId === pub.id
                                  ? "Cancelando..."
                                  : isMyPendingRequest
                                    ? "Cancelar solicitud"
                                    : isAvailable
                                      ? canAfford
                                        ? "Solicitar compra"
                                        : "Oro insuficiente"
                                      : "No disponible"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="medieval-border">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-gold flex items-center gap-2">
                      <UserRound className="w-5 h-5" /> Solicitudes por resolver
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {myPendingRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tienes solicitudes pendientes.</p>
                    ) : (
                      myPendingRequests.map((pub) => (
                        <div
                          key={pub.id}
                          className="rounded-lg border border-border p-3 bg-card/40"
                        >
                          <p className="font-semibold text-sm">
                            {pub.item.icono} {pub.item.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Comprador: {pub.comprador?.nombre ?? "Desconocido"}
                          </p>
                          <p className="text-sm text-gold font-bold mt-1">
                            {pub.precio.toLocaleString()} 🪙
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => resolveRequest(pub.id, "aceptar")}
                              disabled={resolvingId === pub.id}
                              className="flex-1"
                            >
                              <Check className="w-4 h-4 mr-1" /> Aceptar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveRequest(pub.id, "rechazar")}
                              disabled={resolvingId === pub.id}
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-1" /> Rechazar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="medieval-border">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-gold">Tus publicaciones y solicitudes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {myActivePublications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tienes publicaciones activas.</p>
                    ) : (
                      myActivePublications.map((pub) => (
                        <div key={pub.id} className="rounded-lg border border-border p-3 bg-card/40">
                          <p className="text-sm font-semibold">
                            {pub.item.icono} {pub.item.nombre} x{pub.item.cantidad}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Estado: {pub.estado}
                          </p>
                          <p className="text-sm text-gold font-bold mt-1">
                            {pub.precio.toLocaleString()} 🪙
                          </p>
                        </div>
                      ))
                    )}

                    {myRequestedPublications.length > 0 && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground pt-3">
                          Solicitudes que tú hiciste
                        </p>
                        {myRequestedPublications.map((pub) => (
                          <div key={`request-${pub.id}`} className="rounded-lg border border-border p-3 bg-card/40">
                            <p className="text-sm font-semibold">
                              {pub.item.icono} {pub.item.nombre} x{pub.item.cantidad}
                            </p>
                            <p className="text-xs text-muted-foreground">Estado: {pub.estado}</p>
                            <p className="text-sm text-gold font-bold mt-1">
                              Reservado: {pub.precio.toLocaleString()} 🪙
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => cancelRequest(pub.id)}
                              disabled={cancelingId === pub.id}
                            >
                              {cancelingId === pub.id ? "Cancelando..." : "Cancelar solicitud"}
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
