"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PrizeWheel from "./components/prize-wheel";
import { useAuth } from "@/lib/useAuth";

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

export default function HomePage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("inicio");
  const [activeSlot, setActiveSlot] = useState(1);
  const [noticias, setNoticias] = useState<NoticiaImage[]>([]);
  const [noticiaIdx, setNoticiaIdx] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const userId = user?.id ?? "demo-user";

    setIsProfileLoading(true);

    fetch(`/api/profile?userId=${userId}`)
      .then((res) => res.json())
      .then((data: ProfileResponse) => {
        if (isMounted) {
          setProfile(data);
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
  }, [user?.id]);

  // Cargar imágenes de noticias
  useEffect(() => {
    fetch("/api/noticias")
      .then((r) => r.json())
      .then((data: NoticiaImage[]) => setNoticias(data))
      .catch(() => {});
  }, []);

  const prevNoticia = () =>
    setNoticiaIdx((i) => (i - 1 + noticias.length) % noticias.length);
  const nextNoticia = () => setNoticiaIdx((i) => (i + 1) % noticias.length);

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
            onSectionChange={setActiveSection}
          />

          {/* Center */}
          {activeSection === "ruleta" ? (
            <main className="min-h-125">
              <PrizeWheel token={token} />
            </main>
          ) : (
            <main className="relative rounded-lg overflow-hidden shadow-2xl border-4 border-gold-dim candle-glow min-h-125">
              {noticias.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-125 bg-parchment">
                  <p className="font-serif text-sm text-parchment-dark/50">
                    Sin noticias por el momento
                  </p>
                </div>
              ) : (
                <>
                  {/* Imagen cubriendo todo el main */}
                  <Image
                    key={noticias[noticiaIdx].url}
                    src={noticias[noticiaIdx].url}
                    alt={noticias[noticiaIdx].alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 600px"
                  />

                  {/* Controles superpuestos */}
                  {noticias.length > 1 && (
                    <>
                      <button
                        onClick={prevNoticia}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/70 hover:bg-background/90 text-foreground rounded-full p-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={nextNoticia}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/70 hover:bg-background/90 text-foreground rounded-full p-1.5 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Contador */}
                  <div className="absolute bottom-2 right-2 z-10 bg-background/70 text-xs text-foreground px-2 py-0.5 rounded font-sans">
                    {noticiaIdx + 1} / {noticias.length}
                  </div>

                  {/* Miniaturas */}
                  {noticias.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                      {noticias.map((img, i) => (
                        <button
                          key={img.filename}
                          onClick={() => setNoticiaIdx(i)}
                          className={`relative w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                            i === noticiaIdx
                              ? "border-gold scale-110"
                              : "border-gold-dim/30 opacity-60 hover:opacity-100"
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
    </div>
  );
}
