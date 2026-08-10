// Check de los iconos de ejército. Ejecutar: npx tsx lib/iconMapper.test.ts
//
// Lo que se protege aquí es el ORDEN de KEYWORD_RULES: los nombres de tropa
// contienen palabras de equipo ("Espadachines" lleva "espada", "Regimiento
// escudado" lleva "escudo") y si el bloque de ejército baja por debajo del de
// armas, los regimientos pasan a pintarse con el icono del arma suelta sin que
// nada falle. Estas aserciones son las que se rompen si alguien lo reordena.
import assert from "node:assert/strict";
import {
  GiArcher,
  GiCavalry,
  GiCrossedSwords,
  GiDwarfHelmet,
  GiOrcHead,
  GiRank3,
  GiShield,
  GiShieldBash,
  GiSpears,
  GiSwordman,
} from "react-icons/gi";
import { getIconForString, esEscudo } from "./iconMapper";

/** Componente con el que se pinta un nombre de objeto. */
const icono = (nombre: string) => (getIconForString(nombre) as any)?.type;

// La tropa gana a la pieza de equipo que lleva en el nombre.
assert.equal(icono("Espadachines de Vera"), GiSwordman, "espadachines ≠ espada");
assert.equal(icono("Regimiento escudado"), GiShieldBash, "escudado ≠ escudo");
assert.equal(icono("Lanceros con escudo"), GiSpears, "manda la tropa, no el escudo");

// ...pero el equipo suelto sigue intacto: el bloque de ejército no lo secuestra.
assert.equal(icono("Espada larga"), GiCrossedSwords, "el arma sigue siendo arma");
assert.equal(icono("Escudo de roble"), GiShield, "el escudo sigue siendo escudo");

// Vocabulario del manual (LibroRTSDND.md).
assert.equal(icono("Arqueros del bosque"), GiArcher);
assert.equal(icono("Unidades montadas"), GiCavalry, "clase de movimiento (l. 288)");
assert.equal(icono("Comandante hombre bestia"), GiRank3, "el mando manda (l. 540)");

// Razas de relleno para surtir la tienda.
assert.equal(icono("Orcos del Yermo"), GiOrcHead);
assert.equal(icono("Enanos de la Forja"), GiDwarfHelmet);

// Los emojis del selector de admin resuelven a su icono, no a un span literal.
for (const [emoji, esperado] of [
  ["🔱", GiSpears],
  ["🎯", GiArcher],
  ["🤺", GiSwordman],
  ["🧱", GiShieldBash],
  ["🏇", GiCavalry],
  ["🎖", GiRank3],
  ["👺", GiOrcHead],
  ["🧔", GiDwarfHelmet],
] as const) {
  assert.equal((getIconForString(emoji) as any)?.type, esperado, `emoji ${emoji}`);
}

// `esEscudo` decide si el muñeco de la bolsa dibuja escudo o espada en la mano.
// La ranura acepta un solo tipo ("arma"), así que el nombre es todo lo que hay.
for (const nombre of ["Escudo de Hierro", "Escudo Comun", "escudo de roble", "Broquel élfico"]) {
  assert.equal(esEscudo(nombre), true, `${nombre} es escudo`);
}
for (const nombre of ["Espada Larga", "Hacha de Batalla", "Varilla de Fuerza", ""]) {
  assert.equal(esEscudo(nombre), false, `${nombre} no es escudo`);
}
assert.equal(esEscudo(null), false, "sin nombre no hay escudo");

console.log("iconMapper: OK");
