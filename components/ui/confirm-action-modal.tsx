"use client";

import React from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useModalTransition, modalOverlayCls, modalPanelCls } from "@/lib/useModalTransition";

type IconType = React.ComponentType<{ className?: string }>;

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  confirmVariant?: "destructive" | "success";
  /** Color de acento (hex). Por defecto se deriva de confirmVariant. */
  accent?: string;
  /** Icono del emblema del encabezado. Por defecto según variante. */
  icon?: IconType;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  confirmVariant = "destructive",
  accent,
  icon,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  const { closing, closeWith } = useModalTransition();

  if (!open) return null;

  const handleCancel = () => closeWith(onCancel);

  const isSuccess = confirmVariant === "success";
  const tone = accent ?? (isSuccess ? "#34d399" : "#f87171");
  const Icon = icon ?? (isSuccess ? Sparkles : AlertTriangle);

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar confirmacion"
        onClick={isLoading ? undefined : handleCancel}
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm ${modalOverlayCls(closing)}`}
      />

      <div
        className={`adm-modal relative w-full max-w-md overflow-hidden rounded-xl ${modalPanelCls(closing)}`}
        style={{ ["--adm-accent" as string]: tone }}
      >
        <span className="adm-modal-line" aria-hidden />

        <div className="adm-grain relative p-6">
          <div className="flex items-start gap-3.5">
            <span
              className="asc-pulse-glow inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${tone}55`, background: `${tone}1a`, color: tone }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h4 className="font-serif text-lg text-foreground">{title}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm text-foreground transition-colors hover:border-gold-dim disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
              style={{
                borderColor: `${tone}66`,
                background: `${tone}22`,
                color: tone,
                boxShadow: `0 0 20px -8px ${tone}`,
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
