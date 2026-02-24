"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  MessageSquare,
  CreditCard,
  Users,
  LogIn,
  LogOut,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";

// Botones del header
const headerButtons = [
  { id: "cuenta", icon: User, label: "Cuenta", highlighted: true },
  { id: "chat", icon: MessageSquare, label: "Chat de Gremio" },
  { id: "paypal", icon: CreditCard, label: "Pagos" },
  { id: "amigos", icon: Users, label: "Amigos" },
];

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
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
        {isAuthenticated && user ? (
          <>
            {headerButtons.map((button) => (
              <button
                key={button.id}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  button.highlighted
                    ? "bg-gold text-background ring-2 ring-gold/50"
                    : "bg-secondary text-muted-foreground hover:bg-muted hover:text-gold"
                }`}
                title={button.label}
              >
                <button.icon className="w-5 h-5" />
              </button>
            ))}
            <div className="hidden sm:block text-right mx-2">
              <p className="text-sm font-medium text-gold">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                Nivel {user.level}
              </p>
            </div>
            <button
              onClick={() => router.push("/profile")}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gold text-background ring-2 ring-gold/50 transition-all hover:bg-gold-dim"
              title="Ver Perfil"
            >
              <UserCircle2 className="w-5 h-5" />
            </button>
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
