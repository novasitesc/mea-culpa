// GET / POST — Consumibles disponibles del personaje dentro de la partida
// (pociones, raciones…). Usarlos es la ruta /usar-consumible.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

type BagRow = {
  id: number;
  objeto_id: number | null;
  cantidad: number;
  orden: number;
  publicado_en_trade: boolean;
  objetos: {
    nombre: string;
    icono: string;
    descripcion: string;
    rareza: string;
    tipo_item: string;
  } | null;
};

async function getParticipante(
  db: ReturnType<typeof createServerClient>,
  partidaId: string,
  userId: string,
) {
  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return { error: "La partida no está en progreso", status: 403 as const };
  }

  const { data: participante } = await db
    .from("partida_participantes")
    .select("id, personaje_id, muerto, personaje:personaje_id(nombre)")
    .eq("partida_id", partidaId)
    .eq("usuario_id", userId)
    .maybeSingle();

  if (!participante) {
    return { error: "No eres participante de esta partida", status: 403 as const };
  }

  if ((participante as any).muerto) {
    return { error: "Tu personaje está muerto", status: 403 as const };
  }

  return {
    personajeId: (participante as any).personaje_id as number,
    personajeNombre: ((participante as any).personaje?.nombre ?? "Personaje") as string,
  };
}

async function loadConsumibles(
  db: ReturnType<typeof createServerClient>,
  personajeId: number,
) {
  const { data: rows, error } = await db
    .from("bolsa_objetos")
    .select(
      "id, objeto_id, cantidad, orden, publicado_en_trade, objetos:objeto_id(nombre, icono, descripcion, rareza, tipo_item)",
    )
    .eq("personaje_id", personajeId)
    .order("orden", { ascending: true });

  if (error) return { error: error.message };

  const consumibles = ((rows ?? []) as unknown as BagRow[]).filter(
    (r) => r.objetos?.tipo_item === "consumible" && !r.publicado_en_trade,
  );

  return { consumibles };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const acceso = await getParticipante(db, partidaId, String(user.id));
  if ("error" in acceso) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }

  const result = await loadConsumibles(db, acceso.personajeId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    personajeId: acceso.personajeId,
    personajeNombre: acceso.personajeNombre,
    consumibles: result.consumibles.map((r) => ({
      bagRowId: r.id,
      objetoId: r.objeto_id,
      nombre: r.objetos?.nombre ?? "Objeto desconocido",
      icono: r.objetos?.icono ?? "🧪",
      descripcion: r.objetos?.descripcion ?? "",
      rareza: r.objetos?.rareza ?? "común",
      cantidad: r.cantidad ?? 1,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const acceso = await getParticipante(db, partidaId, String(user.id));
  if ("error" in acceso) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }

  const body = await request.json().catch(() => null);
  const bagRowId = Number(body?.bagRowId);
  if (!Number.isFinite(bagRowId) || bagRowId <= 0) {
    return NextResponse.json({ error: "bagRowId inválido" }, { status: 400 });
  }

  const { data: row, error: rowError } = await db
    .from("bolsa_objetos")
    .select(
      "id, objeto_id, cantidad, publicado_en_trade, objetos:objeto_id(nombre, icono, tipo_item)",
    )
    .eq("id", bagRowId)
    .eq("personaje_id", acceso.personajeId)
    .maybeSingle();

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Objeto no encontrado en tu bolsa" }, { status: 404 });
  }

  const objeto = (row as any).objetos as { nombre?: string; icono?: string; tipo_item?: string } | null;

  if (objeto?.tipo_item !== "consumible") {
    return NextResponse.json({ error: "Este objeto no es un consumible" }, { status: 400 });
  }

  if ((row as any).publicado_en_trade) {
    return NextResponse.json(
      { error: "No puedes usar este objeto mientras esté publicado en comercio" },
      { status: 409 },
    );
  }

  const cantidadActual = Number((row as any).cantidad ?? 1);
  const restante = Math.max(0, cantidadActual - 1);

  // El filtro por cantidad actual hace la operación atómica: si otra petición
  // simultánea ya consumió una unidad, esta no afecta filas y se rechaza.
  if (restante === 0) {
    const { data: deleted, error: deleteError } = await db
      .from("bolsa_objetos")
      .delete()
      .eq("id", bagRowId)
      .eq("personaje_id", acceso.personajeId)
      .eq("cantidad", cantidadActual)
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: "El objeto ya fue usado" },
        { status: 409 },
      );
    }
  } else {
    const { data: updated, error: updateError } = await db
      .from("bolsa_objetos")
      .update({ cantidad: restante })
      .eq("id", bagRowId)
      .eq("personaje_id", acceso.personajeId)
      .eq("cantidad", cantidadActual)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "El objeto ya fue usado" },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    personajeId: acceso.personajeId,
    personajeNombre: acceso.personajeNombre,
    objeto: {
      id: (row as any).objeto_id as number,
      nombre: objeto?.nombre ?? "Objeto desconocido",
      icono: objeto?.icono ?? "🧪",
    },
    restante,
  });
}
