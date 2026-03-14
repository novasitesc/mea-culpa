import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  // Obtener transacciones con la info del usuario y del admin
  const { data, error } = await session.db
    .from("transacciones_oro")
    .select(`
      id,
      usuario_id,
      delta,
      balance_after,
      concepto,
      creado_en,
      perfil:usuario_id ( nombre ),
      admin:admin_id ( nombre )
    `)
    .order("creado_en", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transactions = (data || []).map((t: any) => ({
    id: t.id,
    usuario_id: t.usuario_id,
    nombre_usuario: t.perfil?.nombre || "Desconocido",
    nombre_admin: t.admin?.nombre || null,
    delta: t.delta,
    balance_after: t.balance_after,
    concepto: t.concepto,
    creado_en: t.creado_en,
  }));

  return NextResponse.json(transactions);
}
