// Self-check de las reglas de ejército: npx tsx database/test-ejercito.ts
import assert from "node:assert";
import {
  aplicarBajas,
  capacidadSoldados,
  mapUnidadRow,
  regimientosEnPie,
  totalSoldados,
  totalTropas,
  EJERCITO_SLOTS,
  EJERCITO_STACK_MAX,
  TIPO_EJERCITO,
} from "../lib/ejercito";

// ── Capacidad: soldados por regimiento × regimientos apilados ────────────────
assert.equal(capacidadSoldados({ soldados: 20, cantidad: 3 }), 60);
assert.equal(capacidadSoldados({ soldados: 20, cantidad: 1 }), 20);
// Unidad sin ficha (el DM no puso soldados): cuenta 0, no NaN.
assert.equal(capacidadSoldados({ soldados: null, cantidad: 5 }), 0);

// ── Tropa en pie: la capacidad menos los caídos (migración 058) ─────────────
assert.equal(totalSoldados({ soldados: 20, cantidad: 3 }), 60);
assert.equal(totalSoldados({ soldados: 20, cantidad: 3, soldadosCaidos: 0 }), 60);
// El caso del informe: matar 1 ogro deja 19 en pie, no 0.
assert.equal(totalSoldados({ soldados: 20, cantidad: 1, soldadosCaidos: 1 }), 19);
assert.equal(totalSoldados({ soldados: 20, cantidad: 3, soldadosCaidos: 25 }), 35);
// Nunca negativo, aunque los caídos se pasen de la capacidad.
assert.equal(totalSoldados({ soldados: 20, cantidad: 1, soldadosCaidos: 999 }), 0);
assert.equal(totalSoldados({ soldados: null, cantidad: 5, soldadosCaidos: 0 }), 0);

// ── Regimientos que aún tienen a alguien de pie ──────────────────────────────
assert.equal(regimientosEnPie({ soldados: 20, cantidad: 3, soldadosCaidos: 0 }), 3);
// 35 de 60 ogros → 2 regimientos siguen en juego (uno a medias cuenta).
assert.equal(regimientosEnPie({ soldados: 20, cantidad: 3, soldadosCaidos: 25 }), 2);
assert.equal(regimientosEnPie({ soldados: 20, cantidad: 3, soldadosCaidos: 41 }), 1);
assert.equal(regimientosEnPie({ soldados: 20, cantidad: 3, soldadosCaidos: 60 }), 0);
// Sin ficha de soldados se informan los regimientos tal cual.
assert.equal(regimientosEnPie({ soldados: null, cantidad: 4 }), 4);

const ejercito = [
  { soldados: 20, cantidad: 2, soldadosCaidos: 5 },
  { soldados: 5, cantidad: 4, soldadosCaidos: 0 },
  { soldados: null, cantidad: 9, soldadosCaidos: 0 },
] as Parameters<typeof totalTropas>[0];
assert.equal(totalTropas(ejercito), 35 + 20 + 0);
assert.equal(totalTropas([]), 0);

// ── Bajas del DM: se cuentan en SOLDADOS ────────────────────────────────────
// Caso normal: caen algunos, el resto aguanta.
assert.deepStrictEqual(aplicarBajas(20, 3, false), { caidas: 3, restante: 17 });
// El bug del informe: restar 1 a un regimiento de 20 deja 19, no 0.
assert.deepStrictEqual(aplicarBajas(20, 1, false), { caidas: 1, restante: 19 });
// Tumbar un regimiento entero de tres: 20 de 60.
assert.deepStrictEqual(aplicarBajas(60, 20, false), { caidas: 20, restante: 40 });
// No se puede matar más de lo que hay en pie.
assert.deepStrictEqual(aplicarBajas(4, 99, false), { caidas: 4, restante: 0 });
// Aniquilar barre la casilla sin importar el número escrito.
assert.deepStrictEqual(aplicarBajas(60, 1, true), { caidas: 60, restante: 0 });
// Bajas 0 o negativas no revientan la casilla ni regalan soldados.
assert.deepStrictEqual(aplicarBajas(5, 0, false), { caidas: 0, restante: 5 });
assert.deepStrictEqual(aplicarBajas(5, -3, false), { caidas: 0, restante: 5 });
// Decimales se truncan: la unidad mínima es un soldado entero.
assert.deepStrictEqual(aplicarBajas(5, 2.9, false), { caidas: 2, restante: 3 });
// Casilla ya vacía: no hay nada que matar.
assert.deepStrictEqual(aplicarBajas(0, 5, false), { caidas: 0, restante: 0 });
assert.deepStrictEqual(aplicarBajas(0, 5, true), { caidas: 0, restante: 0 });

// La casilla se libera exactamente cuando no queda nadie en pie.
for (const [vivos, bajas] of [[3, 3], [1, 1], [20, 20], [60, 60]] as const) {
  assert.equal(aplicarBajas(vivos, bajas, false).restante, 0);
}
assert.ok(aplicarBajas(20, 19, false).restante > 0);

// ── Bajas acumuladas: matar de a pocos hasta agotar el regimiento ───────────
// Lo que hace el DM en la sala: 20 ogros, de 5 en 5.
let unidad = { soldados: 20, cantidad: 1, soldadosCaidos: 0 };
for (const esperado of [15, 10, 5, 0]) {
  const { restante } = aplicarBajas(totalSoldados(unidad), 5, false);
  unidad = { ...unidad, soldadosCaidos: capacidadSoldados(unidad) - restante };
  assert.equal(totalSoldados(unidad), esperado);
}
assert.equal(unidad.soldadosCaidos, 20);

// ── Lectura de filas: una unidad sin join no debe romper la sala ─────────────
const completa = mapUnidadRow({
  id: "7",
  objeto_id: "12",
  cantidad: "3",
  orden: "1",
  soldados_caidos: "25",
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
assert.equal(completa.soldadosCaidos, 25);
assert.equal(capacidadSoldados(completa), 60);
assert.equal(totalSoldados(completa), 35);

// Fila anterior a la migración 058 (sin la columna): nadie ha caído.
const sinColumna = mapUnidadRow({
  id: 8,
  objeto_id: 12,
  cantidad: 2,
  orden: 0,
  objetos: { nombre: "Lanceros", soldados: 20 },
});
assert.equal(sinColumna.soldadosCaidos, 0);
assert.equal(totalSoldados(sinColumna), 40);

const huerfana = mapUnidadRow({ id: 1, objeto_id: 2, cantidad: 1, orden: 0 });
assert.equal(huerfana.nombre, "Unidad desconocida");
assert.equal(huerfana.icono, "⚔️");
assert.equal(huerfana.rareza, "común");
assert.equal(huerfana.soldados, null);
assert.equal(huerfana.soldadosCaidos, 0);
assert.equal(totalSoldados(huerfana), 0);

// ── Constantes que la migración 056 replica en CHECKs ───────────────────────
// Si estos números cambian, hay que mover también el CHECK de `orden` y el de
// `cantidad` en supabase/migrations/056_ejercito_rts.sql.
assert.equal(EJERCITO_SLOTS, 5);
assert.equal(EJERCITO_STACK_MAX, 100);
assert.equal(TIPO_EJERCITO, "ejército");

console.log("ejercito.ts: todas las aserciones pasaron ✔");
