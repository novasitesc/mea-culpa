"use client";

// Tiendas (/tiendas): el mercado del reino.
//
// Dos vistas: la fila de puestos y el interior de un puesto. La compra entera
// se resuelve en la RPC `comprar_en_tienda` a través de POST /api/tiendas/comprar
// —stock, oro, bolsa y ejército cambian de golpe o no cambian—, y se cierra en
// un solo panel (components/mostrador.tsx) en vez de dos modales encadenados.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingCart, Coins, ChevronLeft, CheckCircle2, MapPin, Store, Lock,
} from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import { type ItemRarity } from "@/lib/item-catalog";
import { TIPO_EJERCITO } from "@/lib/ejercito";
import { temaTienda, fraseTendero, type SituacionTendero } from "@/lib/tienda-tema";
import PuestoCard from "./components/puesto-card";
import MercanciaCard from "./components/mercancia-card";
import Tendero from "./components/tendero";
import Mostrador from "./components/mostrador";

// ─── Tipos (espejo de la API) ─────────────────────────────────────────────

type ItemCategory =
  | "consumible"
  | "arma"
  | "armadura"
  | "accesorio"
  | "ingrediente"
  | "misc"
  // Va al inventario de ejército, no a la bolsa.
  | "ejército";

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

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Componente principal ─────────────────────────────────────────────────

