"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Coins,
  X,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ItemRarity } from "@/lib/item-catalog";

type ShopItem = {
  id: string;
  articuloTiendaId: number;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  category: string;
  stock: number | null;
  icon: string;
};

type CartEntry = ShopItem & { qty: number };

type Character = {
  id: number;
  name: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  bagCapacity: number;
  bagUsed: number;
};

export default function GlobalCartWidget() {
  const pathname = usePathname();
  const { user, refreshUser } = useAuth();

  const cartKey = user?.id ? `mc_tiendas_cart_${user.id}` : null;
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [notification, setNotification] = useState<React.ReactNode | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Load and sync cart from localStorage keyed by user.id
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

  // Save changes to localStorage when cart changes from within this component
  const updateCart = (newCart: CartEntry[]) => {
    setCart(newCart);
    if (!cartKey) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(newCart));
      window.dispatchEvent(new Event("cart:update"));
    } catch {}
  };

  // Load characters when buy modal opens
  useEffect(() => {
    if (!buyModalOpen || !user?.id) return;
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
      )
      .catch(() => {});
  }, [buyModalOpen, user?.id]);

  // Ocultar si no hay sesión activa o si estamos dentro de /tiendas
  if (!user?.id || pathname === "/tiendas") {
    return null;
  }

  const cartTotal = cart.reduce((sum, e) => sum + e.price * e.qty, 0);
  const cartCount = cart.reduce((sum, e) => sum + e.qty, 0);
  const canAfford = (user?.oro ?? 0) >= cartTotal && cartTotal > 0;

  if (cartCount === 0 && !notification) {
    return null;
  }

  const removeFromCart = (id: string) => {
    updateCart(cart.filter((e) => e.id !== id));
  };

  const changeQty = (id: string, delta: number) => {
    const updated = cart
      .map((e) => {
        if (e.id !== id) return e;
        const maxQty = e.stock ?? Infinity;
        return { ...e, qty: Math.min(Math.max(e.qty + delta, 1), maxQty) };
      })
      .filter((e) => e.qty > 0);
    updateCart(updated);
  };

  const showNotification = (msg: React.ReactNode) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBuy = () => {
    setBuyError(null);
    setSelectedCharId(null);
    setBuyModalOpen(true);
  };

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

      // Éxito
      updateCart([]);
      setBuyModalOpen(false);
      setCartOpen(false);
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
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Compra completada · Saldo: {(data.oro ?? 0).toLocaleString()} <Coins className="w-4 h-4 text-yellow-500" />
        </span>,
      );
    } catch {
      setBuyError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <>
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
                  <span className="flex items-center justify-center text-[#D4AF37] shrink-0">
                    {getIconForString(e.name, "w-6 h-6", e.icon)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.price.toLocaleString()} <Coins className="w-3.5 h-3.5 inline-block text-yellow-500 -mt-0.5" /> c/u
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
                    {(e.price * e.qty).toLocaleString()} <Coins className="w-3.5 h-3.5 inline-block text-yellow-500 -mt-0.5" />
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
                    {(cartTotal - (user?.oro ?? 0)).toLocaleString()} <Coins className="w-3.5 h-3.5 inline-block text-yellow-500 -mt-0.5" />
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
                <CardTitle className="text-gold">¿A qué personaje va?</CardTitle>
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
                  {cartTotal.toLocaleString()} <Coins className="w-3.5 h-3.5 inline-block text-yellow-500 -mt-0.5" />
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
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="flex items-center justify-center text-[#D4AF37]">
                        {getIconForString(item.name, "w-5 h-5", item.icon)}
                      </span>
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
                            <CheckCircle2 className="w-3.5 h-3.5" />
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
    </>
  );
}
