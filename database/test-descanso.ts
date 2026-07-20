// Self-check de las reglas de descanso: npx tsx database/test-descanso.ts
import assert from "node:assert";
import { aplicarDescanso, esRacion, esTiendaAcampar } from "../lib/descanso";

// Detección por nombre (con y sin tilde, mayúsculas, plurales)
assert.ok(esRacion("Ración de viaje"));
assert.ok(esRacion("racion seca"));
assert.ok(esRacion("RACIONES DEL SOLDADO"));
assert.ok(!esRacion("Racimo de uvas"));
assert.ok(!esRacion("Poción de vida"));
assert.ok(esTiendaAcampar("Tienda de Acampar reforzada"));
assert.ok(!esTiendaAcampar("Tienda del gremio"));

// Corto con ración: cura 1 caída, no toca cansancio
assert.deepStrictEqual(aplicarDescanso("corto", { caidas: 2, cansancio: 3 }, true), { caidas: 1, cansancio: 3 });
assert.deepStrictEqual(aplicarDescanso("corto", { caidas: 0, cansancio: 1 }, true), { caidas: 0, cansancio: 1 });

// Largo con ración: caídas a 0 y −1 cansancio (5e 2014)
assert.deepStrictEqual(aplicarDescanso("largo", { caidas: 2, cansancio: 3 }, true), { caidas: 0, cansancio: 2 });
assert.deepStrictEqual(aplicarDescanso("largo", { caidas: 0, cansancio: 0 }, true), { caidas: 0, cansancio: 0 });

// Sin ración: sin beneficio y +1 cansancio, saturando en 6 sin matar
assert.deepStrictEqual(aplicarDescanso("corto", { caidas: 2, cansancio: 3 }, false), { caidas: 2, cansancio: 4 });
assert.deepStrictEqual(aplicarDescanso("largo", { caidas: 1, cansancio: 6 }, false), { caidas: 1, cansancio: 6 });

// Entradas fuera de rango se acotan
assert.deepStrictEqual(aplicarDescanso("largo", { caidas: 99, cansancio: -5 }, true), { caidas: 0, cansancio: 0 });

console.log("descanso.ts: todas las aserciones pasaron ✔");