export default function TiendasPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();
  const [shops, setShops] = useState<ShopListItem[]>([]);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const cartKey = user?.id ? `mc_tiendas_cart_${user.id}` : null;
  const [cart, setCart] = useState<CartEntry[]>([]);

  useEffect(() => {
    if (!cartKey) {
      setCart([]);
      return;
    }
    try {
      localStorage.removeItem("mc_tiendas_cart");
    } catch {}

    const loadCart = () => {
      try {
        const saved = localStorage.getItem(cartKey);
        const parsed = saved ? JSON.parse(saved) : [];
        setCart((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
          return parsed;
        });
      } catch {
        setCart([]);
      }
    };

    loadCart();
    window.addEventListener("storage", loadCart);
    window.addEventListener("cart:update", loadCart);
    return () => {
      window.removeEventListener("storage", loadCart);
      window.removeEventListener("cart:update", loadCart);
    };
  }, [cartKey]);

  useEffect(() => {
    if (!cartKey) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
      window.dispatchEvent(new Event("cart:update"));
    } catch {}
  }, [cart, cartKey]);

  const [mostradorOpen, setMostradorOpen] = useState(false);
  const [notification, setNotification] = useState<React.ReactNode | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  // Lo que dice el tendero ahora mismo; `turno` rota la frase para que no repita.
  const [charla, setCharla] = useState<{ situacion: SituacionTendero; turno: number }>({
    situacion: "bienvenida",
    turno: 0,
  });

  const decir = useCallback((situacion: SituacionTendero) => {
    setCharla((prev) => ({ situacion, turno: prev.turno + 1 }));
  }, []);

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
    fetch(`/api/profile?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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
  }, [user?.id, token]);

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
    setCharla({ situacion: "bienvenida", turno: 0 });
    fetch(`/api/tiendas?id=${id}`)
      .then((r) => r.json())
      .then((data: Shop) => setActiveShop(data))
      .finally(() => setIsLoadingShop(false));
  };

  // Nivel > 10 abre todos los puestos; si no, manda el mínimo de cada uno.
  const tieneAcceso = useCallback(
    (minLevel?: number) =>
      Boolean((user && user.level > 10) || !minLevel || (user && user.level >= minLevel)),
    [user],
  );

  const categories = activeShop
    ? ["all", ...Array.from(new Set(activeShop.items.map((i) => i.category)))]
    : [];

  const visibleItems = activeShop
    ? activeShop.items.filter((i) => filterCategory === "all" || i.category === filterCategory)
    : [];

  // ── Carrito ──────────────────────────────────────────────────────────────

  const enCarrito = useCallback(
    (id: string) => cart.find((e) => e.id === id)?.qty ?? 0,
    [cart],
  );

  const showNotification = (msg: React.ReactNode) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const addToCart = (item: ShopItem) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.id === item.id);
      if (existing) {
        const maxQty = item.stock ?? Infinity;
        if (existing.qty >= maxQty) return prev;
        return prev.map((e) => (e.id === item.id ? { ...e, qty: e.qty + 1 } : e));
      }
      return [...prev, { ...item, qty: 1 }];
    });

    // El tendero comenta según lo que acabas de coger y lo que llevas encima.
    const oro = user?.oro ?? 0;
    decir(item.price > oro ? "sinOro" : item.price > oro * 0.4 ? "caro" : "anadido");

    showNotification(
      <span className="flex items-center gap-1.5">
        <ShoppingCart className="h-4 w-4 text-[#D4AF37]" /> {item.name} al carrito
      </span>,
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (next.length === 0) decir("vacio");
      return next;
    });
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

  const cartTotal = useMemo(() => cart.reduce((s, e) => s + e.price * e.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, e) => s + e.qty, 0), [cart]);
  // Las unidades de ejército no ocupan bolsa: si el carrito solo las lleva,
  // un personaje con la mochila llena puede comprar igualmente.
  const cartNeedsBag = useMemo(() => cart.some((e) => e.category !== TIPO_EJERCITO), [cart]);

  const confirmBuy = async () => {
    if (!selectedCharId || isBuying) return;

    const selectedCharacter = characters.find((c) => c.id === selectedCharId);
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
          items: cart.map((e) => ({ articuloTiendaId: e.articuloTiendaId, qty: e.qty })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBuyError(data.error ?? "Error al procesar la compra");
        return;
      }

      // Éxito — descontar stock local, vaciar carrito y refrescar oro.
      const purchasedCart = [...cart];
      setActiveShop((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => {
            const purchased = purchasedCart.find((e) => e.id === item.id);
            if (!purchased || item.stock === null) return item;
            return { ...item, stock: Math.max(0, item.stock - purchased.qty) };
          }),
        };
      });
      setCart([]);
      setMostradorOpen(false);
      // Solo lo que va a la mochila ocupa hueco; el ejército tiene el suyo.
      const huecosOcupados = purchasedCart.filter((e) => e.category !== TIPO_EJERCITO).length;
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === selectedCharId ? { ...c, bagUsed: c.bagUsed + huecosOcupados } : c,
        ),
      );
      await refreshUser();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:refresh", {
            detail: { oro: typeof data?.oro === "number" ? data.oro : undefined },
          }),
        );
      }
      decir("compra");
      showNotification(
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Compra completada · Saldo:{" "}
          {(data.oro ?? 0).toLocaleString()} <Coins className="h-4 w-4 text-yellow-500" />
        </span>,
      );
    } catch {
      setBuyError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsBuying(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const tema = activeShop
    ? temaTienda(activeShop.id, `${activeShop.name} ${activeShop.description}`)
    : null;
  const frase = activeShop
    ? fraseTendero(charla.situacion, activeShop.id, charla.turno)
    : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Fondo textura */}
      <div
        className="pointer-events-none fixed inset-0 opacity-5"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl p-4">
        <Header />

        {/* Aviso flotante */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg border border-gold/50 bg-[#12100d]/95 px-4 py-2 font-sans text-sm text-[#e8d8b0] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)] backdrop-blur"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón del mostrador */}
        <AnimatePresence>
          {cartCount > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              whileHover={{ y: -3 }}
              onClick={() => {
                setBuyError(null);
                setMostradorOpen(true);
              }}
              // bottom-24: el widget de "Reportar" ocupa bottom-6 right-6 con
              // z-50 y tapaba el carrito entero.
              className="fixed bottom-24 right-6 z-40 flex items-center gap-2.5 rounded-full border border-gold/60 bg-[#12100d]/95 px-5 py-3 font-sans text-sm font-semibold text-gold shadow-[0_12px_36px_-12px_rgba(212,175,55,0.7)] backdrop-blur transition-colors hover:bg-[#1c1710]"
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-background tabular-nums">
                  {cartCount}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                {cartTotal.toLocaleString("es-ES")} <Coins className="h-3.5 w-3.5" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
          <Sidebar />

          <div className="min-h-screen">
            {/* ── Vista: fila de puestos ───────────────────────────────────── */}
            {!activeShop && (
              <>
                <div className="mb-6">
                  <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold/60">
                    Mercado del reino
                  </p>
                  <h1 className="mt-0.5 flex items-center gap-2 font-serif text-2xl text-[#D4AF37]">
                    <Store className="h-6 w-6" />
                    Los puestos
                  </h1>
                  <p className="mt-1 font-sans text-sm text-muted-foreground">
                    Cada comerciante trae lo suyo. Algunos no abren para cualquiera.
                  </p>
                </div>

                {isLoadingShops ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="h-56 animate-pulse rounded-xl border border-[#2a241a] bg-card/50"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shops.map((shop, i) => (
                      <PuestoCard
                        key={shop.id}
                        {...shop}
                        index={i}
                        hasAccess={tieneAcceso(shop.minLevel)}
                        onOpen={() => openShop(shop.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Vista: dentro del puesto ─────────────────────────────────── */}
            {activeShop && tema && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveShop(null)}
                  className="mb-4 inline-flex items-center gap-1.5 font-sans text-xs text-foreground/50 transition-colors hover:text-gold"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver al mercado
                </button>

                {isLoadingShop ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-56 animate-pulse rounded-xl border border-[#2a241a] bg-card/50" />
                    ))}
                  </div>
                ) : !tieneAcceso(activeShop.minLevel) ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#3a3020] py-20 text-center">
                    <Lock className="h-8 w-8 text-foreground/30" />
                    <div>
                      <h2 className="font-serif text-xl text-[#e8d8b0]">Puesto cerrado</h2>
                      <p className="mt-1 font-sans text-sm text-muted-foreground">
                        {activeShop.name} abre a nivel {activeShop.minLevel}.
                      </p>
                      <p className="mt-0.5 font-sans text-xs text-foreground/35">
                        Tu nivel: {user?.level ?? "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Estandarte del puesto */}
                    <motion.div
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="mb-5 overflow-hidden rounded-xl border border-[#3a3020]"
                      style={{ background: `linear-gradient(180deg, ${tema.deep} 0%, #0d0b08 70%)` }}
                    >
                      <span
                        aria-hidden
                        className="block h-8 w-full"
                        style={{
                          backgroundImage: `repeating-linear-gradient(135deg, ${tema.accent} 0 16px, #f5e6c8 16px 32px)`,
                          opacity: 0.85,
                          boxShadow: "inset 0 -7px 12px -7px rgba(0,0,0,0.9)",
                        }}
                      />
                      <span
                        aria-hidden
                        className="block h-1.5 w-full"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, transparent 0 7px, rgba(0,0,0,0.55) 7px 9px)",
                        }}
                      />

                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3.5">
                          <span
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
                            style={{
                              borderColor: `${tema.accent}66`,
                              background: `radial-gradient(circle at 50% 35%, ${tema.accent}26, transparent 70%)`,
                              color: tema.accent,
                            }}
                          >
                            {getIconForString(activeShop.name, "w-8 h-8", activeShop.icon)}
                          </span>
                          <div className="min-w-0">
                            <h1 className="truncate font-serif text-xl text-[#D4AF37]">
                              {activeShop.name}
                            </h1>
                            <p className="mt-0.5 inline-flex items-center gap-1 font-sans text-[11px] text-foreground/40">
                              <MapPin className="h-3 w-3 shrink-0" /> {activeShop.location}
                            </p>
                          </div>
                        </div>

                        <div className="sm:max-w-xs sm:flex-1">
                          <Tendero
                            shopId={activeShop.id}
                            shopName={`${activeShop.name} ${activeShop.description}`}
                            keeper={activeShop.keeper}
                            frase={frase}
                            situacion={charla.situacion}
                            fraseKey={charla.turno}
                          />
                        </div>
                      </div>

                      {activeShop.description?.trim() && (
                        <p className="border-t border-white/5 px-5 py-2.5 font-sans text-[11.5px] leading-relaxed text-foreground/45">
                          {activeShop.description}
                        </p>
                      )}
                    </motion.div>

                    {/* Estantes: filtro por categoría */}
                    {categories.length > 2 && (
                      <div className="mb-4 flex flex-wrap gap-1.5">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFilterCategory(cat)}
                            className={`relative rounded-full border px-3 py-1 font-sans text-[11px] capitalize transition-all ${
                              filterCategory === cat
                                ? "border-gold text-gold"
                                : "border-[#3a3020] text-foreground/45 hover:border-[#8B7355] hover:text-foreground/70"
                            }`}
                          >
                            {filterCategory === cat && (
                              <motion.span
                                layoutId="estante-activo"
                                transition={{ duration: 0.3, ease: EASE }}
                                className="absolute inset-0 rounded-full bg-gold/10"
                              />
                            )}
                            <span className="relative">{cat === "all" ? "Todo" : cat}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Mercancía */}
                    {visibleItems.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#3a3020] py-16 text-center font-sans text-sm italic text-foreground/30">
                        Nada en este estante hoy.
                      </p>
                    ) : (
                      <motion.div
                        layout
                        className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4"
                      >
                        <AnimatePresence mode="popLayout">
                          {visibleItems.map((item, i) => (
                            <MercanciaCard
                              key={item.id}
                              {...item}
                              index={i}
                              enCarrito={enCarrito(item.id)}
                              puedePagar={(user?.oro ?? 0) >= item.price}
                              onAdd={() => addToCart(item)}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mostrador: carrito, destinatario y cuentas en un solo panel */}
      <AnimatePresence>
        {mostradorOpen && (
          <Mostrador
            key="mostrador"
            lineas={cart.map((e) => ({
              id: e.id,
              name: e.name,
              icon: e.icon,
              price: e.price,
              qty: e.qty,
              rarity: e.rarity,
              stock: e.stock,
            }))}
            personajes={characters}
            seleccionadoId={selectedCharId}
            oro={user?.oro ?? 0}
            total={cartTotal}
            necesitaBolsa={cartNeedsBag}
            comprando={isBuying}
            error={buyError}
            onQty={changeQty}
            onQuitar={removeFromCart}
            onSeleccionar={setSelectedCharId}
            onConfirmar={confirmBuy}
            onClose={() => setMostradorOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
