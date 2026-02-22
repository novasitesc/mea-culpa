"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Map, Menu, Scroll, Swords, UserCircle2, Users, X, LogOut } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

const navItems = [
  { label: "Campaigns", icon: BookOpen },
  { label: "Party", icon: Users },
  { label: "World Map", icon: Map },
  { label: "Combat", icon: Swords },
];

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      {/* User menu */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {isAuthenticated && user ? (
          <>
            <div className="hidden sm:block text-right mr-2">
              <p className="text-sm font-medium text-[#D4AF37]">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <Link
              href="/profile"
              className="p-2 rounded hover:bg-secondary/50 text-[#D4AF37]"
              aria-label="Ir al perfil del jugador"
              title="Perfil"
            >
              <UserCircle2 className="w-6 h-6" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 rounded hover:bg-secondary/50 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 bg-gold hover:bg-gold-dim text-background font-medium rounded-lg transition-all text-sm"
            title="Iniciar Sesión"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded border-2 border-[#8B7355] flex items-center justify-center bg-secondary">
              <Scroll className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-wider text-[#D4AF37]">Chronicles</h1>
              <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                of the Realm
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                className="flex items-center px-4 py-2 text-muted-foreground hover:text-[#D4AF37] hover:bg-secondary/50 rounded tracking-wide transition-colors"
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </button>
            ))}
          </nav>

          <button
            className="md:hidden p-2 hover:bg-secondary/50 rounded"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border/30">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className="flex items-center px-4 py-2 text-muted-foreground hover:text-[#D4AF37] rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
