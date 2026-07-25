// Impuesto global del admin: cobra la misma cantidad de oro a TODAS las cuentas
// de golpe, y quien no puede pagar entero pierde un personaje.
//
// Regla completa:
//   1. Se cobra `amount` a cada usuario. Si no tiene tanto, se le vacía el oro
//      (cobro parcial) y queda una deuda (`shortfall`).
//   2. Con deuda > 0, muere su personaje vivo de MAYOR nivel total (suma de los
//      niveles de sus clases). Si empatan varios, se elige uno al azar.
//   3. Si no le queda ningún personaje vivo, solo se le vacía el oro.
//
// Se ejecuta en dos pasos deliberadamente: `previewMassTax` enseña al admin
// exactamente qué va a pasar (quién muere, cuánto se cobra) SIN tocar nada, y
// `executeMassTax` lo aplica. Ambos comparten el mismo cálculo (`runMassTax`)
// para que la vista previa no pueda mentir respecto a la ejecución real.
import type { SupabaseClient } from "@supabase/supabase-js";

const TAX_CONCEPT_FULL = "impuesto_admin_global";
const TAX_CONCEPT_PARTIAL = "impuesto_admin_global_parcial";
const TAX_DEATH_REASON = "impuesto_impago";

type ProfileRow = {
  id: string;
  nombre: string;
  oro: number | null;
};

type AliveCharacterRow = {
  id: number;
  usuario_id: string;
  nombre: string;
  clases_personaje: Array<{ nivel: number | null }> | null;
};

type CharacterCandidate = {
  id: number;
  name: string;
  totalLevel: number;
};

export type TaxCollectionStatus =
  | "cobrado_total"
  | "cobrado_parcial_y_muerto"
  | "cobrado_parcial_sin_personaje_vivo"
  | "error";

export type AdminTaxResultRow = {
  userId: string;
  userName: string;
  goldBefore: number;
  requestedAmount: number;
  chargedAmount: number;
  goldAfter: number;
  shortfall: number;
  status: TaxCollectionStatus;
  willDie: boolean;
  deathApplied: boolean;
  targetCharacterId: number | null;
  targetCharacterName: string | null;
  targetCharacterTotalLevel: number | null;
  tieCandidates: number;
  errorMessage: string | null;
};

export type AdminTaxSummary = {
  totalAccounts: number;
  totalRequested: number;
  totalCharged: number;
  totalShortfall: number;
  fullPaidCount: number;
  partialWithDeathCount: number;
  partialWithoutLivingCharacterCount: number;
  errorCount: number;
  deathsProjectedCount: number;
  deathsAppliedCount: number;
};

export type AdminTaxResult = {
  amount: number;
  mode: "preview" | "apply";
  summary: AdminTaxSummary;
  rows: AdminTaxResultRow[];
};

/** Nivel total del personaje = suma de los niveles de sus clases (hasta 3). */
function calculateTotalLevel(clases: AliveCharacterRow["clases_personaje"]): number {
  if (!Array.isArray(clases) || clases.length === 0) {
    return 0;
  }

  return clases.reduce((sum, entry) => {
    const level = Number(entry?.nivel ?? 0);
    return sum + (Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0);
  }, 0);
}

/** Totales agregados de la tabla de resultados, para la cabecera del panel. */
function buildSummary(amount: number, rows: AdminTaxResultRow[]): AdminTaxSummary {
  const summary: AdminTaxSummary = {
    totalAccounts: rows.length,
    totalRequested: amount * rows.length,
    totalCharged: 0,
    totalShortfall: 0,
    fullPaidCount: 0,
    partialWithDeathCount: 0,
    partialWithoutLivingCharacterCount: 0,
    errorCount: 0,
    deathsProjectedCount: 0,
    deathsAppliedCount: 0,
  };

  for (const row of rows) {
    summary.totalCharged += row.chargedAmount;
    summary.totalShortfall += row.shortfall;

    if (row.status === "cobrado_total") summary.fullPaidCount += 1;
    if (row.status === "cobrado_parcial_y_muerto") summary.partialWithDeathCount += 1;
    if (row.status === "cobrado_parcial_sin_personaje_vivo") {
      summary.partialWithoutLivingCharacterCount += 1;
    }
    if (row.status === "error") summary.errorCount += 1;
    if (row.willDie && row.targetCharacterId !== null) {
      summary.deathsProjectedCount += 1;
    }
    if (row.deathApplied) summary.deathsAppliedCount += 1;
  }

  return summary;
}

/**
 * Elige qué personaje muere por impago: el de mayor nivel total, y si hay
 * empate uno al azar entre los empatados. `tieCandidates` se devuelve para que
 * el panel avise al admin de que el resultado real puede variar respecto a la
 * vista previa (el azar se vuelve a tirar al ejecutar).
 */
function pickCandidate(characters: CharacterCandidate[]): {
  winner: CharacterCandidate | null;
  tieCandidates: number;
} {
  if (characters.length === 0) {
    return { winner: null, tieCandidates: 0 };
  }

  let maxLevel = -1;
  for (const character of characters) {
    if (character.totalLevel > maxLevel) {
      maxLevel = character.totalLevel;
    }
  }

  const tied = characters.filter((character) => character.totalLevel === maxLevel);
  const winner = tied[Math.floor(Math.random() * tied.length)] ?? null;
  return {
    winner,
    tieCandidates: tied.length,
  };
}

