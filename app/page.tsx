"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { User, Lock, ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PrizeWheel from "./components/prize-wheel";
import ConfirmActionModal from "@/components/ui/confirm-action-modal";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import { useRouletteEnabled } from "@/lib/useRouletteEnabled";
import type { Noticia } from "@/lib/types/noticia";

type NoticiaImage = Noticia;

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

  const getAuthToken = async () => {
    if (token) return token;
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? "";
  };
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("inicio");
  const { rouletteEnabled: isRouletteEnabled } = useRouletteEnabled({ token });
  const [activeSlot, setActiveSlot] = useState(1);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [noticiaIdx, setNoticiaIdx] = useState(0);
  const [isNoticiaOpen, setIsNoticiaOpen] = useState(false);
  const [noticiaZoom, setNoticiaZoom] = useState(1);
  const [noticiaPan, setNoticiaPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [isDraggingNoticia, setIsDraggingNoticia] = useState(false);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [message, setMessage] = useState<
    | { type: "success" | "error"; text: string }
    | null
  >(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingNoticia, setEditingNoticia] = useState<Noticia | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formContenido, setFormContenido] = useState("");
  const [formVisible, setFormVisible] = useState(true);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fullscreenViewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<PanPoint>({ x: 0, y: 0 });
  const panStartRef = useRef<PanPoint>({ x: 0, y: 0 });

  const MIN_NOTICIA_ZOOM = 1;
  const MAX_NOTICIA_ZOOM = 4;
  const NOTICIA_ZOOM_STEP = 0.25;
  const isAdmin = user?.isAdmin ?? false;

  const refreshNoticias = async () => {
    setIsNewsLoading(true);
    setMessage(null);

    try {
      const init: RequestInit = { method: "GET" };
      if (isAdmin && token) {
        init.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await fetch("/api/noticias", init);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Error al cargar noticias");
      }

      setNoticias(Array.isArray(data) ? data : []);
      setNoticiaIdx(0);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las noticias",
      });
    } finally {
      setIsNewsLoading(false);
    }
  };

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

  useEffect(() => {
    refreshNoticias();
  }, [isAdmin, token]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

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
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const resetEditor = () => {
    setEditingNoticia(null);
    setEditorMode("create");
    setFormTitulo("");
    setFormContenido("");
    setFormVisible(true);
    setFormImageFile(null);
    setFormSubmitting(false);
    setIsDragOver(false);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  };

  const openCreateEditor = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEditEditor = (noticia: Noticia) => {
    setEditingNoticia(noticia);
    setEditorMode("edit");
    setFormTitulo(noticia.titulo);
    setFormContenido(noticia.contenido);
    setFormVisible(noticia.visible);
    setFormImageFile(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setFormSubmitting(false);
  };

  const handleImageChange = (event: any) => {
    const file = event.target?.files?.[0];
    if (file instanceof File) {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setFormImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setFormImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      const file = event.target?.files?.[0];
      if (file instanceof File) {
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setFormImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
      }
    };
    input.click();
  };

  const handleEditorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formSubmitting) return;

    setFormSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("titulo", formTitulo);
      formData.append("contenido", formContenido);
      formData.append("visible", String(formVisible));
      if (formImageFile) {
        formData.append("image", formImageFile);
      }

      const endpoint = editorMode === "create"
        ? "/api/noticias"
        : `/api/noticias/${editingNoticia?.id}`;
      const method = editorMode === "create" ? "POST" : "PATCH";
      const authToken = await getAuthToken();
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(endpoint, {
        method,
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo guardar la noticia.");
      }

      setMessage({ type: "success", text: editorMode === "create" ? "Noticia creada correctamente." : "Noticia actualizada correctamente." });
      setEditorOpen(false);
      resetEditor();
      refreshNoticias();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al guardar la noticia.",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleVisible = async (noticia: Noticia) => {
    if (!noticia.id) return;
    setMessage(null);

    try {
      const authToken = await getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/noticias/${noticia.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ visible: !noticia.visible }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo cambiar la visibilidad.");
      }

      setMessage({ type: "success", text: `Noticia ${data.visible ? "mostrada" : "ocultada"} correctamente.` });
      refreshNoticias();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo cambiar la visibilidad." });
    }
  };

  const handleDeleteNoticia = async (id: number) => {
    setConfirmDeleteId(null);
    setMessage(null);

    try {
      const authToken = await getAuthToken();
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/noticias/${id}`, {
        method: "DELETE",
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo eliminar la noticia.");
      }

      setMessage({ type: "success", text: "Noticia eliminada correctamente." });
      refreshNoticias();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al eliminar la noticia." });
    }
  };

  useEffect(() => {
    if (!isNoticiaOpen) {
      return;
    }
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscrollBehavior;
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
  const noticiaTitulo = noticiaActual?.titulo ?? "";
  const noticiaDescripcion = noticiaActual?.contenido ?? "";

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
              {isNewsLoading ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold bg-card/95 px-4 py-2 text-sm text-gold">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                    Cargando noticias...
                  </div>
                </div>
              ) : null}
              {message ? (
                <div className={`absolute inset-x-4 top-4 z-20 rounded-lg px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-emerald-600/10 text-emerald-200 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}`}>
                  {message.text}
                </div>
              ) : null}

              {noticias.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-125 gap-4 bg-parchment px-6 text-center">
                  <p className="font-serif text-sm text-parchment-dark/50">
                    Sin noticias por el momento
                  </p>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={openCreateEditor}
                      className="rounded-lg border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
                    >
                      Agregar noticia
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  {/* Imagen principal */}
                  <Image
                    key={noticiaActual.imagen_url}
                    src={noticiaActual.imagen_url}
                    alt={noticiaActual.titulo || "Noticia"}
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
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-serif text-base leading-tight text-gold md:text-xl">
                            {noticiaTitulo || "Nueva crónica disponible"}
                          </h2>
                          {isAdmin && noticiaActual && !noticiaActual.visible ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-destructive">
                              Oculta
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-foreground/80 font-sans md:text-xs">
                          Parte {noticiaIdx + 1} de {noticias.length}
                        </p>
                      </div>

                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={openCreateEditor}
                          className="rounded-lg border border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold transition hover:bg-gold/20"
                        >
                          Agregar noticia
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 hidden sm:flex items-center gap-2">
                      {noticias.map((item, i) => (
                        <button
                          key={`dot-${item.id}`}
                          type="button"
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

                    <p className="mt-3 text-sm text-foreground/80 line-clamp-3">
                      {noticiaDescripcion || "Haz clic para ver la noticia completa."}
                    </p>

                    {isAdmin && noticiaActual ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditEditor(noticiaActual)}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-gold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleVisible(noticiaActual)}
                          className="rounded-lg border border-gold-dim bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20"
                        >
                          {noticiaActual.visible ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(noticiaActual.id)}
                          className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
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
                      {noticias.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => setNoticiaIdx(i)}
                          aria-label={`Ver noticia ${i + 1}`}
                          className={`relative h-12 w-12 overflow-hidden rounded border-2 transition-all ${
                            i === noticiaIdx
                              ? "border-gold scale-105"
                              : "border-gold-dim/40 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={item.imagen_url}
                            alt={item.titulo || `Noticia ${i + 1}`}
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
                    key={`fullscreen-${noticiaActual.imagen_url}`}
                    src={noticiaActual.imagen_url}
                    alt={noticiaActual.titulo || "Noticia"}
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

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar editor"
            onClick={closeEditor}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-gold/30 bg-card p-6 shadow-2xl medieval-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-gold">
                  {editorMode === "create" ? "Agregar noticia" : "Editar noticia"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editorMode === "create"
                    ? "Crea una noticia con título, descripción e imagen."
                    : "Actualiza el contenido o reemplaza la imagen existente."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:border-gold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleEditorSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Título</label>
                <input
                  value={formTitulo}
                  onChange={(event) => setFormTitulo(event.target.value)}
                  placeholder="Título de la noticia"
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Contenido</label>
                <textarea
                  value={formContenido}
                  onChange={(event) => setFormContenido(event.target.value)}
                  placeholder="Descripción breve o cuerpo de la noticia"
                  rows={5}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Imagen</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleFileSelect}
                  className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDragOver
                      ? 'border-gold bg-gold/10'
                      : formImageFile
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-border hover:border-gold/50'
                  }`}
                >
                  {formImageFile ? (
                    <div className="space-y-2">
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-lg border border-border">
                        {imagePreviewUrl && (
                          <img
                            src={imagePreviewUrl}
                            alt="Vista previa"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <p className="text-sm text-foreground font-medium">
                        {formImageFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(formImageFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormImageFile(null);
                          if (imagePreviewUrl) {
                            URL.revokeObjectURL(imagePreviewUrl);
                            setImagePreviewUrl(null);
                          }
                        }}
                        className="text-xs text-destructive hover:text-destructive/80"
                      >
                        Remover imagen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto h-12 w-12 text-muted-foreground">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          className="h-full w-full"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-foreground">
                        Arrastra una imagen aquí o haz clic para seleccionar
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WEBP o GIF (máx. 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={formVisible}
                    onChange={(event) => setFormVisible(event.target.checked)}
                    className="h-4 w-4 rounded border border-border bg-background text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  />
                  Visible públicamente
                </label>
              </div>

              {editingNoticia?.imagen_url ? (
                <div className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                  Imagen actual:
                  <div className="mt-2 overflow-hidden rounded-lg border border-border">
                    <img
                      src={editingNoticia.imagen_url}
                      alt={editingNoticia.titulo || "Imagen de noticia"}
                      className="h-48 w-full object-cover"
                    />
                  </div>
                </div>
              ) : null}

              {formImageFile ? (
                <p className="text-sm text-foreground/80">
                  Archivo seleccionado: {formImageFile.name}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={formSubmitting}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-foreground transition hover:border-gold disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-background transition hover:bg-gold-dim disabled:opacity-60"
                >
                  {formSubmitting
                    ? "Guardando..."
                    : editorMode === "create"
                    ? "Crear noticia"
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={confirmDeleteId !== null}
        title="Eliminar noticia"
        description="¿Estás seguro de que quieres eliminar esta noticia y su imagen asociada?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        isLoading={formSubmitting}
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            handleDeleteNoticia(confirmDeleteId);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
