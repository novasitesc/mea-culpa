import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "30", 10) || 30),
  );
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  const { data, error, count } = await db
    .from("personajes_historial_vida")
    .select(
      `
        id,
        personaje_id,
        usuario_id,
        evento,
        motivo,
        muerto_en,
        revivido_en,
        creado_en,
        personaje:personaje_id ( nombre ),
        usuario:usuario_id ( nombre )
      `,
      { count: "exact" },
    )
    .order("creado_en", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id),
    characterId: Number(row.personaje_id),
    characterName: String(row.personaje?.nombre ?? "Personaje"),
    userId: String(row.usuario_id),
    userName: String(row.usuario?.nombre ?? "Usuario"),
    event: String(row.evento ?? "muerto"),
    reason: row.motivo ? String(row.motivo) : null,
    deadAt: row.muerto_en ?? null,
    revivedAt: row.revivido_en ?? null,
    createdAt: row.creado_en ?? null,
  }));

  return NextResponse.json({
    data: rows,
    count: count ?? 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0,
  });
}
