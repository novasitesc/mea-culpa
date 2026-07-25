// Sistema RTS — inventario de ejército.
// Los regimientos se compran en la tienda como cualquier objeto, pero viven
// fuera de la mochila: 5 casillas propias por personaje para que el equipo y
// las tropas no se mezclen y el DM pueda matar unidades sin tocar la bolsa.
// El esquema está en supabase/migrations/056_ejercito_rts.sql.

/** Tipo de objeto que sólo puede guardarse en el inventario de ejército. */
export const TIPO_EJERCITO = "ejército";

/** Casillas de ejército por personaje. Debe cuadrar con el CHECK de `orden`. */
export const EJERCITO_SLOTS = 5;

/** Regimientos que caben apilados en una casilla. */
export const EJERCITO_STACK_MAX = 100;

/** Una casilla ocupada del inventario de ejército. */
export type UnidadEjercito = {
  /** id de la fila en `ejercito_objetos`. */
  id: number;
  objetoId: number;
  nombre: string;
  icono: string;
  descripcion: string | null;
  rareza: string;
  precio: number;
  /** Regimientos apilados en la casilla (1-100). */
  cantidad: number;
  orden: number;
  /** Soldados que forma un regimiento; null si el DM no lo definió. */
  soldados: number | null;
  clase_armadura: number | null;
  dano: string | null;
};

/** Soldados totales de una casilla: soldados por regimiento × regimientos. */
export function totalSoldados(u: Pick<UnidadEjercito, "soldados" | "cantidad">): number {
  return (u.soldados ?? 0) * u.cantidad;
}

/** Suma de soldados de todo el ejército de un personaje. */
export function totalTropas(unidades: UnidadEjercito[]): number {
  return unidades.reduce((acc, u) => acc + totalSoldados(u), 0);
}

/**
 * Bajas que el DM aplica a una casilla.
 *
 * `bajas` se acota a lo que queda en pie (no se puede matar más de lo que hay)
 * y `aniquilar` barre el regimiento entero de un golpe. Cuando `restante` cae
 * a 0 la casilla se libera.
 */
export function aplicarBajas(
  cantidad: number,
  bajas: number,
  aniquilar: boolean,
): { caidas: number; restante: number } {
  const enPie = Math.max(0, Math.floor(cantidad));
  const caidas = aniquilar ? enPie : Math.min(Math.max(0, Math.floor(bajas)), enPie);
  return { caidas, restante: enPie - caidas };
}

/** Mapea una fila de `ejercito_objetos` con su join a `objetos`. */
export function mapUnidadRow(row: any): UnidadEjercito {
  return {
    id: Number(row.id),
    objetoId: Number(row.objeto_id),
    nombre: row.objetos?.nombre ?? "Unidad desconocida",
    icono: row.objetos?.icono ?? "⚔️",
    descripcion: row.objetos?.descripcion ?? null,
    rareza: row.objetos?.rareza ?? "común",
    precio: Number(row.objetos?.precio ?? 0),
    cantidad: Number(row.cantidad ?? 1),
    orden: Number(row.orden ?? 0),
    soldados: row.objetos?.soldados ?? null,
    clase_armadura: row.objetos?.clase_armadura ?? null,
    dano: row.objetos?.dano ?? null,
  };
}

/** Columnas a pedir en el join con `objetos` al leer el ejército. */
export const EJERCITO_SELECT =
  "id, objeto_id, cantidad, orden, objetos:objeto_id ( nombre, icono, descripcion, rareza, precio, soldados, clase_armadura, dano )";
