// Check de la ventana del feed. Ejecutar: npx tsx app/components/sala-feed.test.ts
//
// Lo que se protege es el offset `desde`: si vuelve a ser 0 al recortar, todos
// los eventos cambian de key al llegar uno nuevo, React los remonta y el panel
// entero repite su animación de entrada en cada tirada. No falla nada visible
// en tipos ni en build — solo se ve raro. De ahí el check.
import assert from "node:assert/strict";
import { VISIBLES, ventanaFeed } from "./sala-feed";

// Por debajo del tope no se recorta nada.
assert.deepEqual(ventanaFeed(0, false), { fuera: 0, desde: 0 });
assert.deepEqual(ventanaFeed(VISIBLES, false), { fuera: 0, desde: 0 });

// Por encima, la ventana se desplaza en vez de empezar de cero.
assert.deepEqual(ventanaFeed(VISIBLES + 7, false), { fuera: 7, desde: 7 });

// "Ver historial" pinta todo, pero sigue contando cuántos estaban fuera para
// poder etiquetar el botón de vuelta.
assert.deepEqual(ventanaFeed(VISIBLES + 7, true), { fuera: 7, desde: 0 });

// El índice absoluto de cada evento no cambia cuando entra uno nuevo: es lo que
// mantiene la key estable.
const antes = ventanaFeed(40, false).desde; // pinta 25..39
const despues = ventanaFeed(41, false).desde; // pinta 26..40
assert.equal(antes + 1, despues, "la ventana debe avanzar de uno en uno");
assert.equal(40 - antes, VISIBLES, "siempre se pintan VISIBLES eventos");

console.log("sala-feed: ventana OK");
