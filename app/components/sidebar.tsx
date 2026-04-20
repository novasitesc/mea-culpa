"use client";

import { useRouter, usePathname } from "next/navigation";
import { ShoppingBag, Wallet, Calendar, Store, Scroll, Dice6, Shield } from "lucide-react";

// ─── Definición de ítems ──────────────────────────────────────────────────

export const sidebarItems = [
  {
    id: "inicio",
    label: "Inicio",
    icon: Scroll,
    hasIndicator: true,
    href: "/",
  },
  {
    id: "tiendas",
    label: "Tiendas",
    icon: Store,
    hasIndicator: true,
    href: "/tiendas",
  },
  {
    id: "ruleta",
    label: "Ruleta",
    icon: Dice6,
    hasIndicator: true,
    href: "/ruleta",
  },
  {
    id: "balance",
    label: "Balance",
    icon: Wallet,
    hasIndicator: false,
    href: null as string | null,
    disabled: true,
  },
  {
    id: "eventos",
    label: "Eventos",
    icon: Calendar,
    hasIndicator: false,
    href: null as string | null,
    disabled: true,
  },
  {
    id: "comercio",
    label: "Comercio",
    icon: ShoppingBag,
    hasIndicator: true,
    href: "/comercio",
    subtitle: "(compra y venta entre personajes)",
  },
  {
    id: "gremio",
    label: "Gremio",
    icon: Shield,
    hasIndicator: true,
    href: "/gremio",
    subtitle: "(baul compartido y solicitudes)",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────

type SidebarProps = {
  /** Sección activa (para ítems sin href) */
  activeSection?: string;
  /** Callback cuando se pulsa un ítem sin href. Si no se provee, navega a "/" */
  onSectionChange?: (id: string) => void;
  /** Estado global de la ruleta */
  rouletteEnabled?: boolean;
};

// ─── Componente ───────────────────────────────────────────────────────────

export default function Sidebar({
  activeSection,
  onSectionChange,
  rouletteEnabled = true,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (item: (typeof sidebarItems)[number]): boolean => {
    if (item.href) {
      return pathname === item.href;
    }
    return activeSection === item.id;
  };

  const handleClick = (item: (typeof sidebarItems)[number]) => {
    if ("disabled" in item && item.disabled) return;
    if (item.href) {
      router.push(item.href);
    } else if (onSectionChange) {
      onSectionChange(item.id);
    } else {
      router.push("/");
    }
  };

  return (
    <aside className="space-y-3">
      {sidebarItems.map((item) => {
        const staticDisabled = "disabled" in item && item.disabled;
        const rouletteDisabled = item.id === "ruleta" && !rouletteEnabled;
        const disabled = staticDisabled || rouletteDisabled;
        return (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            disabled={disabled}
            className={`w-full rounded-lg border p-4 text-left transition-all ${
              disabled
                ? "bg-card border-border text-muted-foreground opacity-50 cursor-not-allowed"
                : isActive(item)
                  ? "bg-card border-gold text-gold medieval-border"
                  : "bg-card border-border text-foreground hover:border-gold-dim"
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5" />
              <span className="font-medium font-sans">{item.label}</span>
              {disabled ? (
                <span className="ml-auto text-[10px] font-sans bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                  {rouletteDisabled ? "Deshabilitada" : "Próx."}
                </span>
              ) : (
                item.hasIndicator && (
                  <span className="w-2 h-2 rounded-full bg-gold ml-auto" />
                )
              )}
            </div>
            {"subtitle" in item && item.subtitle && (
              <p className="text-xs text-muted-foreground mt-1 ml-8">
                {item.subtitle}
              </p>
            )}
          </button>
        );
      })}
    </aside>
  );
}
