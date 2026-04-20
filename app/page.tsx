"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { User, Lock, ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PrizeWheel from "./components/prize-wheel";
import { useAuth } from "@/lib/useAuth";
import { useRouletteEnabled } from "@/lib/useRouletteEnabled";

type NoticiaImage = {
  filename: string;
  url: string;
  alt: string;
};

type Player = {
  name: string;
  role: string;
  level: number;
  home: string;
  maxCharacterSlots?: number;
};

type ClassEntry = {
  className: string;
  level: number;
};

type Character = {
  id: number;
  name: string;
  multiclass: ClassEntry[];
  race: string;
  alignment: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  deadAt?: string | null;
  revivedAt?: string | null;
  stats: Record<string, number>;
  gear: string[];
};

type ProfileResponse = {
  player: Player;
  characters: Character[];
};

type CharacterSlot = {
  id: number;
  locked: boolean;
  character?: Character;
};

type HomePageProps = {
  forcedSection?: "inicio" | "ruleta";
};

type PanPoint = {
  x: number;
  y: number;
};

export default function HomePage(props: HomePageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomePageContent {...props} />
    </Suspense>
  );
}

function HomePageContent({ forcedSection }: HomePageProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("inicio");
  const { rouletteEnabled: isRouletteEnabled } = useRouletteEnabled({ token });
  const [activeSlot, setActiveSlot] = useState(1);
  const [noticias, setNoticias] = useState<NoticiaImage[]>([]);
  const [noticiaIdx, setNoticiaIdx] = useState(0);
  const [isNoticiaOpen, setIsNoticiaOpen] = useState(false);
  const [noticiaZoom, setNoticiaZoom] = useState(1);
  const [noticiaPan, setNoticiaPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [isDraggingNoticia, setIsDraggingNoticia] = useState(false);
  const fullscreenViewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<PanPoint>({ x: 0, y: 0 });
  const panStartRef = useRef<PanPoint>({ x: 0, y: 0 });

  const MIN_NOTICIA_ZOOM = 1;
  const MAX_NOTICIA_ZOOM = 4;
  const NOTICIA_ZOOM_STEP = 0.25;

  useEffect(() => {
    let isMounted = true;
    const userId = user?.id ?? "demo-user";

    setIsProfileLoading(true);

    fetch(`/api/profile?userId=${userId}`)
      .then((res) => res.json())
      .then((data: ProfileResponse) => {
        if (isMounted) {
          setProfile(data);

          const hasAnyAlive = (data.characters ?? []).some(
            (character) => character.lifeStatus !== "muerto",
          );
          if (user?.id && data.characters?.length > 0 && !hasAnyAlive) {
            router.replace("/profile?dead=1");
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router, user?.id]);

  // Cargar imágenes de noticias
  useEffect(() => {
    fetch("/api/noticias")
      .then((r) => r.json())
      .then((data: NoticiaImage[]) => setNoticias(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (forcedSection) {
      if (forcedSection === "ruleta" && isRouletteEnabled === null) {
        return;
      }
      if (forcedSection === "ruleta" && !isRouletteEnabled) {
        setActiveSection("inicio");
        router.replace("/");
        return;
      }
      setActiveSection(forcedSection);
      return;
    }

    const section = searchParams.get("section");
    if (!section) {
      setActiveSection("inicio");
      return;
    }

    if (section === "ruleta") {
      if (isRouletteEnabled === null) {
        return;
      }
      if (!isRouletteEnabled) {
        setActiveSection("inicio");
        router.replace("/");
        return;
      }
      setActiveSection("ruleta");
      return;
    }

    if (section === "inicio") {
      setActiveSection(section);
      return;
    }

    setActiveSection("inicio");
  }, [forcedSection, searchParams, isRouletteEnabled, router]);

  useEffect(() => {
    if (!isNoticiaOpen) {
      return;
    }

    const clampZoom = (value: number) =>
      Math.min(MAX_NOTICIA_ZOOM, Math.max(MIN_NOTICIA_ZOOM, value));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNoticiaOpen(false);
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setNoticiaZoom((z) => clampZoom(z + NOTICIA_ZOOM_STEP));
      }

      if (event.key === "-") {
        event.preventDefault();
        setNoticiaZoom((z) => clampZoom(z - NOTICIA_ZOOM_STEP));
      }

      if (event.key === "0") {
        event.preventDefault();
        setNoticiaZoom(1);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isNoticiaOpen]);

  useEffect(() => {
    if (!isNoticiaOpen) {
      return;
    }
    setNoticiaZoom(1);
    setNoticiaPan({ x: 0, y: 0 });
  }, [isNoticiaOpen, noticiaIdx]);

  const handleSectionChange = (sectionId: string) => {
    if (sectionId === "inicio") {
      setActiveSection("inicio");
      router.push("/");
      return;
    }

    if (sectionId === "ruleta") {
      if (isRouletteEnabled !== true) {
        setActiveSection("inicio");
        router.push("/");
        return;
      }
      setActiveSection("ruleta");
      router.push("/ruleta");
      return;
    }

    setActiveSection("inicio");
    router.push("/");
  };

  const prevNoticia = () =>
    setNoticiaIdx((i) => (i - 1 + noticias.length) % noticias.length);
  const nextNoticia = () => setNoticiaIdx((i) => (i + 1) % noticias.length);

  const clampNoticiaPan = (pan: PanPoint, zoom: number): PanPoint => {
    const viewport = fullscreenViewportRef.current;
    if (!viewport || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const maxX = ((zoom - 1) * viewport.clientWidth) / 2;
    const maxY = ((zoom - 1) * viewport.clientHeight) / 2;

    return {
      x: Math.min(maxX, Math.max(-maxX, pan.x)),
      y: Math.min(maxY, Math.max(-maxY, pan.y)),
    };
  };

  const updateNoticiaZoom = (nextZoom: number) => {
    const clamped = Math.min(MAX_NOTICIA_ZOOM, Math.max(MIN_NOTICIA_ZOOM, nextZoom));
    setNoticiaZoom(clamped);
    setNoticiaPan((prev) => clampNoticiaPan(prev, clamped));
  };

  const zoomInNoticia = () =>
    updateNoticiaZoom(noticiaZoom + NOTICIA_ZOOM_STEP);
  const zoomOutNoticia = () =>
    updateNoticiaZoom(noticiaZoom - NOTICIA_ZOOM_STEP);
  const resetNoticiaZoom = () => {
    setNoticiaZoom(1);
    setNoticiaPan({ x: 0, y: 0 });
  };

  const noticiaActual = noticias[noticiaIdx];
  const noticiaTitulo = noticiaActual
    ? noticiaActual.alt && noticiaActual.alt.toLowerCase() !== "noticia"
      ? noticiaActual.alt
      : noticiaActual.filename
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
    : "";

  const maxCharacterSlots = Math.max(
    2,
    Math.min(5, profile?.player?.maxCharacterSlots ?? 2),
  );

  const characterSlots: CharacterSlot[] = Array.from({ length: 5 }, (_, index) => {
    const character = profile?.characters[index];
    const isUnlocked = index < maxCharacterSlots;

    if (character) {
      return { id: index + 1, locked: false, character };
    }

    return { id: index + 1, locked: !isUnlocked };
  });

  const activeCharacter = characterSlots[activeSlot - 1]?.character;

  return (
    <div className="min-h-screen bg-background">
      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        {/* Header */}
        <Header />

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4">
          {/* Left Sidebar */}
          <Sidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            rouletteEnabled={isRouletteEnabled}
          />

          {/* Center */}
          {activeSection === "ruleta" && isRouletteEnabled ? (
            <main className="min-h-125">
              <PrizeWheel token={token} />
            </main>
          ) : (
            <main className="relative rounded-lg overflow-hidden shadow-2xl border-4 border-gold-dim candle-glow min-h-125 bg-card">
              {noticias.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-125 bg-parchment">
                  <p className="font-serif text-sm text-parchment-dark/50">
                    Sin noticias por el momento
                  </p>
                </div>
              ) : (
                <>
                  {/* Imagen principal */}
                  <Image
                    key={noticiaActual.url}
                    src={noticiaActual.url}
                    alt={noticiaActual.alt}
                    fill
                    className="object-cover scale-[1.01]"
                    sizes="(max-width: 1024px) 100vw, 600px"
                  />

                  <button
                    onClick={() => setIsNoticiaOpen(true)}
                    className="absolute inset-0 z-5"
                    aria-label="Ver noticia en grande"
                  />

                  {/* Capas cinematicas */}
                  <div className="absolute inset-0 bg-linear-to-t from-background/95 via-background/45 to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-r from-background/35 via-transparent to-background/40" />

                  {/* Cabecera de seccion */}
                  <div className="absolute top-3 left-3 z-10 rounded border border-gold/45 bg-background/75 px-3 py-1.5 backdrop-blur-xs">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-gold/90 font-sans">
                      Gaceta del Reino
                    </p>
                  </div>

                  <button
                    onClick={() => setIsNoticiaOpen(true)}
                    aria-label="Ampliar noticia"
                    className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded border border-gold-dim/70 bg-background/70 px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-gold transition-colors hover:bg-background/90"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Ver en grande
                  </button>

                  {/* Contenido editorial */}
                  <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-gold-dim/60 bg-background/78 p-3 md:inset-x-4 md:bottom-4 md:p-4 backdrop-blur-xs">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-base leading-tight text-gold md:text-xl">
                          {noticiaTitulo || "Nueva crónica disponible"}
                        </h2>
                        <p className="mt-1 text-[11px] text-foreground/80 font-sans md:text-xs">
                          Parte {noticiaIdx + 1} de {noticias.length}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5">
                        {noticias.map((img, i) => (
                          <button
                            key={`dot-${img.filename}`}
                            onClick={() => setNoticiaIdx(i)}
                            aria-label={`Ir a noticia ${i + 1}`}
                            className={`h-2.5 rounded-full transition-all ${
                              i === noticiaIdx
                                ? "w-7 bg-gold shadow-[0_0_10px_rgba(212,175,55,0.45)]"
                                : "w-2.5 bg-gold-dim/50 hover:bg-gold-dim"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Controles de navegacion */}
                  {noticias.length > 1 && (
                    <>
                      <button
                        onClick={prevNoticia}
                        aria-label="Noticia anterior"
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full border border-gold-dim/80 bg-background/70 p-2 text-gold transition-all hover:scale-105 hover:bg-background/90"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={nextNoticia}
                        aria-label="Siguiente noticia"
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full border border-gold-dim/80 bg-background/70 p-2 text-gold transition-all hover:scale-105 hover:bg-background/90"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Miniaturas */}
                  {noticias.length > 1 && (
                    <div className="absolute right-3 top-3 z-10 hidden xl:flex flex-col gap-2 rounded-lg border border-gold-dim/60 bg-background/65 p-2 backdrop-blur-xs">
                      {noticias.map((img, i) => (
                        <button
                          key={img.filename}
                          onClick={() => setNoticiaIdx(i)}
                          aria-label={`Ver noticia ${i + 1}`}
                          className={`relative h-12 w-12 overflow-hidden rounded border-2 transition-all ${
                            i === noticiaIdx
                              ? "border-gold scale-105"
                              : "border-gold-dim/40 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={img.url}
                            alt={img.alt}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </main>
          )}

          {/* Right Sidebar - Character Panel */}
          <aside className="space-y-4">
            {/* Active Character Card */}
            <div className="bg-card rounded-lg border border-gold-dim overflow-hidden medieval-border">
              <div className="bg-linear-to-r from-gold-dim to-accent px-4 py-2">
                <span className="text-primary-foreground font-bold text-sm tracking-wider font-sans">
                  {activeCharacter
                    ? activeCharacter.race.toUpperCase()
                    : "SIN PERSONAJE"}
                </span>
                <span className="text-gold font-bold text-sm tracking-wider ml-2 font-sans">
                  {activeCharacter
                    ? (activeCharacter.multiclass ?? [])
                        .map((c) => c.className.toUpperCase())
                        .join(" / ")
                    : "BLOQUEADO"}
                </span>
              </div>
              <div className="p-4">
                <div className="relative aspect-square bg-background rounded-lg flex items-center justify-center mb-3 border border-border overflow-hidden">
                  {isProfileLoading ? (
                    <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <img
                      src={
                        activeCharacter?.portrait?.trim() ||
                        "/characters/profileplaceholder.webp"
                      }
                      alt={activeCharacter?.name || "Personaje"}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/characters/profileplaceholder.webp";
                      }}
                    />
                  )}
                </div>
                <div className="text-center">
                  {isProfileLoading ? (
                    <>
                      <p className="text-gold font-medium font-sans">
                        Cargando...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Obteniendo personaje
                      </p>
                    </>
                  ) : activeCharacter ? (
                    <>
                      <p className="text-gold font-medium font-sans">
                        {activeCharacter.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(activeCharacter.multiclass ?? [])
                          .map((c) => `${c.className} Nv.${c.level}`)
                          .join(" / ")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gold font-medium font-sans">
                        Slot vacio
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeSlot <= maxCharacterSlots
                          ? "Espacio disponible"
                          : "Desbloquea un personaje"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Character Slots */}
            <div className="space-y-2">
              {characterSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => {
                    if (!slot.locked) {
                      setActiveSlot(slot.id);
                      router.push("/profile");
                    }
                  }}
                  disabled={slot.locked}
                  className={`w-full rounded-lg border p-3 flex items-center gap-3 transition-all ${
                    slot.locked
                      ? "bg-background border-secondary cursor-not-allowed"
                      : activeSlot === slot.id
                        ? "bg-card border-gold medieval-border"
                        : "bg-card border-border hover:border-gold-dim"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded flex items-center justify-center ${
                      slot.locked ? "bg-secondary" : "bg-muted"
                    }`}
                  >
                    {slot.locked ? (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-gold" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    {slot.locked ? (
                      <p className="text-xs text-muted-foreground">
                        Slot bloqueado
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-foreground font-medium font-sans">
                          {slot.character?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(slot.character?.multiclass ?? [])
                            .map((c) => c.className)
                            .join(" / ")}
                        </p>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Unlock Message */}
            <div className="bg-card rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground text-center">
                Slots: {profile?.characters?.length ?? 0}/{maxCharacterSlots}. Puedes ampliar hasta 5 con pago.
              </p>
              <button
                className="w-full mt-2 bg-gold hover:bg-gold-dim text-background font-medium text-sm py-2 rounded transition-colors font-sans"
                onClick={() => router.push("/profile")}
              >
                Comprar slot de personaje
              </button>
            </div>
          </aside>
        </div>
      </div>

      {isNoticiaOpen && noticiaActual ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 md:p-6">
          <button
            aria-label="Cerrar visor"
            className="absolute inset-0"
            onClick={() => setIsNoticiaOpen(false)}
          />

          <div className="relative z-10 w-full max-w-6xl rounded-lg border-2 border-gold-dim bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-gold-dim/40 px-3 py-2 md:px-4">
              <p className="max-w-[75%] truncate font-serif text-sm text-gold md:text-base">
                {noticiaTitulo || "Crónica del Reino"}
              </p>
              <button
                aria-label="Cerrar"
                onClick={() => setIsNoticiaOpen(false)}
                className="rounded border border-gold-dim/70 bg-background/70 p-1.5 text-gold transition-colors hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative h-[70vh] md:h-[78vh]">
              <div
                ref={fullscreenViewportRef}
                className="absolute inset-0 overflow-hidden select-none"
                onWheel={(event) => {
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? NOTICIA_ZOOM_STEP : -NOTICIA_ZOOM_STEP;
                  updateNoticiaZoom(noticiaZoom + delta);
                }}
                onPointerDown={(event) => {
                  if (noticiaZoom <= 1) {
                    return;
                  }
                  event.preventDefault();
                  setIsDraggingNoticia(true);
                  dragStartRef.current = { x: event.clientX, y: event.clientY };
                  panStartRef.current = noticiaPan;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!isDraggingNoticia || noticiaZoom <= 1) {
                    return;
                  }

                  const deltaX = event.clientX - dragStartRef.current.x;
                  const deltaY = event.clientY - dragStartRef.current.y;
                  const nextPan = {
                    x: panStartRef.current.x + deltaX,
                    y: panStartRef.current.y + deltaY,
                  };

                  setNoticiaPan(clampNoticiaPan(nextPan, noticiaZoom));
                }}
                onPointerUp={(event) => {
                  setIsDraggingNoticia(false);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={(event) => {
                  setIsDraggingNoticia(false);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              >
                <div
                  className="relative h-full w-full transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${noticiaPan.x}px, ${noticiaPan.y}px) scale(${noticiaZoom})`,
                    transformOrigin: "center center",
                    cursor: noticiaZoom > 1 ? (isDraggingNoticia ? "grabbing" : "grab") : "zoom-in",
                    touchAction: "none",
                  }}
                >
                  <Image
                    key={`fullscreen-${noticiaActual.url}`}
                    src={noticiaActual.url}
                    alt={noticiaActual.alt}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                  />
                </div>
              </div>

              <div className="absolute top-3 left-3 flex items-center gap-2 rounded border border-gold-dim/65 bg-background/75 px-2 py-1.5 text-xs text-gold">
                <button
                  onClick={zoomOutNoticia}
                  disabled={noticiaZoom <= MIN_NOTICIA_ZOOM}
                  className="rounded border border-gold-dim/70 px-2 py-0.5 disabled:opacity-40"
                  aria-label="Reducir zoom"
                >
                  -
                </button>
                <button
                  onClick={resetNoticiaZoom}
                  className="rounded border border-gold-dim/70 px-2 py-0.5"
                  aria-label="Restablecer zoom"
                >
                  {Math.round(noticiaZoom * 100)}%
                </button>
                <button
                  onClick={zoomInNoticia}
                  disabled={noticiaZoom >= MAX_NOTICIA_ZOOM}
                  className="rounded border border-gold-dim/70 px-2 py-0.5 disabled:opacity-40"
                  aria-label="Aumentar zoom"
                >
                  +
                </button>
              </div>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-background/75 px-2.5 py-1 text-xs text-foreground/90">
                Arrastra para mover cuando el zoom sea mayor a 100%
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
