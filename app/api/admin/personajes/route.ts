import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

// GET /api/admin/personajes
// Lista personajes con nombre del usuario para selección en panel admin.
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { data, error } = await db
    .from("personajes")
    .select("id, nombre, numero_slot, usuario_id, perfiles:usuario_id ( nombre )")
    .order("usuario_id", { ascending: true })
    .order("numero_slot", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.nombre,
      slot: p.numero_slot,
      userId: p.usuario_id,
      userName: p.perfiles?.nombre ?? "Usuario",
    })),
  );
}