/**
 * Cálculo compartido por la vista previa y la ejecución.
 *
 * `apply: false` → solo simula y devuelve la tabla de lo que pasaría.
 * `apply: true`  → además ejecuta el cobro y las muertes.
 *
 * Carga perfiles y personajes vivos en 2 consultas (no una por usuario), y
 * luego recorre cuenta por cuenta. Un fallo en una cuenta se marca con
 * `status: "error"` en su fila y no aborta el resto del cobro.
 */
async function runMassTax(params: {
  db: SupabaseClient;
  amount: number;
  apply: boolean;
  adminId?: string;
}): Promise<AdminTaxResult> {
  const { db, amount, apply, adminId } = params;

  const { data: profilesData, error: profilesError } = await db
    .from("perfiles")
    .select("id, nombre, oro")
    .in("rol_sistema", ["usuario", "admin"])
    .order("creado_en", { ascending: true });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = (profilesData ?? []) as ProfileRow[];
  if (profiles.length === 0) {
    return {
      amount,
      mode: apply ? "apply" : "preview",
      rows: [],
      summary: buildSummary(amount, []),
    };
  }

  const userIds = profiles.map((profile) => profile.id);

  let aliveCharacters: AliveCharacterRow[] = [];
  if (userIds.length > 0) {
    const { data: aliveData, error: aliveError } = await db
      .from("personajes")
      .select("id, usuario_id, nombre, clases_personaje(nivel)")
      .eq("estado_vida", "vivo")
      .in("usuario_id", userIds);

    if (aliveError) {
      throw new Error(aliveError.message);
    }

    aliveCharacters = (aliveData ?? []) as AliveCharacterRow[];
  }

  const candidatesByUser = new Map<string, CharacterCandidate[]>();

  for (const character of aliveCharacters) {
    const entry: CharacterCandidate = {
      id: Number(character.id),
      name: character.nombre,
      totalLevel: calculateTotalLevel(character.clases_personaje),
    };

    const current = candidatesByUser.get(character.usuario_id) ?? [];
    current.push(entry);
    candidatesByUser.set(character.usuario_id, current);
  }

  const rows: AdminTaxResultRow[] = [];

  for (const profile of profiles) {
    const goldBefore = Math.max(0, Math.floor(Number(profile.oro ?? 0)));
    const requestedAmount = amount;
    const userCandidates = candidatesByUser.get(profile.id) ?? [];
    const { winner, tieCandidates } = pickCandidate(userCandidates);

    let chargedAmount = goldBefore >= requestedAmount ? requestedAmount : goldBefore;
    chargedAmount = Math.max(0, chargedAmount);

    let goldAfter = goldBefore - chargedAmount;
    goldAfter = Math.max(0, goldAfter);

    const shortfall = Math.max(0, requestedAmount - chargedAmount);
    const willDie = shortfall > 0;

    let status: TaxCollectionStatus = "cobrado_total";
    if (willDie) {
      status = winner
        ? "cobrado_parcial_y_muerto"
        : "cobrado_parcial_sin_personaje_vivo";
    }

    let deathApplied = false;
    let errorMessage: string | null = null;

    if (apply) {
      try {
        if (chargedAmount > 0) {
          const { data: updatedGold, error: goldError } = await db.rpc("modificar_oro", {
            p_usuario_id: profile.id,
            p_delta: -chargedAmount,
            p_concepto: chargedAmount === requestedAmount ? TAX_CONCEPT_FULL : TAX_CONCEPT_PARTIAL,
            p_referencia: null,
            p_admin_id: adminId ?? null,
          });

          if (goldError) {
            throw new Error(goldError.message);
          }

          if (typeof updatedGold === "number" && Number.isFinite(updatedGold)) {
            goldAfter = Math.max(0, Math.floor(updatedGold));
          }
        }

        if (willDie && winner) {
          const { error: deadError } = await db.rpc("marcar_personaje_muerto", {
            p_personaje_id: winner.id,
            p_usuario_id: profile.id,
            p_motivo: TAX_DEATH_REASON,
            p_partida_id: null,
            p_metadata: {
              source: "admin-tax",
              requestedAmount,
              chargedAmount,
              goldBefore,
              goldAfter,
              tieCandidates,
              adminId: adminId ?? null,
            },
          });

          if (deadError) {
            throw new Error(deadError.message);
          }

          deathApplied = true;
        }
      } catch (error) {
        status = "error";
        errorMessage = error instanceof Error ? error.message : "Error desconocido";
      }
    }

    rows.push({
      userId: profile.id,
      userName: profile.nombre,
      goldBefore,
      requestedAmount,
      chargedAmount,
      goldAfter,
      shortfall,
      status,
      willDie,
      deathApplied,
      targetCharacterId: winner?.id ?? null,
      targetCharacterName: winner?.name ?? null,
      targetCharacterTotalLevel: winner?.totalLevel ?? null,
      tieCandidates,
      errorMessage,
    });
  }

  return {
    amount,
    mode: apply ? "apply" : "preview",
    summary: buildSummary(amount, rows),
    rows,
  };
}

/** Simulacro: enseña el resultado del impuesto sin tocar la base de datos. */
export async function previewMassTax(params: {
  db: SupabaseClient;
  amount: number;
}): Promise<AdminTaxResult> {
  return runMassTax({ db: params.db, amount: params.amount, apply: false });
}

/** Aplica el impuesto de verdad: descuenta oro y mata a los morosos. */
export async function executeMassTax(params: {
  db: SupabaseClient;
  amount: number;
  adminId: string;
}): Promise<AdminTaxResult> {
  return runMassTax({
    db: params.db,
    amount: params.amount,
    apply: true,
    adminId: params.adminId,
  });
}
