"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  User,
  MessageSquare,
  Users,
  Shield,
  LogIn,
  LogOut,
  Coins,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useRouletteEnabled } from "@/lib/useRouletteEnabled";
import { getAccountLevelTitle } from "@/lib/accountLevel";
import { sidebarItems } from "./sidebar";

// Accesos de cuenta (espejo de los botones circulares del header de escritorio)
const accountLinks = [
  { id: "perfil", label: "Perfil", icon: User, href: "/profile" as string | null, comingSoon: false },
  { id: "gremio-chat", label: "Chat de Gremio", icon: MessageSquare, href: "/gremio" as string | null, comingSoon: false },
  { id: "amigos", label: "Amigos", icon: Users, href: null as string | null, comingSoon: true },
];

const listVariants = {
  closed: {},
  open: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};

const itemVariants = {
  closed: { opacity: 0, x: -20 },
  open: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 420, damping: 34 },
  },
};

/**
 * Acceso rápido móvil para la portada: fila deslizable de píldoras con las
 * secciones principales. Oculto en escritorio (lg+), donde ya existe el sidebar.
 */
export function MobileQuickNav({
  rouletteEnabled,
}: {
  rouletteEnabled?: boolean | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const items = sidebarItems.filter((item) => item.href && item.href !== "/");

  return (
    <motion.nav
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="lg:hidden -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Acceso rápido"
    >
      {items.map((item, index) => {
        const disabled = item.id === "ruleta" && rouletteEnabled !== true;
        const active = pathname === item.href;
        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * index, duration: 0.25, ease: "easeOut" }}
            onClick={() => !disabled && item.href && router.push(item.href)}
            disabled={disabled}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium font-sans transition-colors active:scale-95 ${
              disabled
                ? "border-border bg-card text-muted-foreground/40 cursor-not-allowed"
                : active
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-border bg-card text-foreground hover:border-gold-dim hover:text-gold"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </motion.button>
        );
      })}
    </motion.nav>
  );
}

export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { rouletteEnabled } = useRouletteEnabled();
  const [open, setOpen] = useState(false);

  // Cerrar al navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquear scroll del body y cerrar con ESC mientras está abierto
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.refresh();
  };

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary text-gold border border-border hover:border-gold-dim active:scale-95 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed left-0 top-0 z-[80] flex h-dvh w-[85vw] max-w-xs flex-col border-r border-gold-dim/40 bg-card shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
            >
              {/* Cabecera del drawer */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-10 h-8 rounded overflow-hidden">
                    <Image
                      src="/imgs/mea-culpa-logo.jpeg"
                      alt="Mea Culpa Logo"
                      fill
                      sizes="40px"
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gold tracking-wider font-sans leading-tight">
                      MEA CULPA
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">RPG Online</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-gold hover:bg-secondary active:scale-95 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Usuario */}
              {isAuthenticated && user && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="border-b border-border bg-secondary/40 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-gold">{user.name}</p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {getAccountLevelTitle(user.level)} (Nivel {user.level})
                    </p>
                    <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                      <Coins className="w-3 h-3" />
                      {user.oro.toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Navegación principal */}
              <motion.nav
                variants={listVariants}
                initial="closed"
                animate="open"
                className="flex-1 overflow-y-auto p-3"
              >
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Navegación
                </p>
                <ul className="space-y-1">
                  {sidebarItems.map((item) => {
                    const staticDisabled = "disabled" in item && item.disabled;
                    const rouletteDisabled =
                      item.id === "ruleta" && rouletteEnabled !== true;
                    const disabled = staticDisabled || rouletteDisabled;
                    const active = item.href ? pathname === item.href : false;
                    return (
                      <motion.li key={item.id} variants={itemVariants}>
                        <button
                          onClick={() => !disabled && item.href && goTo(item.href)}
                          disabled={disabled}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium font-sans transition-colors active:scale-[0.98] ${
                            disabled
                              ? "text-muted-foreground/40 cursor-not-allowed"
                              : active
                                ? "bg-gold/15 text-gold border border-gold/40"
                                : "text-foreground hover:bg-secondary hover:text-gold"
                          }`}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {disabled && (
                            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground">
                              Próx.
                            </span>
                          )}
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>

                {isAuthenticated && user && (
                  <>
                    <p className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Cuenta
                    </p>
                    <ul className="space-y-1">
                      {user.isAdmin && (
                        <motion.li variants={itemVariants}>
                          <button
                            onClick={() => goTo("/admin")}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium font-sans transition-colors active:scale-[0.98] ${
                              pathname === "/admin"
                                ? "bg-gold/15 text-gold border border-gold/40"
                                : "text-gold hover:bg-gold/10"
                            }`}
                          >
                            <Shield className="w-5 h-5 shrink-0" />
                            <span>Panel de Administrador</span>
                            <span className="ml-auto rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold leading-none text-background">
                              ADM
                            </span>
                          </button>
                        </motion.li>
                      )}
                      {accountLinks.map((link) => (
                        <motion.li key={link.id} variants={itemVariants}>
                          <button
                            onClick={() => !link.comingSoon && link.href && goTo(link.href)}
                            disabled={link.comingSoon}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium font-sans transition-colors active:scale-[0.98] ${
                              link.comingSoon
                                ? "text-muted-foreground/40 cursor-not-allowed"
                                : link.href && pathname === link.href
                                  ? "bg-gold/15 text-gold border border-gold/40"
                                  : "text-foreground hover:bg-secondary hover:text-gold"
                            }`}
                          >
                            <link.icon className="w-5 h-5 shrink-0" />
                            <span className="truncate">{link.label}</span>
                            {link.comingSoon && (
                              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground">
                                Próx.
                              </span>
                            )}
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  </>
                )}
              </motion.nav>

              {/* Pie: sesión */}
              <div className="border-t border-border p-3">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive active:scale-[0.98]"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                ) : (
                  <button
                    onClick={() => goTo("/login")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-background shadow-lg transition-colors hover:bg-gold-dim active:scale-[0.98]"
                  >
                    <LogIn className="w-4 h-4" />
                    Iniciar Sesión
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
