"use client";

import { Loader2 } from "lucide-react";

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
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
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar confirmacion"
        onClick={isLoading ? undefined : onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
      />

      <div className="relative w-full max-w-md rounded-xl border border-gold/30 bg-card p-5 shadow-2xl medieval-border">
        <h4 className="text-lg font-bold text-gold">{title}</h4>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:border-gold-dim disabled:opacity-60"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/60 bg-destructive/20 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
