"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Flag,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { FeedbackInsert, FeedbackType } from "@/lib/types/feedback";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "idle" | "loading" | "success" | "error";

interface TypeOption {
  value: FeedbackType;
  label: string;
  icon: React.ReactNode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: TypeOption[] = [
  { value: "bug", label: "Bug", icon: <Bug className="w-3.5 h-3.5" /> },
  { value: "suggestion", label: "Sugerencia", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { value: "comment", label: "Comentario", icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setType("bug");
    setTitle("");
    setDescription("");
    setErrorMessage(null);
    setState("idle");
  };

  const handleOpen = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;

    setState("loading");
    setErrorMessage(null);

    const payload: FeedbackInsert = {
      type,
      title: title.trim(),
      description: description.trim(),
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    };

    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("feedback_reports").insert(payload);
      if (error) throw new Error(error.message);
      setState("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error desconocido. Inténtalo de nuevo.",
      );
      setState("error");
    }
  };

  const isLoading = state === "loading";

  return (
    <>
      {/* ─── Trigger button ─────────────────────────────────────────── */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.8 }}
        onClick={handleOpen}
        aria-label="Reportar un problema o enviar feedback"
        title="Reportar un problema"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded border border-gold-dim/70 bg-card px-3 py-2 text-sm font-medium text-gold shadow-lg transition-all hover:border-gold hover:bg-card/90 hover:shadow-[0_0_16px_rgba(212,175,55,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <Flag className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Reportar</span>
      </motion.button>

      {/* ─── Backdrop + slide-in panel ──────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.aside
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-card shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Panel de reporte"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-gold-dim" />
                  <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                    Enviar reporte
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  aria-label="Cerrar panel"
                  className="rounded border border-transparent p-1 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <AnimatePresence mode="wait">
                  {/* ── Success state ─── */}
                  {state === "success" ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-4 pt-10 text-center"
                    >
                      <CheckCircle className="h-12 w-12 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Reporte enviado
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Gracias por tu reporte. Lo revisaremos pronto.
                        </p>
                      </div>
                      <button
                        onClick={handleClose}
                        className="mt-4 w-full rounded border border-gold-dim/60 px-3 py-2 text-sm font-medium text-gold transition-colors hover:border-gold hover:bg-gold/5"
                      >
                        Cerrar
                      </button>
                    </motion.div>
                  ) : (
                    /* ── Form ─── */
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={handleSubmit}
                      noValidate
                      className="flex flex-col gap-5"
                    >
                      {/* Type selector */}
                      <fieldset disabled={isLoading}>
                        <legend className="mb-2 text-xs tracking-widest uppercase text-muted-foreground">
                          Tipo
                        </legend>
                        <div className="flex gap-2">
                          {TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setType(opt.value)}
                              className={`flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-xs font-medium transition-all ${
                                type === opt.value
                                  ? "border-gold bg-gold/10 text-gold"
                                  : "border-border text-muted-foreground hover:border-gold-dim hover:text-foreground"
                              }`}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </fieldset>

                      {/* Title */}
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="fw-title"
                          className="text-xs tracking-widest uppercase text-muted-foreground"
                        >
                          Título <span className="text-destructive">*</span>
                        </label>
                        <input
                          id="fw-title"
                          type="text"
                          required
                          maxLength={100}
                          disabled={isLoading}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Describe brevemente el problema"
                          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/60 disabled:opacity-50"
                        />
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="fw-desc"
                          className="text-xs tracking-widest uppercase text-muted-foreground"
                        >
                          Descripción <span className="text-destructive">*</span>
                        </label>
                        <textarea
                          id="fw-desc"
                          required
                          maxLength={1000}
                          rows={5}
                          disabled={isLoading}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe con detalle lo que ocurrió o tu sugerencia..."
                          className="resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/60 disabled:opacity-50"
                        />
                        <p className="text-right text-[10px] text-muted-foreground/60">
                          {description.length}/1000
                        </p>
                      </div>

                      {/* Error message */}
                      {state === "error" && errorMessage && (
                        <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-red-300">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          {errorMessage}
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isLoading || !title.trim() || !description.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded border border-gold-dim/70 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition-all hover:border-gold hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Enviar reporte"
                        )}
                      </button>

                      <p className="text-[10px] leading-relaxed text-muted-foreground/60">
                        Se captura la URL de la página actual y datos técnicos del navegador para ayudar en el diagnóstico.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
