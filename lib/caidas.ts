// Reglas de caídas en expedición — inspiradas en las salvaciones de muerte
// de D&D 5e (2014): tres fallos y el aventurero cae.
//
// - Las caídas se acumulan durante la expedición y NO se limpian al terminarla:
//   solo un descanso largo las restaura a 0 (pagar posada tras la partida, o el
//   descanso largo que el DM declara en plena expedición para el grupo activo).
// - Al llegar a MAX_CAIDAS el personaje pierde la expedición, se retira al Nexo
//   (derrotado, sin morir) y carga CANSANCIO_POR_DERROTA puntos de cansancio.
// - Con menos de MAX_CAIDAS al finalizar, no se lleva ningún estado negativo.

export const MAX_CAIDAS = 3;
export const CANSANCIO_POR_DERROTA = 1;

// Agotamiento — D&D 5e 2014 (PHB, apéndice A): 6 niveles con efectos
// acumulativos; el 6.º mata. Un descanso largo reduce 1 nivel; rehusar el
// descanso obligatorio tras la partida suma 1 (y a 6 niveles, mata).
export const MAX_CANSANCIO = 6;
export const EFECTOS_CANSANCIO: string[] = [
  "Sin agotamiento",
  "Desventaja en pruebas de característica",
  "Velocidad reducida a la mitad",
  "Desventaja en ataques y salvaciones",
  "Puntos de golpe máximos reducidos a la mitad",
  "Velocidad reducida a 0",
  "Muerte",
];
