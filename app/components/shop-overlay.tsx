"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Clock, Store } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import Mostrador from "@/app/tiendas/components/mostrador";
import MercanciaCard from "@/app/tiendas/components/mercancia-card";
import { type EventoTiendaAbierta } from "@/lib/types/sala";
import { getIconForString } from "@/lib/iconMapper";
import FantasyAlert from "@/components/ui/fantasy-alert";

const ShopPortal3D = dynamic(() => import("./shop-portal-3d"), { ssr: false });

type ShopOverlayProps = {
  eventos: EventoTiendaAbierta[];
  onClose: (tiendaId: string) => void;
  onBuySuccess?: (personaje: any, cart: any[], totalCost: number) => void;
  partidaId: string;
};

export default function ShopOverlay({ eventos, onClose, onBuySuccess, partidaId }: ShopOverlayProps) {
  const { user, token, refreshUser } = useAuth();
  const [activeTiendaId, setActiveTiendaId] = useState<string>(eventos[0]?.tiendaId);
  
  // Update active tab if the current one is closed
  useEffect(() => {
    if (eventos.length > 0 && !eventos.find(e => e.tiendaId === activeTiendaId)) {
      setActiveTiendaId(eventos[0].tiendaId);
    }
  }, [eventos, activeTiendaId]);

  const activeEvento = eventos.find(e => e.tiendaId === activeTiendaId) || eventos[0];

  const [shop, setShop] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  
  // Cart state - temporary for the overlay
  const [cart, setCart] = useState<any[]>([]);
  const [mostradorOpen, setMostradorOpen] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [alert, setAlert] = useState<{ variant: "success" | "error" | "info", message: string } | null>(null);

  // Fetch shop details
  useEffect(() => {
    if (!activeEvento?.tiendaId) return;
    setIsLoading(true);
    fetch(`/api/tiendas?id=${activeEvento.tiendaId}`)
      .then((r) => r.json())
      .then((data) => setShop(data))
      .catch((e) => console.error("Error loading shop", e))
      .finally(() => setIsLoading(false));
  }, [activeEvento?.tiendaId]);

  // Fetch characters
  useEffect(() => {
    if (!user?.id || !token) return;
    fetch(`/api/profile?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const chars = (data.characters ?? [])
          .filter((c: any) => c.lifeStatus !== "muerto")
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            portrait: c.portrait,
            lifeStatus: "vivo",
            bagCapacity: c.bag?.maxSlots ?? 0,
            bagUsed: (c.bag?.items ?? []).length,
          }));
        setCharacters(chars);
        if (chars.length > 0) setSelectedCharId(chars[0].id);
      });
  }, [user?.id, token]);

  // Timer countdown
  useEffect(() => {
    if (!activeEvento?.expiraEn) {
      setTimeLeft(null);
      return;
    }
    
    const exp = new Date(activeEvento.expiraEn).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = exp - now;
      if (diff <= 0) {
        setTimeLeft("00:00");
        onClose(activeEvento.tiendaId);
        return;
      }
      
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeEvento?.expiraEn, activeEvento?.tiendaId, onClose]);

  const toggleItem = (item: any) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  
  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const n = i.qty + delta;
        if (n < 1) return i;
        if (i.stock !== null && n > i.stock) return i;
        return { ...i, qty: n };
      })
    );
  };
  
  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const buy = async () => {
    if (!token || !selectedCharId || cart.length === 0) return;
    setIsBuying(true);
    try {
      const res = await fetch("/api/tiendas/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          personajeId: selectedCharId,
          partidaId: partidaId, // Bypass flag
          items: cart.map((i) => ({ articuloTiendaId: i.articuloTiendaId, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al comprar");
      
      // Broadcast success if hook provided
      if (onBuySuccess) {
        const char = characters.find(c => c.id === selectedCharId);
        if (char) {
          onBuySuccess(char, cart, totalCost);
        }
      }
      
      setCart([]);
      setMostradorOpen(false);
      setAlert({ variant: "success", message: "Compra realizada con éxito. Los objetos están en tu mochila." });
      
      // Refresh shop stock
      const shopRes = await fetch(`/api/tiendas?id=${activeEvento.tiendaId}`);
      if (shopRes.ok) setShop(await shopRes.json());
      
    } catch (e: any) {
      setAlert({ variant: "error", message: e.message });
    } finally {
      setIsBuying(false);
    }
  };

  const totalCost = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const hasCart = cart.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" />
      
      {/* Floating Magic Window */}
      <div className="relative flex flex-col w-full max-w-6xl h-full max-h-[85vh] rounded-3xl border border-amber-500/30 bg-background/95 shadow-2xl shadow-amber-900/20 pointer-events-auto overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        
        {/* Top Bar with Timer */}
        <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-black/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            <div className="flex shrink-0 items-center gap-2 mr-2">
              <Store className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <span className="font-bold text-foreground">Tiendas:</span>
            </div>
            <div className="flex items-center gap-2">
              {eventos.map((ev) => (
                <button
                  key={ev.tiendaId}
                  onClick={() => setActiveTiendaId(ev.tiendaId)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-all duration-300 ${
                    activeTiendaId === ev.tiendaId
                      ? "bg-amber-500 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                      : "bg-black/40 text-amber-400 hover:bg-white/10 hover:text-amber-300"
                  }`}
                >
                  {ev.tiendaNombre}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            {timeLeft && (
              <div className="flex items-center gap-2 rounded-full bg-red-950/40 px-3 py-1 text-sm font-bold text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <Clock className="h-4 w-4" />
                {timeLeft}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto custom-scrollbar">
        {/* 3D Scene Background Header */}
        <ShopPortal3D />
        
        <div className="relative z-10 mx-auto max-w-5xl px-4 pb-32 pt-24">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
          ) : !shop ? (
            <div className="text-center text-muted-foreground">Tienda no encontrada.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shop.items.map((item: any, i: number) => (
                <MercanciaCard
                  key={item.id}
                  {...item}
                  index={i}
                  enCarrito={cart.find((c) => c.id === item.id)?.qty ?? 0}
                  puedePagar={true}
                  onAdd={() => toggleItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

        {/* Floating Cart Button */}
        {hasCart && !mostradorOpen && (
          <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-in slide-in-from-bottom-10 fade-in zoom-in-95">
            <button
              onClick={() => setMostradorOpen(true)}
              className="flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-3 font-bold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-transform hover:scale-105 active:scale-95"
            >
              Ver Compra ({cart.reduce((s, i) => s + i.qty, 0)}) — {totalCost} oro
            </button>
          </div>
        )}

        {/* Mostrador (Checkout Overlay) */}
        {mostradorOpen && (
          <Mostrador
            lineas={cart}
            personajes={characters}
            seleccionadoId={selectedCharId}
            oro={user?.oro ?? 0}
            total={totalCost}
            necesitaBolsa={cart.some((i) => i.category !== "ejercito")}
            comprando={isBuying}
            error={alert?.variant === "error" ? alert.message : null}
            onQty={updateQty}
            onQuitar={removeItem}
            onSeleccionar={setSelectedCharId}
            onConfirmar={buy}
            onClose={() => setMostradorOpen(false)}
          />
        )}
        
        <FantasyAlert 
          open={alert !== null} 
          variant={alert?.variant ?? "info"} 
          message={alert?.message ?? ""} 
          onClose={() => setAlert(null)} 
        />
      </div>
    </div>
  );
}
