// Check del reordenado de bolsa. Ejecutar: npx tsx lib/bagOrder.test.ts
//
// Protege la invariante que se rompía en producción: tras aparcar, NINGÚN valor
// de `orden` que quede en la tabla puede coincidir con un `orden` de destino.
// Si deja de cumplirse, `uq_bolsa_orden` devuelve 23505 y guardar la bolsa
// responde 500 — exactamente el bug que arregló este archivo.
import assert from "node:assert/strict";
import { filasQueSeMueven, ordenAparcado } from "./bagOrder";

type Fila = { id: number | null; orden: number };

/**
 * Simula lo que hace la ruta y devuelve el `orden` que ocupa cada fila justo
 * antes de escribir los destinos.
 *
 * El borrado de las filas que ya no están va PRIMERO, y no es un detalle: una
 * fila borrada libera su `orden`, y si se borrase después seguiría ocupando el
 * hueco al que otra fila apunta. Mover ese paso rompe estas aserciones.
 */
function ordenTrasAparcar(destino: Fila[], actual: Map<number, number>) {
  const sobreviven = new Set(destino.map((f) => f.id));
  const tras = new Map([...actual].filter(([id]) => sobreviven.has(id)));
  for (const fila of filasQueSeMueven(destino, actual)) {
    tras.set(fila.id as number, ordenAparcado(fila.id as number));
  }
  return tras;
}

/** La comprobación que importa: ningún hueco de destino sigue ocupado. */
function sinColisiones(destino: Fila[], actual: Map<number, number>) {
  const tras = ordenTrasAparcar(destino, actual);
  for (const fila of destino) {
    for (const [id, orden] of tras) {
      if (id === fila.id) continue;
      if (orden === fila.orden) return false;
    }
  }
  return true;
}

// ── El caso que reventaba: dos objetos intercambian su posición ──────────────
const swapActual = new Map([
  [10, 1],
  [11, 2],
]);
const swapDestino: Fila[] = [
  { id: 11, orden: 1 },
  { id: 10, orden: 2 },
];
assert.equal(filasQueSeMueven(swapDestino, swapActual).length, 2, "ambas se mueven");
assert.ok(sinColisiones(swapDestino, swapActual), "el swap ya no colisiona");

// ── Guardar sin tocar nada no debe generar ni un UPDATE de aparcado ──────────
const quietoActual = new Map([
  [10, 1],
  [11, 2],
]);
const quietoDestino: Fila[] = [
  { id: 10, orden: 1 },
  { id: 11, orden: 2 },
];
assert.deepEqual(filasQueSeMueven(quietoDestino, quietoActual), [], "sin movimiento, sin escrituras");

// ── Quitar el objeto del medio: los de abajo suben una posición ──────────────
const cierreActual = new Map([
  [10, 1],
  [11, 2],
  [12, 3],
]);
const cierreDestino: Fila[] = [
  { id: 10, orden: 1 },
  { id: 12, orden: 2 },
];
assert.ok(sinColisiones(cierreDestino, cierreActual), "cerrar el hueco no colisiona");

// ── Filas nuevas (sin id) nunca aparcan: aún no existen en la tabla ──────────
const nuevaActual = new Map([[10, 1]]);
const nuevaDestino: Fila[] = [
  { id: null, orden: 1 },
  { id: 10, orden: 2 },
];
assert.deepEqual(
  filasQueSeMueven(nuevaDestino, nuevaActual).map((f) => f.id),
  [10],
  "solo aparca lo que ya existe",
);
assert.ok(sinColisiones(nuevaDestino, nuevaActual), "insertar delante no colisiona");

// ── El valor aparcado nunca puede ser un destino válido ──────────────────────
// Los `orden` de destino son índices 1..n; aparcar en -id siempre queda fuera.
for (const id of [1, 7, 9999]) {
  assert.ok(ordenAparcado(id) < 1, `-${id} debe quedar fuera del rango de destino`);
}

// ── Una inversión completa: el peor caso de colisiones ──────────────────────
const n = 8;
const invActual = new Map(Array.from({ length: n }, (_, i) => [100 + i, i + 1]));
const invDestino: Fila[] = Array.from({ length: n }, (_, i) => ({
  id: 100 + (n - 1 - i),
  orden: i + 1,
}));
assert.ok(sinColisiones(invDestino, invActual), "invertir la bolsa entera no colisiona");

console.log("bagOrder: reordenado sin colisiones OK");
