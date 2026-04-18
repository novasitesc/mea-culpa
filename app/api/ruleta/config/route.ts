import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getCostCycle, getNextSpinCost, getRouletteSlots } from "@/lib/roulette";

export async function GET(request: Request) {
  const db = createServerClient();

  const { data: config, error: configError } = await db
    .from("ruleta_configuracion")
    .select("habilitada")
    .eq("id", 1)
    .single();

  if (configError && configError.code !== "PGRST116") {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  const enabled = config?.habilitada ?? true;
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return NextResponse.json({
      enabled,
      costCycle: getCostCycle(),
      slots: getRouletteSlots(),
      playerState: null,
    });
  }

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({
      enabled,
      costCycle: getCostCycle(),
      slots: getRouletteSlots(),
      playerState: null,
    });
  }

  const { count, error: countError } = await db
    .from("ruleta_tiradas")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data: lastSpin, error: lastSpinError } = await db
    .from("ruleta_tiradas")
    .select(
      "id, slot, categoria, premio_label, costo_tipo, costo_monto, ciclo_numero, cobro_pendiente, oro_resultante, creado_en",
    )
    .eq("usuario_id", user.id)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSpinError) {
    return NextResponse.json({ error: lastSpinError.message }, { status: 500 });
  }

  const spinCount = count ?? 0;

  return NextResponse.json({
    enabled,
    costCycle: getCostCycle(),
    slots: getRouletteSlots(),
    playerState: {
      spinCount,
      nextCost: getNextSpinCost(spinCount),
      lastSpin,
    },
  });
}
