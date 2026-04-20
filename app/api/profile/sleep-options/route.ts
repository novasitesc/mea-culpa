import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { SLEEP_OPTIONS } from "@/lib/sleepOptions";
import { markCharacterDead } from "@/lib/characterLife";

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  const db = createServerClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}

async function markCharacterAsDead(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  characterId: number,
  reason: string,
  partidaId: string | null,
) {
  const deadResult = await markCharacterDead({
    db,
    userId,
    characterId,
    reason,
    partidaId,
    metadata: { source: "sleep-options" },
  });

  if (!deadResult.ok) {
    throw new Error(deadResult.error ?? "No se pudo marcar al personaje como muerto");
  }

  const { error: removePendingError } = await db
    .from("descansos_pendientes")
    .delete()
    .eq("personaje_id", characterId)
    .eq("usuario_id", userId);

  if (removePendingError) {
    throw new Error(removePendingError.message);
  }
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServerClient();

  const [{ data: profile, error: profileError }, { data: pendingRows, error: pendingError }] =
    await Promise.all([
      db.from("perfiles").select("oro").eq("id", userId).single(),
      db
        .from("descansos_pendientes")
        .select(
          `
            id,
            personaje_id,
            partida_id,
            creado_en,
            personaje:personaje_id ( nombre ),
            partida:partida_id ( titulo, finalizada_en )
          `,
        )
        .eq("usuario_id", userId)
        .order("creado_en", { ascending: true }),
    ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  return NextResponse.json({
    playerGold: Number((profile as any)?.oro ?? 0),
    options: SLEEP_OPTIONS,
    pendingCharacters: (pendingRows ?? []).map((row: any) => ({
      pendingId: String(row.id),
      characterId: Number(row.personaje_id),
      characterName: row.personaje?.nombre ?? "Sin nombre",
      partidaId: row.partida_id ?? null,
      partidaTitle: row.partida?.titulo ?? "Partida finalizada",
      requiredAt: row.creado_en ?? null,
      partidaFinalizedAt: row.partida?.finalizada_en ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServerClient();

  let body: { pendingId?: unknown; optionId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const pendingId = String(body.pendingId ?? "").trim();
  const action = String(body.action ?? "pay").trim().toLowerCase();
  const optionId = String(body.optionId ?? "").trim();

  if (!pendingId) {
    return NextResponse.json({ error: "pendingId es requerido" }, { status: 400 });
  }

  const { data: pendingRow, error: pendingError } = await db
    .from("descansos_pendientes")
    .select("id, usuario_id, personaje_id, partida_id, personaje:personaje_id ( nombre )")
    .eq("id", pendingId)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  if (!pendingRow || String((pendingRow as any).usuario_id) !== userId) {
    return NextResponse.json({ error: "Descanso pendiente no encontrado" }, { status: 404 });
  }

  const characterId = Number((pendingRow as any).personaje_id);
  const characterName = String((pendingRow as any).personaje?.nombre ?? "El personaje");
  const partidaId = ((pendingRow as any).partida_id as string | null) ?? null;

  if (action === "decline") {
    try {
      await markCharacterAsDead(
        db,
        userId,
        characterId,
        "descanso_rechazado",
        partidaId,
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se pudo marcar muerto el personaje" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      eliminated: false,
      dead: true,
      message: `${characterName} ha muerto. Puedes revivirlo desde el perfil.`,
    });
  }

  const selectedOption = SLEEP_OPTIONS.find((option) => option.id === optionId);
  if (!selectedOption) {
    return NextResponse.json({ error: "Debes seleccionar una opcion valida" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await db
    .from("perfiles")
    .select("oro")
    .eq("id", userId)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const currentGold = Number((profile as any)?.oro ?? 0);
  if (currentGold < selectedOption.cost) {
    try {
      await markCharacterAsDead(
        db,
        userId,
        characterId,
        "sin_oro_descanso",
        partidaId,
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se pudo marcar muerto el personaje" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        eliminated: false,
        dead: true,
        message: `${characterName} no tenía oro suficiente y ha muerto. Puedes revivirlo desde el perfil.`,
      },
    );
  }

  const { data: newGold, error: paymentError } = await db.rpc("modificar_oro", {
    p_usuario_id: userId,
    p_delta: -selectedOption.cost,
    p_concepto: "descanso_post_partida",
    p_referencia: partidaId,
    p_admin_id: null,
  });

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  const [{ error: removePendingError }, { error: homeError }] = await Promise.all([
    db.from("descansos_pendientes").delete().eq("id", pendingId),
    db.from("perfiles").update({ hogar: selectedOption.homeLabel }).eq("id", userId),
  ]);

  if (removePendingError) {
    return NextResponse.json({ error: removePendingError.message }, { status: 500 });
  }

  if (homeError) {
    return NextResponse.json({ error: homeError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    eliminated: false,
    newGold: Number(newGold ?? currentGold - selectedOption.cost),
    message: `${characterName} descanso en ${selectedOption.name} por ${selectedOption.cost} de oro.`,
  });
}
