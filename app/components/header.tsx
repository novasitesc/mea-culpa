"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  User,
  MessageSquare,
  Users,
  LogIn,
  LogOut,
  Shield,
  Coins,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";

// Botones del header
const headerButtons = [
  {
    id: "cuenta",
    icon: User,
    label: "Perfil",
    href: "/profile",
    comingSoon: false,
  },
  {
    id: "chat",
    icon: MessageSquare,
    label: "Chat de Gremio",
    href: null,
    comingSoon: false,
  },
  {
    id: "amigos",
    icon: Users,
    label: "Amigos",
    href: null,
    comingSoon: true,
  },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between mb-6 bg-card rounded-lg border border-border p-3 medieval-border">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="relative w-16 h-12 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
          onClick={() => router.push("/")}
        >
          <Image
            src="/imgs/mea-culpa-logo.jpeg"
            alt="Mea Culpa Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gold tracking-wider font-sans">
            MEA CULPA
          </h1>
          <p className="text-xs text-muted-foreground">RPG Online</p>
        </div>
      </div>

      {/* Header Buttons */}
      <div className="flex items-center gap-2">
        {isLoading ? (
          /* Skeleton neutro mientras se verifica la sesión — evita el flash */
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-secondary" />
            <div className="w-10 h-10 rounded-full bg-secondary" />
            <div className="w-24 h-9 rounded-lg bg-secondary" />
          </div>
        ) : isAuthenticated && user ? (
          <>
            {user.isAdmin && (
              <div className="relative group">
                <button
                  onClick={() => router.push("/admin")}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    pathname === "/admin"
                      ? "bg-gold text-background ring-2 ring-gold/50"
                      : "bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30"
                  }`}
                  title="Panel de Administrador"
                >
                  <Shield className="w-5 h-5" />
                </button>
                <span className="absolute -top-1 -right-1 text-[9px] leading-none bg-gold text-background px-1 py-0.5 rounded font-bold pointer-events-none">
                  ADM
                </span>
              </div>
            )}
            {headerButtons.map((button) => (
              <div key={button.id} className="relative group">
                <button
                  onClick={() =>
                    button.href &&
                    !button.comingSoon &&
                    router.push(button.href)
                  }
                  disabled={button.comingSoon}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    button.comingSoon
                      ? "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                      : button.href && pathname === button.href
                        ? "bg-gold text-background ring-2 ring-gold/50 hover:bg-gold-dim"
                        : "bg-secondary text-muted-foreground hover:bg-muted hover:text-gold"
                  }`}
                  title={button.comingSoon ? "Próximamente" : button.label}
                >
                  <button.icon className="w-5 h-5" />
                </button>
                {button.comingSoon && (
                  <span className="absolute -top-1 -right-1 text-[9px] leading-none bg-muted text-muted-foreground px-1 py-0.5 rounded font-sans pointer-events-none">
                    Próx.
                  </span>
                )}
              </div>
            ))}
            <div className="hidden sm:block text-right mx-2">
              <p className="text-sm font-medium text-gold">{user.name}</p>
              <div className="flex items-center justify-end gap-2">
                <p className="text-xs text-muted-foreground">
                  Nivel {user.level}
                </p>
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                  <Coins className="w-3 h-3" />
                  {user.oro.toLocaleString()}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-destructive font-medium rounded-lg transition-all flex items-center gap-2"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </>
        ) : (
          <>
            {headerButtons.slice(0, 2).map((button) => (
              <button
                key={button.id}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:bg-muted hover:text-gold transition-all"
                title={button.label}
              >
                <button.icon className="w-5 h-5" />
              </button>
            ))}
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 bg-gold hover:bg-gold-dim text-background font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              title="Iniciar Sesión"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
