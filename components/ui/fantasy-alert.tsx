"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

type FantasyAlertVariant = "info" | "success" | "warning" | "error";

type FantasyAlertProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  title?: string;
  durationMs?: number;
  variant?: FantasyAlertVariant;
  className?: string;
};

const VARIANT_STYLES: Record<FantasyAlertVariant, string> = {
  info: "border-[#8B7355] bg-[#15120f] text-[#e8d8b0]",
  success: "border-[#5f7a33] bg-[#10170d] text-[#c8e2a4]",
  warning: "border-[#B8860B] bg-[#1a1508] text-[#f0d892]",
  error: "border-[#8d3b36] bg-[#1a0d0b] text-[#f2b8b5]",
};

export default function FantasyAlert({
  open,
  message,
  onClose,
  title = "Notificación",
  durationMs = 2200,
  variant = "warning",
  className,
}: FantasyAlertProps) {
  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className="fixed top-6 right-6 z-90 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto min-w-96 max-w-140 rounded-xl border shadow-2xl",
          "backdrop-blur-sm px-6 py-5",
          "animate-in slide-in-from-top-2 fade-in duration-200",
          VARIANT_STYLES[variant],
          className,
        )}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 h-3 w-3 rounded-full bg-current/80" />
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.22em] font-semibold opacity-90">
              {title}
            </p>
            <p className="text-lg mt-2 leading-snug">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded text-lg hover:bg-white/10 transition-colors"
            aria-label="Cerrar alerta"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
