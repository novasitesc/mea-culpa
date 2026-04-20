import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "200", 10) || 200),
  );

  const { data, error } = await db
    .from("personajes")
    .select(
      "id, nombre, numero_slot, usuario_id, estado_vida, muerto_en, revivido_en, perfiles:usuario_id ( nombre )",
    )
    .eq("estado_vida", "muerto")
    .order("muerto_en", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: any) => ({
    id: Number(row.id),
    name: String(row.nombre ?? "Personaje"),
    slot: Number(row.numero_slot ?? 0),
    userId: String(row.usuario_id),
    userName: String(row.perfiles?.nombre ?? "Usuario"),
    lifeStatus: String(row.estado_vida ?? "muerto"),
    deadAt: row.muerto_en ?? null,
    revivedAt: row.revivido_en ?? null,
  }));

  return NextResponse.json({
    data: rows,
    count: rows.length,
    limit,
  });
}
