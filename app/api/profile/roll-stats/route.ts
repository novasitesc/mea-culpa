// POST — Tira 4d6 (descartando el dado más bajo) seis veces para un personaje
// nuevo, y devuelve los valores junto a un token firmado.
//
// La tirada se hace EN EL SERVIDOR y es determinista por (usuario, día, nº de
// personajes): repetir la petición devuelve los mismos dados, así que no se
// puede insistir hasta sacar valores altos. El token viaja de vuelta al crear el
// personaje y demuestra que esos seis valores son los que el servidor tiró.
// Detalles en lib/statRollToken.ts.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createRollToken, rollAbilityScores } from "@/lib/statRollToken";

// Tira 6 × (4d6 descartando el más bajo) en el servidor y devuelve un token
// firmado que create-character exige para aceptar stats con método "roll".
export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { count } = await db
      .from("personajes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .not("estado_vida", "in", '("enterrado","eliminado")');

    const rolls = rollAbilityScores(user.id, count ?? 0);
    const { token, expiresAt } = createRollToken(
      user.id,
      rolls.map((r) => r.total),
    );

    return NextResponse.json({ rolls, token, expiresAt });
  } catch (error) {
    console.error("Error rolling ability scores:", error);
    return NextResponse.json(
      { error: "No se pudieron lanzar los dados" },
      { status: 500 },
    );
  }
}
