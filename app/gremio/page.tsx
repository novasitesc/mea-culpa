"use client";

// Gremio (/gremio): estandarte, miembros, baúl común, solicitudes y chat.
// Los objetos del baúl no se cogen directamente: se piden y el líder aprueba.
//
// El layout es hero + pestañas + chat fijo, en vez de una pila de tarjetas: la
// página cabe en una pantalla y el chat nunca se pierde de vista al navegar.
// Lenis suaviza el scroll y GSAP anima entradas y contadores; ambos respetan
// `prefers-reduced-motion`.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reduceMotion, useSmoothScroll } from "@/lib/useSmoothScroll";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import GremioChat from "@/app/components/gremio-chat";
import AnimatedNumber from "@/app/components/animated-number";
import { useAuth } from "@/lib/useAuth";
import { emitAuthRefresh } from "@/lib/authRefresh";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ObjectSelector, type ObjectSelectorItem } from "@/components/ui/object-selector";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { Crown, Package, Shield, Users, Inbox, ArrowDownToLine, Coins } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";

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
      icono?: string;
      type: string;
      cantidad?: number;
      fueComerciado?: boolean;
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

type TabKey = "baul" | "deposito" | "miembros" | "solicitudes";

const PANEL =
  "rounded-2xl border border-[#8B7355]/35 bg-gradient-to-b from-card/90 to-[#100e0b]/90 backdrop-blur-sm";

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-gold/70" />
      <div className="min-w-0">
        <p className="font-serif text-lg leading-none text-gold">
          <AnimatedNumber value={value} />
          {suffix && <span className="text-sm text-gold/50">{suffix}</span>}
        </p>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-widest text-foreground/35">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

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
  const [selectedBaulItemId, setSelectedBaulItemId] = useState<number | null>(null);
  const [requestNote, setRequestNote] = useState("");
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);
  const [tab, setTab] = useState<TabKey>("baul");

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useSmoothScroll();

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
      (item) => !item.fueComerciado && !item.publicadoEnTrade && Number(item.objectId) > 0,
    );
  }, [selectedCharacter]);

  const depositableOptions = useMemo<ObjectSelectorItem[]>(() => {
    if (!selectedCharacter || selectedCharacter.lifeStatus === "muerto") {
      return [];
    }

    return selectedCharacter.bag.items
      .filter((item) => Number(item.objectId) > 0)
      .map((item) => ({
        value: item.bagRowId,
        name: item.name,
        icon: item.icono ?? "📦",
        searchText: item.type,
        fueComerciado: item.fueComerciado,
        publicadoEnTrade: item.publicadoEnTrade,
      }));
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

  const baulOptions = useMemo<ObjectSelectorItem[]>(() => {
    return (guildState?.baul ?? []).map((item) => ({
      value: item.id,
      icon: item.object.icono,
      name: `${item.object.nombre} - ${item.object.precio.toLocaleString()} oro`,
      searchText: `${item.object.rareza} ${item.object.tipo} ${item.depositBy.name}`,
    }));
  }, [guildState?.baul]);

  const selectedBaulItem = useMemo(
    () => (guildState?.baul ?? []).find((item) => item.id === selectedBaulItemId) ?? null,
    [guildState?.baul, selectedBaulItemId],
  );

  useEffect(() => {
    if (baulOptions.length === 0) {
      setSelectedBaulItemId(null);
      return;
    }

    setSelectedBaulItemId((prev) => {
      if (!prev) return baulOptions[0].value;
      const exists = baulOptions.some((item) => item.value === prev);
      return exists ? prev : baulOptions[0].value;
    });
  }, [baulOptions]);

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
  const members = guildState?.members ?? [];
  const baul = guildState?.baul ?? [];
  const isBaulLimitReached =
    hasGuild && !!myGuild ? baul.length >= myGuild.limiteBaulItems : false;

  // ─── Animaciones de entrada ────────────────────────────────────────────────
  // `gsap.context` limita los selectores a este árbol y hace `revert()` solo.
  useLayoutEffect(() => {
    if (loading || reduceMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-anim='hero-crest']", {
        scale: 0.6,
        opacity: 0,
        rotate: -12,
        duration: 0.7,
        ease: "back.out(1.7)",
      });
      gsap.from("[data-anim='hero-line']", {
        y: 18,
        opacity: 0,
        duration: 0.6,
        stagger: 0.07,
        ease: "power3.out",
        delay: 0.1,
      });
      gsap.from("[data-anim='stat']", {
        y: 14,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: "power2.out",
        delay: 0.25,
      });
      gsap.utils.toArray<HTMLElement>("[data-anim='reveal']").forEach((el) => {
        gsap.from(el, {
          y: 26,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });
    }, rootRef);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [loading, hasGuild]);

  // Cambio de pestaña: un fundido corto para que el salto no sea seco.
  useLayoutEffect(() => {
    if (reduceMotion() || !panelRef.current) return;
    const tween = gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" },
    );
    return () => {
      tween.kill();
    };
  }, [tab]);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users; badge?: number }> = [
    { key: "baul", label: "Baúl", icon: Package, badge: baul.length },
    { key: "deposito", label: "Depositar", icon: ArrowDownToLine },
    { key: "miembros", label: "Miembros", icon: Users, badge: members.length },
    ...(role === "lider"
      ? [
          {
            key: "solicitudes" as TabKey,
            label: "Solicitudes",
            icon: Inbox,
            badge: pendingRequests.length,
          },
        ]
      : []),
  ];

  return (
    /* Con gremio el escritorio queda anclado al viewport: la página no scrollea
       y cada panel lo hace por dentro, así el campo de escribir del chat está
       siempre a la vista sin perseguirlo. Sin gremio la página scrollea normal
       (y Lenis la suaviza), que es donde sí hay contenido largo que recorrer. */
    <div
      ref={rootRef}
      className={`relative z-10 flex min-h-screen flex-col bg-background p-4 text-foreground md:p-6 ${
        hasGuild ? "lg:h-svh lg:overflow-hidden" : ""
      }`}
    >
      <Header />

      <div className="mt-4 grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        {/* pb-16: hueco para el botón flotante de reportar, que en esta ruta
            vive en la esquina inferior izquierda (feedback-widget.tsx). */}
        <div className="hidden lg:col-span-3 lg:block lg:overflow-y-auto lg:pb-16 xl:col-span-2">
          <Sidebar activeSection="gremio" />
        </div>

        <main className="flex flex-col gap-6 lg:col-span-9 lg:min-h-0 xl:col-span-10">
          {/* ─── Estandarte ─────────────────────────────────────────────── */}
          <section
            ref={heroRef}
            className={`${PANEL} relative shrink-0 overflow-hidden px-5 py-6 md:px-8 md:py-8`}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/5 blur-3xl"
            />

            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <div
                data-anim="hero-crest"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold"
              >
                {hasGuild && role === "lider" ? (
                  <Crown className="h-7 w-7" />
                ) : (
                  <Shield className="h-7 w-7" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  data-anim="hero-line"
                  className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold/50"
                >
                  {hasGuild ? (role === "lider" ? "Líder de gremio" : "Integrante") : "Sin estandarte"}
                </p>
                <h1
                  data-anim="hero-line"
                  className="mt-1.5 truncate font-serif text-2xl text-gold md:text-4xl"
                >
                  {hasGuild ? myGuild?.nombre : "Gremio"}
                </h1>
                <p
                  data-anim="hero-line"
                  className="mt-2 max-w-2xl font-sans text-sm text-foreground/50"
                >
                  {hasGuild
                    ? myGuild?.descripcion || "Este gremio aún no tiene lema."
                    : "Funda tu propio clan o únete a uno existente para compartir baúl y sala común."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 md:w-auto md:grid-cols-1 lg:grid-cols-2">
                {hasGuild && (
                  <>
                    <div data-anim="stat">
                      <Stat
                        icon={Users}
                        label="Miembros"
                        value={members.length}
                        suffix={`/${myGuild?.limiteIntegrantes ?? 10}`}
                      />
                    </div>
                    <div data-anim="stat">
                      <Stat
                        icon={Package}
                        label="Baúl"
                        value={baul.length}
                        suffix={`/${myGuild?.limiteBaulItems ?? 10}`}
                      />
                    </div>
                  </>
                )}
                <div data-anim="stat" className={hasGuild ? "col-span-2 lg:col-span-2" : "col-span-2"}>
                  <Stat icon={Coins} label="Tu oro" value={profile?.player.oro ?? 0} />
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <div className={`${PANEL} py-16 text-center font-sans text-sm text-foreground/40`}>
              Consultando los registros del gremio...
            </div>
          ) : !hasGuild ? (
            /* ─── Sin gremio: fundar o unirse ───────────────────────────── */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_1fr]">
              <section data-anim="reveal" className={`${PANEL} h-fit p-5`}>
                <h2 className="font-serif text-base text-gold">Fundar un gremio</h2>
                <p className="mt-1 font-sans text-xs text-foreground/40">
                  Coste: <span className="text-gold/80">100 oro</span>
                </p>

                <div className="mt-4 space-y-3">
                  <Input
                    value={guildName}
                    onChange={(e) => setGuildName(e.target.value)}
                    maxLength={40}
                    placeholder="Nombre del gremio"
                    aria-label="Nombre del gremio"
                  />
                  <textarea
                    value={guildDescription}
                    onChange={(e) => setGuildDescription(e.target.value)}
                    maxLength={200}
                    placeholder="Lema o descripción breve (opcional)"
                    aria-label="Descripción del gremio"
                    className="min-h-22.5 w-full resize-none rounded-lg border border-border bg-input px-3 py-2 font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  />
                  <Button
                    onClick={createGuild}
                    disabled={busy === "createGuild"}
                    className="w-full bg-gold text-background hover:bg-gold-dim"
                  >
                    {busy === "createGuild" ? "Creando..." : "Fundar gremio"}
                  </Button>
                </div>
              </section>

              <section data-anim="reveal" className={`${PANEL} p-5`}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gold/70" />
                  <h2 className="font-serif text-base text-gold">Gremios abiertos</h2>
                  <span className="ml-auto font-sans text-[10px] uppercase tracking-widest text-foreground/35">
                    {(guildState?.guilds ?? []).length}
                  </span>
                </div>

                {(guildState?.guilds ?? []).length === 0 ? (
                  <p className="mt-6 font-sans text-sm text-foreground/40">
                    Aún no hay gremios creados. Crea el primero.
                  </p>
                ) : (
                  <div className="feed-scroll mt-4 grid max-h-[32rem] grid-cols-1 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                    {(guildState?.guilds ?? []).map((g) => {
                      const lleno = g.miembrosCount >= g.limiteIntegrantes;
                      return (
                        <article
                          key={g.id}
                          className="group rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/[0.04]"
                        >
                          <p className="font-serif text-base text-gold">{g.nombre}</p>
                          <p className="mt-1 line-clamp-2 font-sans text-xs text-foreground/45">
                            {g.descripcion || "Sin lema."}
                          </p>

                          <div className="mt-3 flex items-center gap-3 font-sans text-[11px] text-foreground/40">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {g.miembrosCount}/{g.limiteIntegrantes}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {g.baulCount}/{g.limiteBaulItems}
                            </span>
                          </div>

                          <div
                            className="mt-3 h-1 overflow-hidden rounded-full bg-white/5"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-[width] duration-700"
                              style={{
                                width: `${Math.min(100, (g.miembrosCount / Math.max(1, g.limiteIntegrantes)) * 100)}%`,
                              }}
                            />
                          </div>

                          <Button
                            onClick={() => joinGuild(g.id)}
                            disabled={busy === `join-${g.id}` || lleno}
                            className="mt-4 w-full"
                          >
                            {busy === `join-${g.id}` ? "Uniendo..." : lleno ? "Lleno" : "Unirme"}
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : (
            /* ─── Con gremio: pestañas + chat ───────────────────────────── */
            <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_23rem]">
              <section data-anim="reveal" className={`${PANEL} flex min-h-0 flex-col overflow-hidden`}>
                <div
                  role="tablist"
                  aria-label="Secciones del gremio"
                  className="flex overflow-x-auto border-b border-gold-dim/20"
                >
                  {tabs.map(({ key, label, icon: Icon, badge }) => (
                    <button
                      key={key}
                      role="tab"
                      id={`tab-${key}`}
                      aria-selected={tab === key}
                      aria-controls={`panel-${key}`}
                      onClick={() => setTab(key)}
                      className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 font-sans text-xs transition-colors ${
                        tab === key ? "text-gold" : "text-foreground/45 hover:text-foreground/75"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {badge != null && badge > 0 && (
                        <span className="rounded-full bg-gold/15 px-1.5 py-px text-[10px] text-gold/80">
                          {badge}
                        </span>
                      )}
                      {tab === key && (
                        <span className="absolute inset-x-2 bottom-0 h-px bg-gold" />
                      )}
                    </button>
                  ))}
                </div>

                <div
                  ref={panelRef}
                  id={`panel-${tab}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${tab}`}
                  className="feed-scroll min-h-[22rem] flex-1 overflow-y-auto p-5 lg:min-h-0"
                >
                  {tab === "baul" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Select
                          value={selectedTargetCharacterId?.toString() ?? ""}
                          onChange={(e) => setSelectedTargetCharacterId(Number(e.target.value))}
                          aria-label="Personaje destino"
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
                          placeholder="Nota para el líder (opcional)"
                          aria-label="Nota para el líder"
                        />
                      </div>

                      <ObjectSelector
                        items={baulOptions}
                        value={selectedBaulItemId}
                        onChange={setSelectedBaulItemId}
                        searchable
                        searchPlaceholder="Buscar objeto del baúl..."
                        noSearchResultsLabel="No hay coincidencias"
                        placeholder="Selecciona un objeto del baúl"
                        emptyLabel="No hay objetos en el baúl"
                      />

                      {baul.length === 0 ? (
                        <p className="font-sans text-sm text-foreground/40">
                          El baúl está vacío. Deposita algo desde la pestaña anterior.
                        </p>
                      ) : (
                        <>
                          {selectedBaulItem && (
                            <div className="rounded-xl border border-gold/20 bg-gold/[0.04] p-4">
                              <p className="flex items-center gap-2 font-serif text-sm text-gold">
                                {getIconForString(
                                  selectedBaulItem.object.nombre,
                                  "w-4 h-4 text-[#D4AF37]",
                                  selectedBaulItem.object.icono,
                                )}
                                {selectedBaulItem.object.nombre}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-foreground/45">
                                <span>
                                  Valor:{" "}
                                  <span className="text-gold/80">
                                    {selectedBaulItem.object.precio.toLocaleString()} oro
                                  </span>
                                </span>
                                <span>Depositado por {selectedBaulItem.depositBy.name}</span>
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={() => selectedBaulItemId && requestItem(selectedBaulItemId)}
                            disabled={
                              selectedBaulItemId === null ||
                              busy === `request-${selectedBaulItemId}`
                            }
                          >
                            {selectedBaulItemId !== null && busy === `request-${selectedBaulItemId}`
                              ? "Solicitando..."
                              : "Solicitar al líder"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {tab === "deposito" && (
                    <div className="space-y-4">
                      <p className="font-sans text-xs text-foreground/40">
                        Lo que deposites pasa a ser del gremio. Solo el líder puede repartirlo.
                      </p>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Select
                          value={selectedCharacterId?.toString() ?? ""}
                          onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                          aria-label="Personaje origen"
                        >
                          {aliveCharacters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>

                        <ObjectSelector
                          items={depositableOptions}
                          value={selectedBagRowId}
                          onChange={setSelectedBagRowId}
                          filters={{ excludeTraded: true, excludePublished: true }}
                          showQuantity={false}
                          searchable
                          searchPlaceholder="Buscar objeto de la bolsa..."
                          noSearchResultsLabel="No hay coincidencias"
                          placeholder="Selecciona un objeto"
                          emptyLabel="Sin objetos disponibles"
                        />
                      </div>

                      <Button
                        onClick={depositItem}
                        disabled={
                          busy === "deposit" ||
                          depositableItems.length === 0 ||
                          isBaulLimitReached
                        }
                      >
                        {busy === "deposit" ? "Depositando..." : "Depositar objeto"}
                      </Button>

                      {isBaulLimitReached && (
                        <p className="font-sans text-xs text-amber-300">
                          El baúl del gremio está lleno. Límite actual:{" "}
                          {myGuild?.limiteBaulItems ?? 10} objetos.
                        </p>
                      )}
                    </div>
                  )}

                  {tab === "miembros" && (
                    <div className="space-y-4">
                      <ul className="space-y-2">
                        {members.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-gold/25"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 font-serif text-sm text-gold">
                              {m.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-sans text-sm text-foreground/75">
                              {m.name}
                            </span>
                            {m.role === "lider" && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-sans text-[10px] uppercase tracking-widest text-gold">
                                <Crown className="h-3 w-3" />
                                Líder
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant="destructive"
                        onClick={leaveGuild}
                        disabled={busy === "leaveGuild"}
                      >
                        {busy === "leaveGuild" ? "Saliendo..." : "Salir del gremio"}
                      </Button>
                    </div>
                  )}

                  {tab === "solicitudes" && role === "lider" && (
                    <div className="space-y-3">
                      {pendingRequests.length === 0 ? (
                        <p className="font-sans text-sm text-foreground/40">
                          No hay solicitudes pendientes.
                        </p>
                      ) : (
                        pendingRequests.map((req) => (
                          <div
                            key={req.id}
                            className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
                          >
                            <p className="flex items-center gap-2 font-serif text-sm text-gold">
                              {getIconForString(
                                req.item.nombre,
                                "w-4 h-4 text-[#D4AF37]",
                                req.item.icono,
                              )}
                              {req.item.nombre} ×{req.item.cantidad}
                            </p>
                            <p className="mt-1.5 font-sans text-xs text-foreground/45">
                              {req.requesterName} → {req.targetCharacter.name}
                            </p>
                            {req.nota && (
                              <p className="mt-1 font-sans text-xs italic text-foreground/35">
                                “{req.nota}”
                              </p>
                            )}
                            <div className="mt-3 flex gap-2">
                              <Button
                                onClick={() => resolveRequest(req.id, "aprobar")}
                                disabled={busy === `resolve-${req.id}-aprobar`}
                                className="bg-green-600 text-white hover:bg-green-700"
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
                    </div>
                  )}
                </div>
              </section>

              {/* ─── Chat ────────────────────────────────────────────────── */}
              <aside
                data-anim="reveal"
                className={`${PANEL} h-[26rem] overflow-hidden lg:h-full lg:min-h-0`}
              >
                {myGuild && (
                  <GremioChat gremioId={myGuild.id} token={token} myUserId={user?.id} />
                )}
              </aside>
            </div>
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
