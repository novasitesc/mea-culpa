"use client";

import { useRouter, usePathname } from "next/navigation";
import { ShoppingBag, Wallet, Calendar, Store, Scroll } from "lucide-react";

// ─── Definición de ítems ──────────────────────────────────────────────────

export const sidebarItems = [
  {
    id: "inicio",
    label: "Inicio",
    icon: Scroll,
    hasIndicator: true,
    href: null as string | null,
  },
  {
    id: "tiendas",
    label: "Tiendas",
    icon: Store,
    hasIndicator: true,
    href: "/tiendas",
  },
  {
    id: "balance",
    label: "Balance",
    icon: Wallet,
    hasIndicator: false,
    href: null as string | null,
  },
  {
    id: "eventos",
    label: "Eventos",
    icon: Calendar,
    hasIndicator: false,
    href: null as string | null,
  },
  {
    id: "comercio",
    label: "Comercio",
    icon: ShoppingBag,
    hasIndicator: false,
    href: null as string | null,
    subtitle: "(compra y venta entre pj)",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────

type SidebarProps = {
  /** Sección activa (para ítems sin href) */
  activeSection?: string;
  /** Callback cuando se pulsa un ítem sin href. Si no se provee, navega a "/" */
  onSectionChange?: (id: string) => void;
};

// ─── Componente ───────────────────────────────────────────────────────────

export default function Sidebar({
  activeSection,
  onSectionChange,
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
      {sidebarItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleClick(item)}
          className={`w-full rounded-lg border p-4 text-left transition-all ${
            isActive(item)
              ? "bg-card border-gold text-gold medieval-border"
              : "bg-card border-border text-foreground hover:border-gold-dim"
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            <span className="font-medium font-sans">{item.label}</span>
            {item.hasIndicator && (
              <span className="w-2 h-2 rounded-full bg-gold ml-auto" />
            )}
          </div>
          {"subtitle" in item && item.subtitle && (
            <p className="text-xs text-muted-foreground mt-1 ml-8">
              {item.subtitle}
            </p>
          )}
        </button>
      ))}
    </aside>
  );
}
