"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Coins,
  Package,
  ChevronLeft,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ITEM_RARITY_BADGES,
  ITEM_RARITY_COLORS,
  type ItemRarity,
} from "@/lib/item-catalog";

// ─── Tipos (espejo de la API) ─────────────────────────────────────────────

type ItemCategory =
  | "consumible"
  | "arma"
  | "armadura"
  | "accesorio"
  | "ingrediente"
  | "misc";

type ShopItem = {
  id: string;
  articuloTiendaId: number;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  category: ItemCategory;
  stock: number | null;
  icon: string;
};

type Character = {
  id: number;
  name: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  bagCapacity: number;
  bagUsed: number;
};

type Shop = {
  id: string;
  name: string;
  description: string;
  icon: string;
  minLevel?: number;
  keeper: string;
  location: string;
  items: ShopItem[];
};

type ShopListItem = Omit<Shop, "items"> & { itemCount: number };

type CartEntry = ShopItem & { qty: number };

// ─── Componente principal ─────────────────────────────────────────────────

export default function TiendasPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [shops, setShops] = useState<ShopListItem[]>([]);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Cargar lista de tiendas
  useEffect(() => {
    fetch("/api/tiendas")
      .then((r) => r.json())
      .then((data: ShopListItem[]) => setShops(data))
      .finally(() => setIsLoadingShops(false));
  }, []);

  // Cargar personajes del usuario (para el selector de bolsa al comprar)
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/profile?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) =>
        setCharacters(
          (data.characters ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            portrait: c.portrait,
            lifeStatus: c.lifeStatus === "muerto" ? "muerto" : "vivo",
            bagCapacity: c.bag?.maxSlots ?? 0,
            bagUsed: (c.bag?.items ?? []).length,
          })),
        ),
      );
  }, [user?.id]);

  useEffect(() => {
    if (characters.length === 0) return;
    const hasAnyAlive = characters.some((character) => character.lifeStatus !== "muerto");
    if (!hasAnyAlive) {
      router.replace("/profile?dead=1");
    }
  }, [characters, router]);

  // Cargar tienda seleccionada con sus items
  const openShop = (id: string) => {
    setIsLoadingShop(true);
    setFilterCategory("all");
    fetch(`/api/tiendas?id=${id}`)
      .then((r) => r.json())
      .then((data: Shop) => setActiveShop(data))
      .finally(() => setIsLoadingShop(false));
  };

  // Categorías únicas de la tienda activa
  const categories = activeShop
    ? ["all", ...Array.from(new Set(activeShop.items.map((i) => i.category)))]
    : [];

  const visibleItems = activeShop
    ? activeShop.items.filter(
        (i) => filterCategory === "all" || i.category === filterCategory,
      )
    : [];

  // ── Carrito ──────────────────────────────────────────────────────────────

  const addToCart = (item: ShopItem) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.id === item.id);
      if (existing) {
        const maxQty = item.stock ?? Infinity;
        if (existing.qty >= maxQty) return prev;
        return prev.map((e) =>
          e.id === item.id ? { ...e, qty: e.qty + 1 } : e,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    showNotification(`${item.icon} ${item.name} añadido al carrito`);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((e) => e.id !== id));
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((e) => {
          if (e.id !== id) return e;
          const maxQty = e.stock ?? Infinity;
          return { ...e, qty: Math.min(Math.max(e.qty + delta, 1), maxQty) };
        })
        .filter((e) => e.qty > 0),
    );
  };

  const cartTotal = cart.reduce((sum, e) => sum + e.price * e.qty, 0);
  const cartCount = cart.reduce((sum, e) => sum + e.qty, 0);
  const canAfford = (user?.oro ?? 0) >= cartTotal && cartTotal > 0;

  const handleBuy = () => {
    setBuyError(null);
    setSelectedCharId(null);
    setBuyModalOpen(true);
  };

  const confirmBuy = async () => {
    if (!selectedCharId || isBuying) return;

    const selectedCharacter = characters.find((character) => character.id === selectedCharId);
    if (!selectedCharacter || selectedCharacter.lifeStatus === "muerto") {
      setBuyError("Este personaje está muerto y no puede comprar.");
      return;
    }

    setIsBuying(true);
    setBuyError(null);
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const res = await fetch("/api/tiendas/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          personajeId: selectedCharId,
          items: cart.map((e) => ({
            articuloTiendaId: e.articuloTiendaId,
            qty: e.qty,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBuyError(data.error ?? "Error al procesar la compra");
        return;
      }

      // Éxito — limpiar estado, actualizar oro y mostrar notificación
      const purchasedCart = [...cart];
      const newPurchased = new Set(purchasedItems);
      purchasedCart.forEach((e) => newPurchased.add(e.id));
      setPurchasedItems(newPurchased);
      setActiveShop((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => {
            const purchased = purchasedCart.find((e) => e.id === item.id);
            if (!purchased || item.stock === null) return item;
            return {
              ...item,
              stock: Math.max(0, item.stock - purchased.qty),
            };
          }),
        };
      });
      setCart([]);
      setBuyModalOpen(false);
      setCartOpen(false);
      // Actualizar personajes para reflejar nueva bolsa
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === selectedCharId
            ? { ...c, bagUsed: c.bagUsed + purchasedCart.length }
            : c,
        ),
      );
      await refreshUser();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:refresh", {
            detail: {
              oro: typeof data?.oro === "number" ? data.oro : undefined,
            },
          }),
        );
      }
      showNotification(
        `✅ Compra completada · Saldo: ${(data.oro ?? 0).toLocaleString()} 🪙`,
      );
    } catch {
      setBuyError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsBuying(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Fondo textura */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        <Header />

        {/* Notificación flotante */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 bg-card border border-gold-dim text-foreground px-4 py-3 rounded-lg shadow-xl text-sm medieval-border animate-in slide-in-from-bottom-4">
            {notification}
          </div>
        )}

        {/* Botón carrito flotante */}
        {cartCount > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl font-medium transition-colors ${
              canAfford
                ? "bg-gold text-background hover:bg-gold-dim"
                : "bg-destructive/80 text-white hover:bg-destructive"
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount} objeto{cartCount !== 1 ? "s" : ""} ·{" "}
            {cartTotal.toLocaleString()}
            <Coins className="w-4 h-4" />
          </button>
        )}

        {/* Modal carrito */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-background/80"
              onClick={() => setCartOpen(false)}
            />
            <Card className="relative z-10 w-full max-w-md medieval-border border-gold-dim">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Carrito
                  </CardTitle>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {cart.map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{e.icon}</span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.price.toLocaleString()} 🪙 c/u
                      </p>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => changeQty(e.id, -1)}
                        className="w-6 h-6 rounded bg-secondary hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        title="Reducir"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {e.qty}
                      </span>
                      <button
                        onClick={() => changeQty(e.id, 1)}
                        className="w-6 h-6 rounded bg-secondary hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
                        title="Aumentar"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-sm font-bold text-gold shrink-0 w-16 text-right">
                      {(e.price * e.qty).toLocaleString()} 🪙
                    </span>

                    <button
                      onClick={() => removeFromCart(e.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="border-t border-border pt-3 flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span className="text-gold flex items-center gap-1">
                    {cartTotal.toLocaleString()} <Coins className="w-4 h-4" />
                  </span>
                </div>

                {!canAfford && (
                  <p className="text-xs text-destructive text-center">
                    Te faltan{" "}
                    <strong>
                      {(cartTotal - (user?.oro ?? 0)).toLocaleString()} 🪙
                    </strong>{" "}
                    para esta compra
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={handleBuy}
                  disabled={!canAfford}
                >
                  {canAfford ? "Confirmar compra" : "Oro insuficiente"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal: selección de personaje para recibir la compra */}
        {buyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-background/80"
              onClick={() => !isBuying && setBuyModalOpen(false)}
            />
            <Card className="relative z-10 w-full max-w-lg medieval-border border-gold-dim">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gold">
                    ¿A qué personaje va?
                  </CardTitle>
                  <button
                    onClick={() => setBuyModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={isBuying}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {cartCount} objeto{cartCount !== 1 ? "s" : ""} ·{" "}
                  <span className="text-gold font-semibold">
                    {cartTotal.toLocaleString()} 🪙
                  </span>
                </p>
              </CardHeader>

              <CardContent className="pt-4">
                {/* Vista previa de items a comprar */}
                <div className="mb-4 p-3 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Items a comprar:
                  </p>
                  <div className="space-y-1.5">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="font-semibold text-gold shrink-0">
                          ×{item.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {characters.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    No tienes personajes creados. Crea uno desde tu perfil.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {characters.map((char) => {
                      const isFull = char.bagUsed >= char.bagCapacity;
                      const isDead = char.lifeStatus === "muerto";
                      const isSelected = selectedCharId === char.id;
                      return (
                        <button
                          key={char.id}
                          onClick={() => !isFull && !isDead && setSelectedCharId(char.id)}
                          disabled={isFull || isDead}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                            isFull || isDead
                              ? "opacity-50 cursor-not-allowed border-border"
                              : isSelected
                                ? "border-gold bg-gold/10"
                                : "border-border hover:border-gold-dim"
                          }`}
                        >
                          <img
                            src={
                              char.portrait ||
                              "/characters/profileplaceholder.webp"
                            }
                            alt={char.name}
                            className="w-12 h-12 rounded object-cover shrink-0 bg-secondary"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {char.name}
                            </p>
                            <p
                              className={`text-xs mt-0.5 ${isFull || isDead ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              Bolsa: {char.bagUsed}/{char.bagCapacity}
                              {isDead ? " · Muerto" : isFull ? " · Llena" : ""}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="text-gold text-lg shrink-0">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {buyError && (
                  <p className="text-sm text-destructive text-center mb-3">
                    {buyError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setBuyModalOpen(false)}
                    disabled={isBuying}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={confirmBuy}
                    disabled={
                      !selectedCharId || isBuying || characters.length === 0
                    }
                  >
                    {isBuying ? "Comprando…" : "Comprar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Layout con sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 mt-4">
          <Sidebar />
          <div>
            {/* Título de sección */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gold tracking-wider font-sans flex items-center gap-2">
                  <Package className="w-7 h-7" />
                  Tiendas de Mea Culpa
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Explora los comerciantes del reino
                </p>
              </div>
              {activeShop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveShop(null)}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Volver a tiendas
                </Button>
              )}
            </div>

            {/* ── Vista: lista de tiendas ────────────────────────────────────── */}
            {!activeShop && (
              <div>
                {isLoadingShops ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="shop-card rounded-lg bg-card animate-pulse border border-border"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shops.map((shop) => {
                      // allow access to all shops if user is over level 10
                      const hasAccess =
                        (user && user.level > 10) ||
                        !shop.minLevel ||
                        (user && user.level >= shop.minLevel);

                      return (
                        <div key={shop.id} className="relative">
                          <Card
                            className={`medieval-border shop-card flex flex-col transition-all ${hasAccess ? "cursor-pointer hover:border-gold-dim hover:shadow-lg group" : "cursor-not-allowed opacity-75"}`}
                            onClick={() => hasAccess && openShop(shop.id)}
                          >
                            <CardHeader className="pb-2 pt-4 px-4">
                              <div className="flex items-start gap-2.5">
                                <span className="text-3xl shrink-0">
                                  {shop.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <CardTitle
                                    className={`text-sm line-clamp-1 transition-colors ${hasAccess ? "text-gold group-hover:text-gold-dim" : "text-muted-foreground"}`}
                                  >
                                    {shop.name}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {shop.location}
                                  </p>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col px-4 py-2">
                              <CardDescription className="text-xs leading-relaxed line-clamp-2 flex-1">
                                {shop.description}
                              </CardDescription>
                            </CardContent>
                            <div className="px-4 pb-3 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground italic line-clamp-1">
                                — {shop.keeper}
                              </span>
                              <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
                                {(shop as ShopListItem).itemCount}o
                              </span>
                            </div>
                          </Card>

                          {/* Overlay de incognito cuando no tiene acceso (mismo tamaño que la tarjeta) */}
                          {!hasAccess && (
                            <div className="absolute inset-0 rounded-lg overflow-hidden medieval-border border border-gold-dim/50">
                              <img
                                src="/incognito.png"
                                alt="Incógnito"
                                className="w-full h-full object-fill"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Vista: tienda individual ───────────────────────────────────── */}
            {activeShop && (
              <div>
                {isLoadingShop ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="h-52 rounded-lg bg-card animate-pulse border border-border"
                      />
                    ))}
                  </div>
                ) : (
                  (() => {
                    // desbloqueo global: cualquier usuario con nivel > 10 tiene acceso a todo
                    const hasAccess =
                      (user && user.level > 10) ||
                      !activeShop.minLevel ||
                      (user && user.level >= activeShop.minLevel);

                    if (!hasAccess) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-6 py-20">
                          <img
                            src="/incognito.png"
                            alt="Acceso denegado"
                            className="w-24 h-24 object-contain opacity-80"
                          />
                          <div className="text-center max-w-sm">
                            <h2 className="text-2xl font-bold text-gold mb-2">
                              Acceso restringido
                            </h2>
                            <p className="text-muted-foreground text-sm mb-4">
                              No tienes el nivel suficiente para acceder a{" "}
                              {activeShop.name}.
                            </p>
                            <p className="text-gold font-bold text-lg">
                              Nivel requerido: {activeShop.minLevel}
                            </p>
                            <p className="text-muted-foreground text-sm mt-2">
                              Tu nivel actual: {user?.level || "No definido"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setActiveShop(null)}
                            className="mt-4"
                          >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Volver a tiendas
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Cabecera de la tienda */}
                        <Card className="mb-6 border-gold-dim medieval-border">
                          <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              <span className="text-5xl">
                                {activeShop.icon}
                              </span>
                              <div className="flex-1">
                                <h2 className="text-xl font-bold text-gold font-sans">
                                  {activeShop.name}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {activeShop.description}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  📍 {activeShop.location} · Atendido por{" "}
                                  <strong>{activeShop.keeper}</strong>
                                </p>
                              </div>
                              {/* Filtro de categoría */}
                              <div className="shrink-0">
                                <Select
                                  value={filterCategory}
                                  onChange={(e) =>
                                    setFilterCategory(e.target.value)
                                  }
                                  className="w-44"
                                >
                                  {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat === "all"
                                        ? "Todas las categorías"
                                        : cat.charAt(0).toUpperCase() +
                                          cat.slice(1)}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Grid de items */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {visibleItems.map((item) => {
                            const bought = purchasedItems.has(item.id);
                            const outOfStock = item.stock === 0;
                            const inCart = cart.some((e) => e.id === item.id);

                            return (
                              <Card
                                key={item.id}
                                className={`flex flex-col border transition-all ${ITEM_RARITY_COLORS[item.rarity]} ${!bought && !outOfStock ? "hover:shadow-lg" : "opacity-60"}`}
                              >
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-3xl">
                                      {item.icon}
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${ITEM_RARITY_BADGES[item.rarity]}`}
                                    >
                                      {item.rarity}
                                    </span>
                                  </div>
                                  <CardTitle className="text-sm text-foreground mt-2 leading-tight">
                                    {item.name}
                                  </CardTitle>
                                </CardHeader>

                                <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                                  <CardDescription className="text-xs leading-relaxed flex-1">
                                    {item.description}
                                  </CardDescription>

                                  <div className="flex items-center justify-between mt-auto">
                                    {/* Precio */}
                                    <span className="flex items-center gap-1 font-bold text-gold text-sm">
                                      <Coins className="w-4 h-4" />
                                      {item.price.toLocaleString()}
                                    </span>
                                    {/* Stock */}
                                    {item.stock !== null && (
                                      <span className="text-xs text-muted-foreground">
                                        Stock: {item.stock}
                                      </span>
                                    )}
                                  </div>

                                  <Button
                                    size="sm"
                                    variant={inCart ? "secondary" : "default"}
                                    disabled={bought || outOfStock}
                                    onClick={() => addToCart(item)}
                                    className="w-full"
                                  >
                                    {bought
                                      ? "Comprado ✓"
                                      : outOfStock
                                        ? "Sin stock"
                                        : inCart
                                          ? "En carrito +"
                                          : "Añadir al carrito"}
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
