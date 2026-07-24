// POST — PÚBLICA (no pide sesión). Recoge los reportes del widget de feedback.
// Al ser abierta, valida con cuidado lo que entra antes de guardarlo.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import type { FeedbackType } from "@/lib/types/feedback";

const VALID_TYPES: FeedbackType[] = ["bug", "suggestion", "comment"];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { type, title, description, page_url, user_agent } = body as {
      type: unknown;
      title: unknown;
      description: unknown;
      page_url: unknown;
      user_agent: unknown;
    };

    // ─── Validation ───────────────────────────────────────────────
    if (
      typeof type !== "string" ||
      !VALID_TYPES.includes(type as FeedbackType)
    ) {
      return NextResponse.json(
        { error: "Tipo inválido. Debe ser: bug, suggestion o comment." },
        { status: 400 },
      );
    }

    if (typeof title !== "string" || !title.trim() || title.length > 100) {
      return NextResponse.json(
        { error: "El título es obligatorio y debe tener máximo 100 caracteres." },
        { status: 400 },
      );
    }

    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.length > 1000
    ) {
      return NextResponse.json(
        { error: "La descripción es obligatoria y debe tener máximo 1000 caracteres." },
        { status: 400 },
      );
    }

    // ─── Insert ───────────────────────────────────────────────────
    const supabase = createServerClient();
    const { error } = await supabase.from("feedback_reports").insert({
      type,
      title: title.trim(),
      description: description.trim(),
      // Acotar longitud para evitar abuso de almacenamiento con payloads enormes.
      page_url: typeof page_url === "string" ? page_url.slice(0, 500) : null,
      user_agent: typeof user_agent === "string" ? user_agent.slice(0, 500) : null,
    });

    if (error) {
      console.error("[feedback] Supabase insert error:", error);
      return NextResponse.json(
        { error: "No se pudo guardar el reporte." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
