"use client";

import { useEffect, useState } from "react";
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

// ─── Tipos (espejo de la API) ─────────────────────────────────────────────

type ItemRarity = "común" | "poco común" | "raro" | "épico" | "legendario";
type ItemCategory =
  | "consumible"
  | "arma"
  | "armadura"
  | "accesorio"
  | "ingrediente"
  | "misc";

type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  category: ItemCategory;
  stock: number | null;
  icon: string;
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

// ─── Colores por rareza ────────────────────────────────────────────────────

const RARITY_COLORS: Record<ItemRarity, string> = {
  común: "text-muted-foreground border-border",
  "poco común": "text-green-400 border-green-800",
  raro: "text-blue-400 border-blue-800",
  épico: "text-purple-400 border-purple-800",
  legendario: "text-gold border-gold-dim",
};

const RARITY_BADGE: Record<ItemRarity, string> = {
  común: "bg-secondary text-muted-foreground",
  "poco común": "bg-green-900/50 text-green-400",
  raro: "bg-blue-900/50 text-blue-400",
  épico: "bg-purple-900/50 text-purple-400",
  legendario: "bg-gold/10 text-gold",
};

// ─── Componente principal ─────────────────────────────────────────────────

export default function TiendasPage() {
  const { user } = useAuth();
  const [shops, setShops] = useState<ShopListItem[]>([]);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  // Cargar lista de tiendas
  useEffect(() => {
    fetch("/api/tiendas")
      .then((r) => r.json())
      .then((data: ShopListItem[]) => setShops(data))
      .finally(() => setIsLoadingShops(false));
  }, []);

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
        .map((e) => (e.id === id ? { ...e, qty: e.qty + delta } : e))
        .filter((e) => e.qty > 0),
    );
  };

  const cartTotal = cart.reduce((sum, e) => sum + e.price * e.qty, 0);
  const cartCount = cart.reduce((sum, e) => sum + e.qty, 0);

  const handleBuy = () => {
    const newPurchased = new Set(purchasedItems);
    cart.forEach((e) => newPurchased.add(e.id));
    setPurchasedItems(newPurchased);
    setCart([]);
    setCartOpen(false);
    showNotification(
      `✅ Compra realizada por ${cartTotal.toLocaleString()} 🪙`,
    );
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
            className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-gold text-background px-4 py-3 rounded-lg shadow-xl font-medium hover:bg-gold-dim transition-colors"
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

                <Button className="w-full" onClick={handleBuy}>
                  Confirmar compra
                </Button>
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
                      const hasAccess = (user && user.level > 10) || !shop.minLevel || (user && user.level >= shop.minLevel);
                      
                      return (
                        <div key={shop.id} className="relative">
                          <Card
                            className={`medieval-border shop-card flex flex-col transition-all ${hasAccess ? "cursor-pointer hover:border-gold-dim hover:shadow-lg group" : "cursor-not-allowed opacity-75"}`}
                            onClick={() => hasAccess && openShop(shop.id)}
                          >
                            <CardHeader className="pb-2 pt-4 px-4">
                              <div className="flex items-start gap-2.5">
                                <span className="text-3xl flex-shrink-0">{shop.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <CardTitle className={`text-sm line-clamp-1 transition-colors ${hasAccess ? "text-gold group-hover:text-gold-dim" : "text-muted-foreground"}`}>
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
                              <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
                                {(shop as ShopListItem).itemCount}o
                              </span>
                            </div>
                          </Card>
                          
                          {/* Overlay de incognito cuando no tiene acceso (mismo tamaño que la tarjeta) */}
                          {!hasAccess && (
                            <div className="absolute inset-0 rounded-lg overflow-hidden medieval-border border border-gold-dim/50">
                              <img src="/incognito.png" alt="Incógnito" className="w-full h-full object-fill" />
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
                ) : (() => {
                  // desbloqueo global: cualquier usuario con nivel > 10 tiene acceso a todo
                  const hasAccess = (user && user.level > 10) || !activeShop.minLevel || (user && user.level >= activeShop.minLevel);
                  
                  if (!hasAccess) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-6 py-20">
                        <img src="/incognito.png" alt="Acceso denegado" className="w-24 h-24 object-contain opacity-80" />
                        <div className="text-center max-w-sm">
                          <h2 className="text-2xl font-bold text-gold mb-2">Acceso restringido</h2>
                          <p className="text-muted-foreground text-sm mb-4">
                            No tienes el nivel suficiente para acceder a {activeShop.name}.
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
                            <span className="text-5xl">{activeShop.icon}</span>
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
                              className={`flex flex-col border transition-all ${RARITY_COLORS[item.rarity]} ${!bought && !outOfStock ? "hover:shadow-lg" : "opacity-60"}`}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-3xl">{item.icon}</span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${RARITY_BADGE[item.rarity]}`}
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
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
