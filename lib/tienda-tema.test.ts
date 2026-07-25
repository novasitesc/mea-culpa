// Check del color y la voz de los puestos. Ejecutar: npx tsx lib/tienda-tema.test.ts
import assert from "node:assert/strict";
import { temaTienda, fraseTendero } from "./tienda-tema";

// La temática manda sobre el hash: mismo id, colores distintos según el oficio.
const forja = temaTienda("s1", "La Forja del Enano");
const consumibles = temaTienda("s1", "Consumibles de Vera");
assert.equal(forja.accent, "#9fb3c8", "forja → metálico");
assert.equal(consumibles.accent, "#eab308", "consumibles → ámbar");
assert.notEqual(forja.accent, consumibles.accent);

// Acentos y mayúsculas no deben romper la búsqueda.
assert.equal(temaTienda("x", "POCIÓN Y BREBAJE").accent, consumibles.accent);
assert.equal(temaTienda("x", "herrería").accent, forja.accent);

// La descripción también cuenta: el nombre propio no dice el oficio.
assert.equal(
  temaTienda("x", "Casa Mirlo — espadas y armaduras de guerra").accent,
  temaTienda("y", "Armería").accent,
  "la descripción decide cuando el nombre no dice nada",
);

// Sin temática reconocida: color estable por hash, nunca undefined.
const anon = temaTienda("tienda-42", "Casa Mirlo");
assert.deepEqual(anon, temaTienda("tienda-42", "Casa Mirlo"), "determinista");
assert.match(anon.accent, /^#[0-9a-f]{6}$/, "hex válido");
assert.deepEqual(temaTienda("tienda-42"), anon, "sin texto = mismo hash");

// El tendero no repite frase seguida al subir la variante.
assert.notEqual(
  fraseTendero("bienvenida", "s1", 0),
  fraseTendero("bienvenida", "s1", 1),
  "la variante rota la frase",
);

console.log("tienda-tema: OK");
