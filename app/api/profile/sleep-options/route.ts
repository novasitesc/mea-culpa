import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { SLEEP_OPTIONS } from "@/lib/sleepOptions";
import { MAX_CANSANCIO } from "@/lib/caidas";
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

// Suma 1 nivel de agotamiento (tope 6). Al 6.º nivel el personaje muere
// de agotamiento, como dicta D&D 5e 2014.
async function addFatigue(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  characterId: number,
  partidaId: string | null,
): Promise<{ newCansancio: number; died: boolean }> {
  const { data: char, error: fetchError } = await db
    .from("personajes")
    .select("puntos_cansancio")
    .eq("id", characterId)
    .eq("usuario_id", userId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const current = Number((char as any)?.puntos_cansancio ?? 0);
  const newCansancio = Math.min(MAX_CANSANCIO, current + 1);
  const died = newCansancio >= MAX_CANSANCIO;

  const { error: updateError } = await db
    .from("personajes")
    .update({ puntos_cansancio: newCansancio })
    .eq("id", characterId)
    .eq("usuario_id", userId);

  if (updateError) throw new Error(updateError.message);

  if (died) {
    const result = await markCharacterDead({
      db,
      userId,
      characterId,
      reason: "agotamiento_extremo",
      partidaId,
      metadata: { puntosCansancio: newCansancio },
    });
    if (!result.ok) throw new Error(result.error ?? "No se pudo registrar la muerte");
  }

  const { error: removePendingError } = await db
    .from("descansos_pendientes")
    .delete()
    .eq("personaje_id", characterId)
    .eq("usuario_id", userId);

  if (removePendingError) throw new Error(removePendingError.message);

  return { newCansancio, died };
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
            personaje:personaje_id ( nombre, caidas, puntos_cansancio ),
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
      characterCaidas: Number(row.personaje?.caidas ?? 0),
      characterCansancio: Number(row.personaje?.puntos_cansancio ?? 0),
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
    .select("id, usuario_id, personaje_id, partida_id, personaje:personaje_id ( nombre, puntos_cansancio )")
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
    let fatigue: { newCansancio: number; died: boolean };
    try {
      fatigue = await addFatigue(db, userId, characterId, partidaId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se pudo registrar el cansancio" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      eliminated: false,
      dead: fatigue.died,
      message: fatigue.died
        ? `${characterName} alcanza ${MAX_CANSANCIO} niveles de agotamiento y muere de cansancio extremo.`
        : `${characterName} acumula un punto de cansancio por no descansar (${fatigue.newCansancio}/${MAX_CANSANCIO}).`,
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
    let fatigue: { newCansancio: number; died: boolean };
    try {
      fatigue = await addFatigue(db, userId, characterId, partidaId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se pudo registrar el cansancio" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      eliminated: false,
      dead: fatigue.died,
      message: fatigue.died
        ? `${characterName} no pudo pagar el descanso, alcanza ${MAX_CANSANCIO} niveles de agotamiento y muere.`
        : `${characterName} no tenía oro suficiente para descansar y acumula un punto de cansancio (${fatigue.newCansancio}/${MAX_CANSANCIO}).`,
    });
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

  // Descanso largo: restaura las caídas acumuladas durante la expedición y,
  // como en D&D 5e 2014, reduce 1 nivel de agotamiento.
  const currentCansancio = Number((pendingRow as any).personaje?.puntos_cansancio ?? 0);
  const newCansancio = Math.max(0, currentCansancio - 1);
  const [{ error: removePendingError }, { error: homeError }, { error: caidasError }] =
    await Promise.all([
      db.from("descansos_pendientes").delete().eq("id", pendingId),
      db.from("perfiles").update({ hogar: selectedOption.homeLabel }).eq("id", userId),
      db
        .from("personajes")
        // Pagar la posada es el descanso largo posterior a la expedición:
        // además de caídas y cansancio devuelve los espacios de conjuro.
        .update({ caidas: 0, puntos_cansancio: newCansancio, conjuros_usados: [] })
        .eq("id", characterId)
        .eq("usuario_id", userId),
    ]);

  if (caidasError) {
    return NextResponse.json({ error: caidasError.message }, { status: 500 });
  }

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
    message:
      `${characterName} descanso en ${selectedOption.name} por ${selectedOption.cost} de oro.` +
      (newCansancio < currentCansancio ? ` Recupera fuerzas (cansancio ${newCansancio}/${MAX_CANSANCIO}).` : ""),
  });
}
