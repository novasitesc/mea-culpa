import { createServerClient } from "@/lib/supabaseServer";

/**
 * Modifica el oro de un usuario desde el servidor (service_role).
 * Registra automáticamente la transacción en `transacciones_oro`.
 *
 * Usar esta función dentro de otros API routes (tiendas, misiones, etc.)
 * en lugar de llamar al endpoint HTTP /api/profile/update-oro.
 *
 * @param userId       - UUID del usuario en `perfiles`
 * @param delta        - Cambio de oro (positivo = ganar, negativo = gastar)
 * @param concepto     - Motivo: 'compra_tienda', 'recompensa_mision', 'admin', etc.
 * @param referenciaId - UUID opcional de la entidad asociada (item, misión…)
 * @returns El nuevo saldo de oro del usuario
 * @throws Error si el oro quedaría negativo o el usuario no existe
 */
export async function modifyGold(
  userId: string,
  delta: number,
  concepto: string = "sistema",
  referenciaId?: string,
): Promise<number> {
  if (!Number.isInteger(delta)) {
    throw new Error("delta debe ser un entero");
  }

  const db = createServerClient();

  const { data, error } = await db.rpc("modificar_oro", {
    p_usuario_id: userId,
    p_delta: delta,
    p_concepto: concepto,
    p_referencia: referenciaId ?? null,
  });

  if (error) {
    throw new Error(
      error.message?.includes("Oro insuficiente")
        ? "Oro insuficiente"
        : error.message,
    );
  }

  return data as number;
}
