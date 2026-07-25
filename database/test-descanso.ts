// Self-check de las reglas de descanso: npx tsx database/test-descanso.ts
import assert from "node:assert";
import {
  aplicarDescanso,
  debeDescansar,
  esRacion,
  esTiendaAcampar,
  salasDesdeUltimoDescanso,
  SALAS_POR_DESCANSO,
} from "../lib/descanso";
import { normalizeUsedSpells, spellKey, schoolRgb, SPELL_SCHOOL_RGB } from "../lib/spells";

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

// ── Contador de salas: cualquier descanso pone el conteo a cero ──────────────
const sala = { tipo: "sala_avanzada" };
const corto = { tipo: "descanso_corto" };
const largo = { tipo: "descanso_largo" };
const ruido = { tipo: "dado_tirado" };

assert.equal(salasDesdeUltimoDescanso([]), 0);
assert.equal(salasDesdeUltimoDescanso([sala, ruido, sala]), 2);
assert.equal(salasDesdeUltimoDescanso([sala, sala, corto]), 0);
assert.equal(salasDesdeUltimoDescanso([sala, sala, corto, sala]), 1);
assert.equal(salasDesdeUltimoDescanso([sala, largo, sala, sala, sala]), 3);
// Cuatro salas seguidas disparan el descanso obligatorio
assert.ok(
  salasDesdeUltimoDescanso(Array(SALAS_POR_DESCANSO).fill(sala)) >= SALAS_POR_DESCANSO,
);
// …y tras descansar el aviso se apaga
assert.ok(
  salasDesdeUltimoDescanso([...Array(SALAS_POR_DESCANSO).fill(sala), largo]) < SALAS_POR_DESCANSO,
);

// El bloqueo de avanzar sala ("tienen que descansar sí o sí"). Se comprueba
// aquí y no solo en el botón: /sala-avanzada devuelve 409 con esta misma regla.
assert.equal(debeDescansar(0), false);
assert.equal(debeDescansar(SALAS_POR_DESCANSO - 1), false, "la sala 4 aún se puede abrir");
assert.equal(debeDescansar(SALAS_POR_DESCANSO), true, "tras la 4.ª sala no se avanza más");
// Descansar reabre el paso; encadenar salas tras el descanso vuelve a bloquear.
assert.equal(
  debeDescansar(salasDesdeUltimoDescanso([...Array(SALAS_POR_DESCANSO).fill(sala), largo])),
  false,
);
assert.equal(
  debeDescansar(
    salasDesdeUltimoDescanso([
      ...Array(SALAS_POR_DESCANSO).fill(sala),
      largo,
      ...Array(SALAS_POR_DESCANSO).fill(sala),
    ]),
  ),
  true,
);

// ── Conjuros gastados: claves normalizadas y sin duplicados ──────────────────
assert.equal(spellKey("  Bola de Fuego  "), "bola de fuego");
assert.deepStrictEqual(normalizeUsedSpells(null), []);
assert.deepStrictEqual(normalizeUsedSpells(["Bola de Fuego", "bola de fuego  "]), ["bola de fuego"]);
assert.deepStrictEqual(normalizeUsedSpells(["", "   ", 42, { name: "x" }]), []);

// ── Color de escuela: el overlay 3D lo pasa a three.js, no puede fallar ──────
// Un conjuro sin escuela en el catálogo debe caer al dorado, no romper la escena.
for (const [escuela, par] of Object.entries(SPELL_SCHOOL_RGB)) {
  assert.deepStrictEqual(schoolRgb(escuela), par, escuela);
  for (const rgb of par) {
    assert.match(rgb, /^\d{1,3},\d{1,3},\d{1,3}$/, `${escuela}: "${rgb}" no es un RGB válido`);
  }
}
assert.deepStrictEqual(schoolRgb(null), schoolRgb(undefined));
assert.deepStrictEqual(schoolRgb("Escuela Inventada"), schoolRgb(null));

console.log("descanso.ts: todas las aserciones pasaron ✔");
