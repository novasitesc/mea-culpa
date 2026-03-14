import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const offset = (page - 1) * limit;

  // Filters
  const fConcept = searchParams.get("concepto");
  const fDelta = searchParams.get("delta"); // "positive", "negative", or null
  const fUser = searchParams.get("usuario");
  const fAdmin = searchParams.get("admin");
  const fDateFrom = searchParams.get("dateFrom");
  const fDateTo = searchParams.get("dateTo");

  // Definir la query base
  let query = session.db
    .from("transacciones_oro")
    .select(`
      id,
      usuario_id,
      delta,
      balance_after,
      concepto,
      creado_en,
      perfil:usuario_id!inner ( nombre ),
      admin:admin_id ( nombre )
    `, { count: "exact" });

  if (fConcept) {
    query = query.ilike("concepto", `%${fConcept}%`);
  }

  if (fDelta === "positive") {
    query = query.gt("delta", 0);
  } else if (fDelta === "negative") {
    query = query.lt("delta", 0);
  }

  if (fUser) {
    // Si queremos filtrar por nombre de usuario, necesitamos que el join de perfiles sea con !inner para que la condición WHERE aplique correctamente a las filas principales.
    query = query.ilike("perfil.nombre", `%${fUser}%`);
  }

  if (fAdmin) {
    // En el caso de admin usamos admin_id en lugar de !inner, pero como puede ser nulo o sistema, podemos hacer otra estratagema.
    if (fAdmin.toLowerCase() === "sistema") {
      query = query.is("admin_id", null);
    } else {
      query = query.not("admin_id", "is", null);
      // As no tenemos !inner fácilmente condicional en supabase params, una forma común es filtrar en js después o tratar de usar eq.
      // Filtering deep on a left join without inner is tricky in posgrest sometimes via url params.
      // A quick way for text match on a relation in Supabase is via inner join, but since admin_id can be null, forcing an inner join removes "sistema" transactions.
    }
  }

  if (fDateFrom) {
    query = query.gte("creado_en", new Date(fDateFrom).toISOString());
  }

  if (fDateTo) {
    const end = new Date(fDateTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte("creado_en", end.toISOString());
  }

  const { data, error, count } = await query
    .order("creado_en", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let transactions = (data || []).map((t: any) => ({
    id: t.id,
    usuario_id: t.usuario_id,
    nombre_usuario: t.perfil?.nombre || "Desconocido",
    nombre_admin: t.admin?.nombre || null,
    delta: t.delta,
    balance_after: t.balance_after,
    concepto: t.concepto,
    creado_en: t.creado_en,
  }));

  // Filtering admin by text if necessary (post-process if it wasn't exact "sistema"):
  if (fAdmin && fAdmin.toLowerCase() !== "sistema") {
    const term = fAdmin.toLowerCase();
    transactions = transactions.filter(t => t.nombre_admin?.toLowerCase().includes(term));
  }

  return NextResponse.json({
    data: transactions,
    count: count || 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0
  });
}
