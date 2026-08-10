"use client";

// Cabecera flotante: navegación principal, oro del usuario y menú de cuenta.
//
// En escritorio (lg+) lleva las mismas rutas que el sidebar —salen de
// `sidebarItems`, no de una lista paralela— para que la navegación siga a mano
// en las páginas que no lo pintan (perfil, ruleta, panel de DM). El sidebar
// sigue siendo el índice con subtítulos; esto es el acceso rápido.

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  User,
  MessageSquare,
  Users,
  LogIn,
  LogOut,
  Shield,
  Coins,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useRouletteEnabled } from "@/lib/useRouletteEnabled";
import { useOpenPartidasCount } from "@/lib/useOpenPartidasCount";
import { getAccountLevelTitle } from "@/lib/accountLevel";
import { playUiHoverSfx } from "@/lib/sfx";
import { sidebarItems } from "./sidebar";
import MobileNav from "./mobile-nav";

// Accesos de cuenta del menú desplegable.
const accountLinks = [
  { id: "cuenta", icon: User, label: "Mi perfil", href: "/profile", comingSoon: false },
  { id: "chat", icon: MessageSquare, label: "Chat de Gremio", href: "/gremio", comingSoon: false },
  { id: "amigos", icon: Users, label: "Amigos", href: null, comingSoon: true },
];

// Sólo las rutas navegables: las secciones "próximamente" viven en el sidebar y
// en el menú móvil, y aquí sólo robarían sitio.
const navItems = sidebarItems.filter((item) => item.href);

const menuItemCls =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-secondary data-[highlighted]:text-gold data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground/40";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { rouletteEnabled } = useRouletteEnabled();
  const partidasAbiertas = useOpenPartidasCount();

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  return (
    <header className="sticky top-3 z-40 mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/85 p-3 shadow-[0_12px_34px_-16px_rgba(0,0,0,0.95)] backdrop-blur-xl medieval-border supports-[backdrop-filter]:bg-card/70">
      {/* Burger (solo móvil) + Logo */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <MobileNav />
        <button
          type="button"
          onClick={() => router.push("/")}
          onMouseEnter={playUiHoverSfx}
          aria-label="Ir al inicio"
          className="group flex items-center gap-2 sm:gap-3"
        >
          <span className="relative h-10 w-12 overflow-hidden rounded-lg sm:h-12 sm:w-16">
            <Image
              src="/imgs/mea-culpa-logo.jpeg"
              alt="MudHakar Logo"
              fill
              sizes="64px"
              className="object-contain transition-transform duration-300 group-hover:scale-110"
              priority
            />
          </span>
          <span className="text-left">
            <span className="block text-base font-bold tracking-wider text-gold font-sans sm:text-xl">
              MUDHAKAR
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">RPG Online</span>
          </span>
        </button>
      </div>

      {/* Navegación principal (escritorio) */}
      <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex" aria-label="Navegación principal">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const disabled = item.id === "ruleta" && rouletteEnabled !== true;
          const badge =
            item.id === "partidas" && typeof partidasAbiertas === "number" && partidasAbiertas > 0
              ? partidasAbiertas
              : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !disabled && item.href && router.push(item.href)}
              onMouseEnter={disabled ? undefined : playUiHoverSfx}
              disabled={disabled}
              aria-current={active ? "page" : undefined}
              title={disabled ? "No disponible ahora mismo" : item.label}
              className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium font-sans transition-colors duration-200 ${
                disabled
                  ? "cursor-not-allowed text-muted-foreground/35"
                  : active
                    ? "text-gold"
                    : "text-muted-foreground hover:text-gold"
              }`}
            >
              {/* Píldora activa: framer la desliza de una sección a otra */}
              {active && (
                <motion.span
                  layoutId="nav-activo"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-lg border border-gold/40 bg-gold/10 shadow-[0_0_18px_-4px_rgba(212,175,55,0.45)]"
                  aria-hidden
                />
              )}
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{item.label}</span>
              {badge !== null && (
                <span className="ml-0.5 rounded-full bg-gold px-1.5 py-px text-[9px] font-bold leading-none text-background tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Oro y cuenta */}
      <div className="flex shrink-0 items-center gap-2">
        {isLoading ? (
          /* Skeleton neutro mientras se verifica la sesión — evita el flash */
          <div className="flex animate-pulse items-center gap-2">
            <div className="h-9 w-24 rounded-full bg-secondary" />
            <div className="h-10 w-10 rounded-full bg-secondary" />
          </div>
        ) : isAuthenticated && user ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-400 tabular-nums">
              <Coins className="h-3.5 w-3.5" />
              {user.oro.toLocaleString()}
            </span>

            {user.isAdmin && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                onMouseEnter={playUiHoverSfx}
                title="Panel de DM"
                aria-label="Panel de DM"
                className={`hidden h-10 w-10 items-center justify-center rounded-full transition-all lg:flex ${
                  pathname === "/admin"
                    ? "bg-gold text-background ring-2 ring-gold/50"
                    : "border border-gold/40 bg-gold/20 text-gold hover:bg-gold/30"
                }`}
              >
                <Shield className="h-5 w-5" />
              </button>
            )}

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  onMouseEnter={playUiHoverSfx}
                  aria-label="Menú de cuenta"
                  className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-2 text-left transition-all hover:border-gold-dim data-[state=open]:border-gold/60 sm:flex"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-xs font-bold text-gold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-xs font-medium leading-tight text-gold">
                      {user.name}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                      {getAccountLevelTitle(user.level)} · Nv {user.level}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-[90] w-56 rounded-xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <div className="px-2.5 pb-2 pt-1.5 xl:hidden">
                    <p className="truncate text-sm font-semibold text-gold">{user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {getAccountLevelTitle(user.level)} (Nivel {user.level})
                    </p>
                  </div>

                  {accountLinks.map((link) => (
                    <DropdownMenu.Item
                      key={link.id}
                      disabled={link.comingSoon}
                      onSelect={() => link.href && router.push(link.href)}
                      className={menuItemCls}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{link.label}</span>
                      {link.comingSoon && (
                        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground">
                          Próx.
                        </span>
                      )}
                    </DropdownMenu.Item>
                  ))}

                  {user.isAdmin && (
                    <DropdownMenu.Item
                      onSelect={() => router.push("/admin")}
                      className={`${menuItemCls} text-gold lg:hidden`}
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      <span>Panel de DM</span>
                      <span className="ml-auto rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold leading-none text-background">
                        ADM
                      </span>
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

                  <DropdownMenu.Item
                    onSelect={handleLogout}
                    className={`${menuItemCls} data-[highlighted]:text-destructive`}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Cerrar sesión
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        ) : (
          <button
            onClick={() => router.push("/login")}
            onMouseEnter={playUiHoverSfx}
            className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-medium text-background shadow-lg transition-all hover:bg-gold-dim hover:shadow-xl"
            title="Iniciar Sesión"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Iniciar Sesión</span>
          </button>
        )}
      </div>
    </header>
  );
}
