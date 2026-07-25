"use client";

// Chat del gremio. Historial persistido en `gremio_mensajes` (GET /api/gremio/chat)
// y entrega instantánea por el canal broadcast `gremio-chat-<id>`, el mismo
// patrón que usa la sala de partida.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { MessagesSquare, SendHorizonal } from "lucide-react";

export type ChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  userId: string;
  authorName: string;
};

type Props = {
  gremioId: number;
  token: string | null;
  myUserId: string | undefined;
};

const MAX_LEN = 500;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

// Color estable por autor: mismo nombre, mismo tono, sin guardar nada.
function autorHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function GremioChat({ gremioId, token, myUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Ignora duplicados: el emisor ya insertó su mensaje desde la respuesta HTTP
  // y el broadcast puede volver a traerlo.
  const append = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/gremio/chat", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el chat");
        setMessages(data.messages ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Error al cargar el chat");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!gremioId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`gremio-chat-${gremioId}`)
      .on("broadcast", { event: "mensaje" }, ({ payload }: { payload: ChatMessage }) => {
        append(payload);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gremioId, append]);

  // Auto-scroll solo si el usuario ya estaba abajo: si subió a leer historial,
  // un mensaje nuevo no le arranca la vista de las manos.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || !token || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gremio/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar");
      append(data.message);
      setDraft("");
      atBottomRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-gold-dim/20 px-4 py-3">
        <MessagesSquare className="h-4 w-4 text-gold/80" />
        <h3 className="font-serif text-sm tracking-wide text-gold">Sala común</h3>
        <span className="ml-auto font-sans text-[10px] uppercase tracking-widest text-foreground/35">
          {messages.length} mensajes
        </span>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="feed-scroll flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-3"
      >
        {loading ? (
          <p className="font-sans text-xs italic text-foreground/30">Abriendo el canal...</p>
        ) : messages.length === 0 ? (
          <p className="font-sans text-xs italic text-foreground/30">
            Nadie ha hablado todavía. Rompe el silencio.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === myUserId;
            const hue = autorHue(m.authorName);
            return (
              <div
                key={m.id}
                className={`flex animate-in fade-in slide-in-from-bottom-1 duration-300 ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                    mine
                      ? "border-gold/30 bg-gold/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {!mine && (
                    <p
                      className="font-sans text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: `oklch(0.72 0.11 ${hue})` }}
                    >
                      {m.authorName}
                    </p>
                  )}
                  <p className="font-sans text-sm leading-snug break-words text-foreground/85">
                    {m.content}
                  </p>
                  <p className="mt-0.5 text-right font-sans text-[10px] text-foreground/25">
                    {hora(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="px-4 pb-1 font-sans text-[11px] text-red-400">{error}</p>
      )}

      <div className="flex items-end gap-2 border-t border-gold-dim/20 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={MAX_LEN}
          placeholder="Escribe al gremio... (Enter envía)"
          aria-label="Mensaje para el gremio"
          className="max-h-28 flex-1 resize-none rounded-lg border border-border bg-input px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || draft.trim().length === 0}
          aria-label="Enviar mensaje"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/15 text-gold transition-colors hover:bg-gold/25 disabled:opacity-40"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
