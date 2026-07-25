// Self-check de las reglas de ejército: npx tsx database/test-ejercito.ts
import assert from "node:assert";
import {
  aplicarBajas,
  mapUnidadRow,
  totalSoldados,
  totalTropas,
  EJERCITO_SLOTS,
  EJERCITO_STACK_MAX,
  TIPO_EJERCITO,
} from "../lib/ejercito";

// ── Recuento de tropas: soldados por regimiento × regimientos apilados ───────
assert.equal(totalSoldados({ soldados: 20, cantidad: 3 }), 60);
assert.equal(totalSoldados({ soldados: 20, cantidad: 1 }), 20);
// Unidad sin ficha (el DM no puso soldados): cuenta 0, no NaN.
assert.equal(totalSoldados({ soldados: null, cantidad: 5 }), 0);

const ejercito = [
  { soldados: 20, cantidad: 2 },
  { soldados: 5, cantidad: 4 },
  { soldados: null, cantidad: 9 },
] as Parameters<typeof totalTropas>[0];
assert.equal(totalTropas(ejercito), 60);
assert.equal(totalTropas([]), 0);

// ── Bajas del DM ────────────────────────────────────────────────────────────
// Caso normal: mueren algunos, el resto aguanta.
assert.deepStrictEqual(aplicarBajas(10, 3, false), { caidas: 3, restante: 7 });
// No se puede matar más de lo que hay en pie.
assert.deepStrictEqual(aplicarBajas(4, 99, false), { caidas: 4, restante: 0 });
// Aniquilar barre el regimiento sin importar el número escrito.
assert.deepStrictEqual(aplicarBajas(7, 1, true), { caidas: 7, restante: 0 });
// Bajas 0 o negativas no revientan la casilla ni regalan unidades.
assert.deepStrictEqual(aplicarBajas(5, 0, false), { caidas: 0, restante: 5 });
assert.deepStrictEqual(aplicarBajas(5, -3, false), { caidas: 0, restante: 5 });
// Decimales se truncan: la unidad mínima es un regimiento entero.
assert.deepStrictEqual(aplicarBajas(5, 2.9, false), { caidas: 2, restante: 3 });
// Casilla ya vacía: no hay nada que matar.
assert.deepStrictEqual(aplicarBajas(0, 5, false), { caidas: 0, restante: 0 });
assert.deepStrictEqual(aplicarBajas(0, 5, true), { caidas: 0, restante: 0 });

// La casilla se libera exactamente cuando no queda nadie en pie.
for (const [cantidad, bajas] of [[3, 3], [1, 1], [10, 10]] as const) {
  assert.equal(aplicarBajas(cantidad, bajas, false).restante, 0);
}
assert.ok(aplicarBajas(3, 2, false).restante > 0);

// ── Lectura de filas: una unidad sin join no debe romper la sala ─────────────
const completa = mapUnidadRow({
  id: "7",
  objeto_id: "12",
  cantidad: "3",
  orden: "1",
  objetos: {
    nombre: "Lanceros",
    icono: "🔱",
    descripcion: "Formación cerrada",
    rareza: "raro",
    precio: 500,
    soldados: 20,
    clase_armadura: 14,
    dano: "1d6",
  },
});
assert.equal(completa.id, 7);
assert.equal(completa.objetoId, 12);
assert.equal(completa.cantidad, 3);
assert.equal(completa.nombre, "Lanceros");
assert.equal(completa.soldados, 20);
assert.equal(totalSoldados(completa), 60);

const huerfana = mapUnidadRow({ id: 1, objeto_id: 2, cantidad: 1, orden: 0 });
assert.equal(huerfana.nombre, "Unidad desconocida");
assert.equal(huerfana.icono, "⚔️");
assert.equal(huerfana.rareza, "común");
assert.equal(huerfana.soldados, null);
assert.equal(totalSoldados(huerfana), 0);

// ── Constantes que la migración 056 replica en CHECKs ───────────────────────
// Si estos números cambian, hay que mover también el CHECK de `orden` y el de
// `cantidad` en supabase/migrations/056_ejercito_rts.sql.
assert.equal(EJERCITO_SLOTS, 5);
assert.equal(EJERCITO_STACK_MAX, 100);
assert.equal(TIPO_EJERCITO, "ejército");

console.log("ejercito.ts: todas las aserciones pasaron ✔");
