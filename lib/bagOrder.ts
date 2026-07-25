// Reordenar la bolsa sin chocar con `uq_bolsa_orden`.
//
// El UNIQUE (personaje_id, orden) es DEFERRABLE INITIALLY DEFERRED para poder
// reordenar dentro de UNA transacción, pero PostgREST manda cada UPDATE como
// petición independiente y cada una hace COMMIT: el diferido nunca entra en
// juego. Intercambiar dos objetos de sitio reventaba con 23505.
//
// La solución es aparcar en negativo las filas que se mueven antes de escribir
// el orden definitivo. `-id` sirve porque es único (los id lo son) y está fuera
// del rango del orden final, que siempre es ≥ 1.

/** Orden de aparcamiento de una fila durante la pasada intermedia. */
export const ordenAparcado = (id: number): number => -id;

/**
 * Filas que necesitan aparcar: las que ya existen y cambian de posición.
 *
 * Las que se quedan donde están no estorban: como los `orden` de destino son
 * todos distintos, nadie más apunta a la posición que ellas ocupan.
 */
export function filasQueSeMueven<T extends { id: number | null; orden: number }>(
  destino: T[],
  ordenActual: Map<number, number>,
): T[] {
  return destino.filter((fila) => fila.id != null && ordenActual.get(fila.id) !== fila.orden);
}
