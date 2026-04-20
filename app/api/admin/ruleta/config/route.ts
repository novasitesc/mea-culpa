import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;

  const { data, error } = await session.db
    .from("ruleta_configuracion")
    .select("id, habilitada, actualizado_en, actualizado_por")
    .eq("id", 1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    habilitada: data?.habilitada ?? true,
    actualizadoEn: data?.actualizado_en ?? null,
    actualizadoPor: data?.actualizado_por ?? null,
  });
}

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;

  if (session.rolSistema !== "super_admin") {
    return NextResponse.json(
      { error: "Solo super_admin puede activar o desactivar la ruleta" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { habilitada } = body;

  if (typeof habilitada !== "boolean") {
    return NextResponse.json(
      { error: "habilitada debe ser boolean" },
      { status: 400 },
    );
  }

  const payload = {
    id: 1,
    habilitada,
    actualizado_por: session.userId,
    actualizado_en: new Date().toISOString(),
  };

  const { error } = await session.db
    .from("ruleta_configuracion")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    habilitada,
  });
}
