"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  motion,
  AnimatePresence,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { GoldAmountInput } from "@/components/ui/gold-amount-input";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import FantasyAlert from "@/components/ui/fantasy-alert";
import {
  Coins,
  Store,
  Tag,
  Inbox,
  Check,
  X,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import {
  isCommerceSoundEnabled,
  setCommerceSoundEnabled,
  primeCommerceSound,
  playCommerce,
} from "./commerce-sound";

const CommerceHero3D = dynamic(() => import("./commerce-hero-3d"), { ssr: false });

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
  lifeStatus: "vivo" | "muerto";
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

const ITEM_TYPE_ICONS: Record<string, string> = {
  cabeza: "🪖",
  armadura: "🛡️",
  pecho: "🛡️",
  guante: "🧤",
  botas: "🥾",
  collar: "📿",
  anillo: "💍",
  amuleto: "🔮",
  cinturón: "🪢",
  cinturon: "🪢",
  arma: "⚔️",
  consumible: "🧪",
  ingrediente: "🌿",
  misc: "📦",
};

const INITIAL_ALERT: AlertState = {
  open: false,
  title: "",
  message: "",
  variant: "info",
};

type TabKey = "mercado" | "ventas" | "compras";

// ---------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------

/** Polvo dorado ascendente sobre el fondo. Se desactiva con reduce-motion. */
function GoldSpecks() {
  const reduce = useReducedMotion();
  const specks = useMemo(() => {
    let a = 0x9e3779b9;
    const rnd = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: 22 }, () => ({
      left: rnd() * 100,
      size: 2 + rnd() * 3,
      delay: rnd() * 8,
      dur: 7 + rnd() * 7,
      drift: (rnd() - 0.5) * 60,
    }));
  }, []);
  if (reduce) return null;
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {specks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-gold/70"
          style={{
            left: `${s.left}%`,
            bottom: -12,
            width: s.size,
            height: s.size,
            boxShadow: "0 0 6px rgba(212,175,55,0.8)",
          }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -1100, x: s.drift, opacity: [0, 0.85, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/** Tarjeta con inclinación 3D siguiendo el puntero + brillo. */
function TiltCard({
  children,
  className,
  index = 0,
  onHover,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  onHover?: () => void;
}) {
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 220, damping: 18 });
  const ry = useSpring(0, { stiffness: 220, damping: 18 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseEnter={onHover}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: "spring", stiffness: 260, damping: 24 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const RAREZA_COLOR: Record<string, string> = {
  comun: "#9ca3af",
  común: "#9ca3af",
  poco_comun: "#4ade80",
  raro: "#60a5fa",
  epico: "#c084fc",
  épico: "#c084fc",
  legendario: "#f59e0b",
};

/** Marco con textura + brillo mostrando el icono real del ítem, teñido por rareza. */
function ItemGlyph({ nombre, icono, rareza }: { nombre: string; icono: string; tipo: string; rareza: string }) {
  const color = RAREZA_COLOR[rareza?.toLowerCase()] ?? "#D4AF37";
  return (
    <div
      className="relative shrink-0 w-14 h-14 rounded-lg grid place-items-center border overflow-hidden"
      style={{
        borderColor: `${color}66`,
        background: `radial-gradient(circle at 40% 30%, ${color}22, transparent 70%), linear-gradient(145deg, rgba(0,0,0,0.35), rgba(0,0,0,0.1))`,
        boxShadow: `inset 0 0 12px ${color}22`,
        color,
      }}
    >
      {getIconForString(nombre, "w-8 h-8 drop-shadow", icono)}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function ComercioPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [market, setMarket] = useState<Publicacion[]>([]);
  const [mine, setMine] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [cancelingPublicationId, setCancelingPublicationId] =
    useState<number | null>(null);
  const [selectedSellerCharacterId, setSelectedSellerCharacterId] = useState<number | null>(null);
  const [selectedBuyerCharacterId, setSelectedBuyerCharacterId] = useState<number | null>(null);
  const [selectedBagRowId, setSelectedBagRowId] = useState<number | null>(null);
  const [publishPrice, setPublishPrice] = useState<string>("");
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);
  const [tab, setTab] = useState<TabKey>("mercado");
  const [sound, setSound] = useState(false);

  useEffect(() => setSound(isCommerceSoundEnabled()), []);

  const showAlert = useCallback(
    (title: string, message: string, variant: AlertState["variant"]) => {
      setAlert({ open: true, title, message, variant });
    },
    [],
  );

  const emitAuthRefresh = useCallback((oro?: number) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("auth:refresh", {
        detail: { oro },
      }),
    );
  }, []);

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

      const firstCharacterId =
        safeProfile.characters?.find((character) => character.lifeStatus !== "muerto")?.id ??
        null;
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

  useEffect(() => {
    const characters = profile?.characters ?? [];
    if (characters.length === 0) return;
    const hasAnyAlive = characters.some((character) => character.lifeStatus !== "muerto");
    if (!hasAnyAlive) {
      router.replace("/profile?dead=1");
    }
  }, [profile?.characters, router]);

  const sellerCharacter = useMemo(
    () => profile?.characters.find((c) => c.id === selectedSellerCharacterId) ?? null,
    [profile?.characters, selectedSellerCharacterId],
  );

  const publishableItems = useMemo(() => {
    if (!sellerCharacter) return [];
    if (sellerCharacter.lifeStatus === "muerto") return [];
    return sellerCharacter.bag.items.filter(
      (item) => !item.fueComerciado && !item.publicadoEnTrade,
    );
  }, [sellerCharacter]);

  const sellerInventoryOptions = useMemo<ObjectSelectorItem[]>(() => {
    if (!sellerCharacter || sellerCharacter.lifeStatus === "muerto") {
      return [];
    }

    return sellerCharacter.bag.items.map((item) => ({
      value: item.bagRowId,
      name: `${item.name} • ${(item.price ?? 0).toLocaleString()} oro`,
      icon: ITEM_TYPE_ICONS[item.type] ?? "📦",
      qty: item.cantidad ?? 1,
      searchText: `${item.name} ${item.type} ${item.price ?? 0}`,
      fueComerciado: item.fueComerciado,
      publicadoEnTrade: item.publicadoEnTrade,
    }));
  }, [sellerCharacter]);

  const aliveCharacters = useMemo(
    () => (profile?.characters ?? []).filter((character) => character.lifeStatus !== "muerto"),
    [profile?.characters],
  );

  // Sin selección por defecto: arranca vacío; solo se limpia si la elección
  // actual deja de ser publicable (cambio de personaje, ya vendido/publicado).
  useEffect(() => {
    setSelectedBagRowId((prev) =>
      prev != null && publishableItems.some((item) => item.bagRowId === prev) ? prev : null,
    );
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
      playCommerce("error");
      showAlert("Datos faltantes", "Selecciona personaje y objeto", "warning");
      return;
    }

    const parsedPrice = Math.floor(Number(publishPrice));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      playCommerce("error");
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

      playCommerce("publish");
      showAlert("Publicado", "Tu objeto fue publicado en el mercado", "success");
      await loadData();
    } catch (error) {
      playCommerce("error");
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
      playCommerce("error");
      showAlert(
        "Falta personaje",
        "Selecciona el personaje comprador antes de solicitar",
        "warning",
      );
      return;
    }

    const buyerCharacter = aliveCharacters.find(
      (character) => character.id === selectedBuyerCharacterId,
    );
    if (!buyerCharacter) {
      playCommerce("error");
      showAlert(
        "Personaje inválido",
        "El personaje comprador está muerto o no disponible.",
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

      playCommerce("coins");
      showAlert("Solicitud enviada", "El vendedor debe aprobar la compra", "success");
      emitAuthRefresh(typeof data?.oro === "number" ? data.oro : undefined);
      await refreshUser();
      await loadData();
    } catch (error) {
      playCommerce("error");
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

      playCommerce("click");
      showAlert(
        "Solicitud cancelada",
        "Se devolvió el oro reservado por esta compra",
        "info",
      );
      emitAuthRefresh(
        typeof data?.refundedGold === "number" ? data.refundedGold : undefined,
      );
      await refreshUser();
      await loadData();
    } catch (error) {
      playCommerce("error");
      showAlert(
        "No se pudo cancelar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setCancelingId(null);
    }
  };

  const cancelPublication = async (publicationId: number) => {
    if (!authHeaders) return;

    setCancelingPublicationId(publicationId);
    try {
      const res = await fetch(`/api/comercio/publicaciones/${publicationId}/cancelar`, {
        method: "POST",
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cancelar la publicación");
      }

      playCommerce("click");
      showAlert(
        "Publicación cancelada",
        data.refundedGold != null
          ? "Se canceló y se reembolsó el oro al comprador"
          : "Se canceló tu publicación",
        "info",
      );

      emitAuthRefresh();
      await refreshUser();
      await loadData();
    } catch (error) {
      playCommerce("error");
      showAlert(
        "No se pudo cancelar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setCancelingPublicationId(null);
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

      playCommerce(action === "aceptar" ? "coins" : "error");
      showAlert(
        action === "aceptar" ? "Venta completada" : "Solicitud rechazada",
        action === "aceptar"
          ? "La venta fue completada y el objeto ya no podrá re-comerciarse"
          : "La publicación vuelve a estar disponible",
        action === "aceptar" ? "success" : "info",
      );

      if (action === "aceptar") {
        emitAuthRefresh(
          typeof data?.sellerGold === "number" ? data.sellerGold : undefined,
        );
      }

      await refreshUser();
      await loadData();
    } catch (error) {
      playCommerce("error");
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

  const userGold = Number(user?.oro ?? profile?.player?.oro ?? 0);

  const toggleSound = () => {
    setSound((v) => {
      setCommerceSoundEnabled(!v);
      return !v;
    });
    primeCommerceSound();
    playCommerce("click");
  };

  const goTab = (t: TabKey) => {
    setTab(t);
    playCommerce("click");
  };

  const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode; badge?: number }> = [
    { key: "mercado", label: "Mercado", icon: <Store className="w-4 h-4" /> },
    {
      key: "ventas",
      label: "Mis ventas",
      icon: <Tag className="w-4 h-4" />,
      badge: myPendingRequests.length,
    },
    {
      key: "compras",
      label: "Mis compras",
      icon: <Inbox className="w-4 h-4" />,
      badge: myRequestedPublications.length,
    },
  ];

  return (
    <div
      className="relative min-h-screen bg-background overflow-hidden"
      onPointerDown={primeCommerceSound}
    >
      <FantasyAlert
        open={alert.open}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
        onClose={() => setAlert(INITIAL_ALERT)}
      />

      {/* Textura de fondo + resplandor dorado + polvo */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: "radial-gradient(circle, rgba(212,175,55,0.25), transparent 70%)" }}
      />
      <GoldSpecks />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 mt-4">
          <Sidebar />

          <div className="space-y-5">
            {/* ---------- HERO ---------- */}
            <div className="relative overflow-hidden rounded-2xl border border-gold-dim/60 medieval-border">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(145deg, rgba(20,15,5,0.6), rgba(5,5,5,0.3))" }}
              />
              <div className="relative grid md:grid-cols-[1fr_260px] gap-4 items-center p-6 md:p-8">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-gold/60 font-sans flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Casa de Mercaderes
                  </p>
                  <h1
                    className="text-3xl md:text-4xl font-serif text-gold leading-tight"
                    style={{ textShadow: "0 0 20px rgba(212,175,55,0.35)" }}
                  >
                    Comercio entre personajes
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Publica reliquias de tu bolsa, negocia con otros aventureros y haz
                    circular el oro del reino. Cada objeto vendido queda sellado para siempre.
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5">
                    <Coins className="w-4 h-4 text-gold" />
                    <span className="font-serif font-bold text-gold">
                      {userGold.toLocaleString("es-ES")}
                    </span>
                    <span className="text-xs text-gold/60">oro en tu bolsa</span>
                  </div>
                </div>
                <div className="relative h-40 md:h-52">
                  <CommerceHero3D />
                </div>
              </div>

              {/* Barrido de brillo del hero */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-gold/15 to-transparent"
                  style={{ animation: "asc-shine-sweep 5s ease-in-out infinite" }}
                />
              </div>

              <button
                onClick={toggleSound}
                className="absolute top-4 right-4 z-20 p-2 rounded border border-gold-dim/40 text-gold/70 hover:text-gold hover:border-gold/60 transition-colors bg-card/60"
                aria-label={sound ? "Silenciar comercio" : "Activar sonido"}
              >
                {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            {/* ---------- TABS ---------- */}
            <div className="flex gap-2 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => goTab(t.key)}
                  onMouseEnter={() => playCommerce("hover")}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-sans font-semibold border transition-colors ${
                    tab === t.key
                      ? "border-gold/70 text-gold bg-gold/10"
                      : "border-border text-muted-foreground hover:text-gold hover:border-gold-dim/60"
                  }`}
                >
                  {tab === t.key && (
                    <motion.span
                      layoutId="tab-glow"
                      className="absolute inset-0 rounded-lg bg-gold/5"
                      style={{ boxShadow: "inset 0 0 16px rgba(212,175,55,0.25)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{t.icon}</span>
                  <span className="relative">{t.label}</span>
                  {t.badge ? (
                    <span className="relative min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-blood text-[11px] font-bold text-parchment">
                      {t.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* ---------- CONTENIDO ---------- */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {tab === "mercado" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border border-border bg-card/40 p-4">
                      <div className="space-y-1.5 flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                          Compras con el personaje
                        </p>
                        <Select
                          value={selectedBuyerCharacterId?.toString() ?? ""}
                          onChange={(e) => setSelectedBuyerCharacterId(Number(e.target.value))}
                        >
                          {aliveCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-right">
                        {marketItems.length} publicaci{marketItems.length === 1 ? "ón" : "ones"} en venta
                      </p>
                    </div>

                    {loading ? (
                      <p className="text-sm text-muted-foreground">Cargando mercado…</p>
                    ) : marketItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gold-dim/40 p-10 text-center">
                        <Store className="w-8 h-8 mx-auto text-gold/40 mb-2" />
                        <p className="text-sm text-muted-foreground">El mercado está vacío por ahora.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {marketItems.map((pub, i) => {
                          const isAvailable = pub.estado === "publicado";
                          const isMyPendingRequest =
                            pub.estado === "solicitado" && pub.compradorUsuarioId === user?.id;
                          const canAfford = userGold >= pub.precio;
                          const busy = requestingId === pub.id || cancelingId === pub.id;
                          const rareColor = RAREZA_COLOR[pub.item.rareza?.toLowerCase()] ?? "#D4AF37";
                          return (
                            <TiltCard
                              key={pub.id}
                              index={i}
                              onHover={() => playCommerce("hover")}
                              className="group relative rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-3 hover:border-gold/50 transition-colors reward-texture"
                            >
                              <div
                                aria-hidden
                                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{ boxShadow: `inset 0 0 30px ${rareColor}22` }}
                              />
                              <div className="relative flex items-start gap-3">
                                <ItemGlyph
                                  nombre={pub.item.nombre}
                                  icono={pub.item.icono}
                                  tipo={pub.item.tipo}
                                  rareza={pub.item.rareza}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="font-serif text-foreground leading-tight truncate">
                                    {pub.item.nombre}
                                    {pub.item.cantidad > 1 && (
                                      <span className="text-muted-foreground text-sm"> ×{pub.item.cantidad}</span>
                                    )}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: rareColor }}>
                                    {pub.item.rareza || pub.item.tipo}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    por {pub.vendedor.nombre}
                                  </p>
                                </div>
                              </div>

                              <div className="relative flex items-center justify-between gap-2 mt-auto pt-2 border-t border-gold-dim/20">
                                <span className="inline-flex items-center gap-1.5 text-gold font-serif font-bold">
                                  <Coins className="w-4 h-4" />
                                  {(pub.precio ?? 0).toLocaleString("es-ES")}
                                </span>
                                <Button
                                  size="sm"
                                  variant={isMyPendingRequest ? "outline" : "default"}
                                  onClick={() =>
                                    isMyPendingRequest ? cancelRequest(pub.id) : requestPurchase(pub.id)
                                  }
                                  disabled={busy || (!isMyPendingRequest && (!isAvailable || !canAfford))}
                                >
                                  {requestingId === pub.id
                                    ? "Solicitando…"
                                    : cancelingId === pub.id
                                      ? "Cancelando…"
                                      : isMyPendingRequest
                                        ? "Cancelar"
                                        : isAvailable
                                          ? canAfford
                                            ? "Comprar"
                                            : "Sin oro"
                                          : "Reservado"}
                                </Button>
                              </div>
                            </TiltCard>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {tab === "ventas" && (
                  <div className="space-y-4">
                    {/* Panel publicar */}
                    <div className="rounded-xl border border-gold-dim/50 bg-card/50 p-4 space-y-4 medieval-border">
                      <p className="font-serif text-gold flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Publicar un objeto
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Personaje vendedor
                          </p>
                          <Select
                            value={selectedSellerCharacterId?.toString() ?? ""}
                            onChange={(e) => setSelectedSellerCharacterId(Number(e.target.value))}
                          >
                            {aliveCharacters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {character.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Objeto para publicar
                          </p>
                          <ObjectSelector
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
                            items={sellerInventoryOptions}
                            value={selectedBagRowId}
                            onChange={setSelectedBagRowId}
                            filters={{ excludeTraded: true, excludePublished: true }}
                            searchable
                            searchPlaceholder="Buscar objeto por nombre…"
                            emptyLabel="Sin objetos disponibles"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Precio en oro
                          </p>
                          <div className="flex gap-2">
                            <GoldAmountInput
                              value={publishPrice}
                              onChangeValue={setPublishPrice}
                              min={1}
                              allowZero={false}
                              className="text-sm"
                            />
                            <Button
                              onClick={publishItem}
                              disabled={publishing || !selectedBagRowId || !selectedSellerCharacterId}
                            >
                              {publishing ? "Publicando…" : "Publicar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedSellerItem
                          ? `Publicarás ${selectedSellerItem.name}. Si se vende, ese mismo objeto no podrá volver a comerciarse.`
                          : "No hay objetos comerciables en este personaje. Los objetos ya comerciados o ya publicados no aparecen aquí."}
                      </p>
                    </div>

                    {/* Solicitudes por resolver */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-gold/70 font-sans flex items-center gap-2">
                        <Inbox className="w-3.5 h-3.5" /> Solicitudes por resolver
                      </p>
                      {myPendingRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes solicitudes pendientes.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {myPendingRequests.map((pub, i) => (
                            <TiltCard
                              key={pub.id}
                              index={i}
                              onHover={() => playCommerce("hover")}
                              className="rounded-xl border border-gold-dim/40 bg-card/60 p-4 space-y-2"
                            >
                              <div className="flex items-center gap-3">
                                <ItemGlyph nombre={pub.item.nombre} icono={pub.item.icono} tipo={pub.item.tipo} rareza={pub.item.rareza} />
                                <div className="min-w-0">
                                  <p className="font-serif text-foreground truncate">{pub.item.nombre}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Comprador: {pub.comprador?.nombre ?? "Desconocido"}
                                  </p>
                                  <p className="inline-flex items-center gap-1.5 text-gold font-serif font-bold text-sm mt-0.5">
                                    <Coins className="w-4 h-4" /> {(pub.precio ?? 0).toLocaleString("es-ES")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => resolveRequest(pub.id, "aceptar")} disabled={resolvingId === pub.id}>
                                  <Check className="w-4 h-4 mr-1" /> Aceptar
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => resolveRequest(pub.id, "rechazar")} disabled={resolvingId === pub.id}>
                                  <X className="w-4 h-4 mr-1" /> Rechazar
                                </Button>
                              </div>
                            </TiltCard>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Publicaciones activas */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-gold/70 font-sans flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5" /> Tus publicaciones activas
                      </p>
                      {myActivePublications.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes publicaciones activas.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {myActivePublications.map((pub, i) => (
                            <TiltCard
                              key={pub.id}
                              index={i}
                              onHover={() => playCommerce("hover")}
                              className="rounded-xl border border-border bg-card/60 p-4 space-y-2"
                            >
                              <div className="flex items-center gap-3">
                                <ItemGlyph nombre={pub.item.nombre} icono={pub.item.icono} tipo={pub.item.tipo} rareza={pub.item.rareza} />
                                <div className="min-w-0">
                                  <p className="font-serif text-foreground truncate">
                                    {pub.item.nombre}
                                    {pub.item.cantidad > 1 && <span className="text-muted-foreground text-sm"> ×{pub.item.cantidad}</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">Estado: {pub.estado}</p>
                                  <p className="inline-flex items-center gap-1.5 text-gold font-serif font-bold text-sm mt-0.5">
                                    <Coins className="w-4 h-4" /> {(pub.precio ?? 0).toLocaleString("es-ES")}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => cancelPublication(pub.id)}
                                disabled={cancelingPublicationId === pub.id}
                              >
                                {cancelingPublicationId === pub.id
                                  ? "Cancelando…"
                                  : pub.estado === "solicitado"
                                    ? "Cancelar y reembolsar"
                                    : "Cancelar publicación"}
                              </Button>
                            </TiltCard>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === "compras" && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-gold/70 font-sans flex items-center gap-2">
                      <Inbox className="w-3.5 h-3.5" /> Solicitudes que hiciste
                    </p>
                    {myRequestedPublications.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gold-dim/40 p-10 text-center">
                        <Inbox className="w-8 h-8 mx-auto text-gold/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No tienes compras en curso.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {myRequestedPublications.map((pub, i) => (
                          <TiltCard
                            key={`request-${pub.id}`}
                            index={i}
                            onHover={() => playCommerce("hover")}
                            className="rounded-xl border border-border bg-card/60 p-4 space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <ItemGlyph nombre={pub.item.nombre} icono={pub.item.icono} tipo={pub.item.tipo} rareza={pub.item.rareza} />
                              <div className="min-w-0">
                                <p className="font-serif text-foreground truncate">
                                  {pub.item.nombre}
                                  {pub.item.cantidad > 1 && <span className="text-muted-foreground text-sm"> ×{pub.item.cantidad}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">Estado: {pub.estado}</p>
                                <p className="inline-flex items-center gap-1.5 text-gold font-serif font-bold text-sm mt-0.5">
                                  <Coins className="w-4 h-4" /> Reservado: {(pub.precio ?? 0).toLocaleString("es-ES")}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => cancelRequest(pub.id)}
                              disabled={cancelingId === pub.id}
                            >
                              {cancelingId === pub.id ? "Cancelando…" : "Cancelar solicitud"}
                            </Button>
                          </TiltCard>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
