// Reglas de caídas en expedición — inspiradas en las salvaciones de muerte
// de D&D 5e (2014): tres fallos y el aventurero cae.
//
// - Las caídas se acumulan durante la expedición y NO se limpian al terminarla:
//   solo un descanso largo (pagar posada tras la partida) las restaura a 0.
// - Al llegar a MAX_CAIDAS el personaje pierde la expedición, se retira al Nexo
//   (derrotado, sin morir) y carga CANSANCIO_POR_DERROTA puntos de cansancio.
// - Con menos de MAX_CAIDAS al finalizar, no se lleva ningún estado negativo.

export const MAX_CAIDAS = 3;
export const CANSANCIO_POR_DERROTA = 1;
