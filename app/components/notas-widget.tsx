"use client";

// Bloc de notas privado del jugador, guardado en /api/notas.

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

const PAGINAS = [1, 2, 3, 4, 5] as const;
const ROMANO = ["I", "II", "III", "IV", "V"] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NotasWidget({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [paginaActiva, setPaginaActiva] = useState(1);
  const [contenidos, setContenidos] = useState<Record<number, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/notas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.paginas) setContenidos(data.paginas);
      })
      .catch(() => {});
  }, [token]);

  const guardar = useCallback(
    async (pagina: number, contenido: string) => {
      if (!token) return;
      setSaveState("saving");
      try {
        const res = await fetch("/api/notas", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pagina, contenido }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
      setTimeout(() => setSaveState("idle"), 2500);
    },
    [token]
  );

  const handleChange = (valor: string) => {
    setContenidos((prev) => ({ ...prev, [paginaActiva]: valor }));
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => guardar(paginaActiva, valor), 1500);
  };

  return (
    <div className="bg-card border border-gold-dim/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-linear-to-r from-gold-dim/20 to-transparent hover:from-gold-dim/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gold" />
          <span className="text-gold font-semibold tracking-wide text-sm uppercase" style={{ fontFamily: "Cinzel, serif" }}>
            Notas
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && saveState === "saving" && (
            <span className="text-xs text-muted-foreground">Guardando…</span>
          )}
          {open && saveState === "saved" && (
            <span className="text-xs text-gold/70">Guardado</span>
          )}
          {open && saveState === "error" && (
            <span className="text-xs text-red-400">Error al guardar</span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-gold-dim" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gold-dim" />
          )}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex gap-1">
            {PAGINAS.map((n, i) => (
              <button
                key={n}
                onClick={() => setPaginaActiva(n)}
                className={`px-3 py-1 rounded text-sm font-semibold tracking-wider border transition-colors ${
                  paginaActiva === n
                    ? "bg-gold/20 border-gold text-gold"
                    : "bg-transparent border-gold-dim/40 text-gold-dim/70 hover:border-gold-dim hover:text-gold-dim"
                }`}
                style={{ fontFamily: "Cinzel, serif" }}
              >
                {ROMANO[i]}
              </button>
            ))}
          </div>

          <textarea
            value={contenidos[paginaActiva] ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Escribe tus anotaciones aquí..."
            className="w-full min-h-[300px] resize-y bg-background/80 border border-gold-dim/40 rounded p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold-dim transition-colors"
          />
        </div>
      )}
    </div>
  );
}
