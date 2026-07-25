// Demostración de idempotencia y atomicidad de dados_ejecutar_tirada.
// Requiere la migración 052 aplicada. Ejecutar: npx tsx lib/dice/idempotencia.demo.ts
// No altera saldos ni bolsas: usa efectos vacíos y un cobro imposible; borra su propia fila.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createServerClient } from "../supabaseServer";

async function main() {
  const db = createServerClient();

  const { data: perfil } = await db.from("perfiles").select("id").limit(1).maybeSingle();
  assert.ok(perfil, "No hay perfiles para la demo");
  const usuarioId = (perfil as { id: string }).id;

  const rollId = randomUUID();
  const params = {
    p_roll_id: rollId,
    p_contexto: "personal",
    p_usuario_id: usuarioId,
    p_personaje_id: null,
    p_recompensa_id: 0,
    p_cantidad: 1,
    p_costo_total: 0,
    p_efectos: [],
    p_resultado: { resultados: [1], tipoResultado: "nada" },
    p_logs: [],
  };

  // 1. Misma tirada dos veces → la segunda es replay, sin re-aplicar nada.
  const { data: primera, error: e1 } = await db.rpc("dados_ejecutar_tirada", params);
  assert.equal(e1, null, `Primera llamada falló: ${e1?.message}`);
  assert.equal((primera as any).replayed, false);

  const { data: segunda, error: e2 } = await db.rpc("dados_ejecutar_tirada", params);
  assert.equal(e2, null, `Replay falló: ${e2?.message}`);
  assert.equal((segunda as any).replayed, true, "El mismo roll_id debe devolver replay");
  assert.deepEqual((segunda as any).resultado, (primera as any).resultado);

  await db.from("dados_tiradas").delete().eq("roll_id", rollId);
  console.log("✓ Idempotencia: reenviar el mismo roll_id devuelve el resultado persistido");

  // 2. Cobro imposible → aborta TODO: ni cobro ni reclamación quedan en la BD.
  const rollId2 = randomUUID();
  const { error: e3 } = await db.rpc("dados_ejecutar_tirada", {
    ...params,
    p_roll_id: rollId2,
    p_costo_total: 2_000_000_000,
  });
  assert.ok(e3?.message.includes("Oro insuficiente"), "Debe fallar por oro insuficiente");

  const { data: huerfana } = await db.from("dados_tiradas").select("roll_id").eq("roll_id", rollId2);
  assert.equal(huerfana?.length ?? 0, 0, "Un fallo a mitad no debe dejar rastro (rollback total)");
  console.log("✓ Atomicidad: el fallo de cobro revierte la transacción completa, sin fila huérfana");
}

main().then(() => console.log("idempotencia.demo.ts: OK"));
