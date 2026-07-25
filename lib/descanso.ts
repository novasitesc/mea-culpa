import { MAX_CAIDAS, MAX_CANSANCIO, CAIDAS_CURADAS_DESCANSO_CORTO } from "./caidas";

// Descansos en expedición según las reglas de la reunión:
// - Ambos consumen 1 ración por personaje activo. Sin ración no hay beneficio
//   y se gana 1 punto de cansancio (satura en MAX_CANSANCIO sin matar, igual
//   que las demás fuentes de cansancio dentro de la partida).
// - Corto: cura CAIDAS_CURADAS_DESCANSO_CORTO caídas. Sin límite por expedición.
// - Largo: además requiere 1 tienda de acampar del grupo; restaura caídas a 0
//   y reduce 1 nivel de cansancio (D&D 5e 2014). Uno por expedición.

// Salas de una expedición antes del descanso obligatorio. Regla de la mesa, no
// de D&D 5e: "siempre son 4, eso no varía" y "tienen que descansar sí o sí, no
// pueden evitarlo". El bloqueo es solo sobre avanzar de sala: la sala 4 se
// sigue jugando entera (dados, botín, conjuros, bajas) hasta que descansen.
export const SALAS_POR_DESCANSO = 4;

/** Si el grupo ya agotó las salas de este tramo, avanzar exige descansar antes. */
export function debeDescansar(salasRecorridas: number): boolean {
  return salasRecorridas >= SALAS_POR_DESCANSO;
}

/**
 * Salas exploradas desde el último descanso. Se deriva del log de eventos de
 * la partida (no hay contador persistido): cualquier descanso pone el conteo
 * a cero, igual que en la mesa.
 */
export function salasDesdeUltimoDescanso(
  eventos: Array<{ tipo: string }>,
): number {
  let salas = 0;
  for (const ev of eventos) {
    if (ev.tipo === "sala_avanzada") salas += 1;
    else if (ev.tipo === "descanso_corto" || ev.tipo === "descanso_largo") salas = 0;
  }
  return salas;
}

export type TipoDescanso = "corto" | "largo";

export type EstadoDescanso = { caidas: number; cansancio: number };

const normalizar = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// ponytail: detección por nombre del objeto; si el catálogo crece con nombres
// ambiguos, migrar a una categoría propia en la tabla objetos.
export const esRacion = (nombre: string) => normalizar(nombre).includes("racion");
export const esTiendaAcampar = (nombre: string) => normalizar(nombre).includes("tienda de acampar");

export function aplicarDescanso(
  tipo: TipoDescanso,
  estado: EstadoDescanso,
  tieneRacion: boolean,
): EstadoDescanso {
  const caidas = Math.max(0, Math.min(MAX_CAIDAS, estado.caidas));
  const cansancio = Math.max(0, Math.min(MAX_CANSANCIO, estado.cansancio));

  if (!tieneRacion) {
    return { caidas, cansancio: Math.min(MAX_CANSANCIO, cansancio + 1) };
  }
  if (tipo === "corto") {
    return { caidas: Math.max(0, caidas - CAIDAS_CURADAS_DESCANSO_CORTO), cansancio };
  }
  return { caidas: 0, cansancio: Math.max(0, cansancio - 1) };
}
