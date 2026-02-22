"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "../components/header";
import { useAuth } from "@/lib/useAuth";

type Player = {
  name: string;
  role: string;
  level: number;
  home: string;
};

type Character = {
  id: number;
  name: string;
  className: string;
  race: string;
  alignment: string;
  background: string;
  portrait: string;
  stats: Record<string, number>;
  gear: string[];
};

type ProfileResponse = {
  player: Player;
  characters: Character[];
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isMounted = true;

    fetch(`/api/profile?userId=${user.id}`)
      .then((res) => res.json())
      .then((data: ProfileResponse) => {
        if (isMounted) {
          // Sobrescribir con datos del usuario autenticado
          setProfile({
            ...data,
            player: {
              name: user.name,
              role: user.role,
              level: user.level,
              home: data.player.home,
            },
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user, isAuthenticated]);

  // Mostrar loading mientras se verifica autenticación
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground mt-4">Cargando...</p>
        </div>
      </div>
    );
  }

  const player = profile?.player;
  const characters = profile?.characters ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[#B8860B] text-xs tracking-[0.3em] uppercase">
                Perfil del Jugador
              </p>
              <h1 className="text-3xl font-serif text-[#D4AF37] tracking-wide mt-2">
                {player?.name ?? "Cargando..."}
              </h1>
              <p className="text-muted-foreground mt-2">
                {player
                  ? `${player.role} · Nivel ${player.level} · ${player.home}`
                  : "Obteniendo datos del perfil"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded border border-[#B8860B] text-[#B8860B] text-xs uppercase">
                {characters.length} personaje
                {characters.length === 1 ? "" : "s"}
              </span>
              <span className="px-3 py-1 rounded bg-secondary text-foreground text-xs uppercase">
                Activo
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {characters.map((character) => (
            <article
              key={character.id}
              className="rounded-lg border-2 border-[#8B7355] bg-card/80 p-6 grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6"
            >
              <div className="space-y-4">
                <div className="relative aspect-square w-64 md:w-72 mx-auto rounded border-2 border-[#8B7355] overflow-hidden bg-secondary/40">
                  <Image
                    src={character.portrait}
                    alt={`${character.name} portrait`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground tracking-[0.3em] uppercase">
                    {character.race}
                  </p>
                  <h2 className="text-2xl font-serif text-[#D4AF37] tracking-wide">
                    {character.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {character.className}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded bg-secondary text-center text-sm">
                    {character.background}
                  </div>
                  <div className="px-3 py-2 rounded bg-[#8B7355] text-background text-center text-sm">
                    {character.alignment}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(character.stats).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded border border-border/60 bg-secondary/40 p-3 text-center"
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">
                        {label}
                      </p>
                      <p className="text-2xl font-semibold text-foreground mt-1">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                    Equipo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {character.gear.map((item) => (
                      <div
                        key={item}
                        className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
