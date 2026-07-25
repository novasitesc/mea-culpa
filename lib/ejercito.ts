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
  /** Soldados ya muertos en esta casilla (migración 058). */
  soldadosCaidos: number;
  clase_armadura: number | null;
  dano: string | null;
};

type UnidadContable = Pick<UnidadEjercito, "soldados" | "cantidad"> &
  Partial<Pick<UnidadEjercito, "soldadosCaidos">>;

/**
 * Soldados que la casilla llegó a tener: soldados por regimiento × regimientos.
 * Es el techo, no la tropa viva — para eso está `totalSoldados`.
 */
export function capacidadSoldados(u: UnidadContable): number {
  return (u.soldados ?? 0) * u.cantidad;
}

/** Soldados en pie de una casilla: la capacidad menos los que han caído. */
export function totalSoldados(u: UnidadContable): number {
  return Math.max(0, capacidadSoldados(u) - Math.max(0, u.soldadosCaidos ?? 0));
}

/**
 * Regimientos que aún tienen a alguien de pie. Un regimiento a medias sigue
 * contando como regimiento: 35 de 60 ogros son 2 regimientos en juego.
 */
export function regimientosEnPie(u: UnidadContable): number {
  const porRegimiento = u.soldados ?? 0;
  if (porRegimiento <= 0) return u.cantidad;
  return Math.ceil(totalSoldados(u) / porRegimiento);
}

/** Suma de soldados en pie de todo el ejército de un personaje. */
export function totalTropas(unidades: UnidadContable[]): number {
  return unidades.reduce((acc, u) => acc + totalSoldados(u), 0);
}

/**
 * Bajas que el DM aplica a una casilla, **contadas en soldados**.
 *
 * Antes se contaban en regimientos y no había manera de bajar un regimiento de
 * a pocos: restar 1 a los ogros se llevaba a los 20. Ahora `vivos` y `bajas`
 * son soldados; `aniquilar` barre la casilla completa de un golpe. Cuando
 * `restante` cae a 0 la casilla se libera.
 */
export function aplicarBajas(
  vivos: number,
  bajas: number,
  aniquilar: boolean,
): { caidas: number; restante: number } {
  const enPie = Math.max(0, Math.floor(vivos));
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
    soldadosCaidos: Number(row.soldados_caidos ?? 0),
    clase_armadura: row.objetos?.clase_armadura ?? null,
    dano: row.objetos?.dano ?? null,
  };
}

/** Columnas a pedir en el join con `objetos` al leer el ejército. */
export const EJERCITO_SELECT =
  "id, objeto_id, cantidad, orden, soldados_caidos, objetos:objeto_id ( nombre, icono, descripcion, rareza, precio, soldados, clase_armadura, dano )";
