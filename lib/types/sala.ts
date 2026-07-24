import type { LutCaraResult } from "./dados";

export type SalaParticipante = {
  id: string;
  personajeId: number;
  usuarioId: string;
  muerto: boolean;
  /** Perdió la expedición al acumular 3 caídas: se retira al Nexo sin morir. */
  derrotado: boolean;
  nombre: string;
  extremidades: Record<string, boolean> | null;
  /** Caídas acumuladas (0-3); solo un descanso largo las restaura. */
  caidas: number;
  /** Niveles de agotamiento (0-6); un descanso largo reduce 1. */
  cansancio: number;
};

export type SalaPartida = {
  id: string;
  titulo: string;
  estado: string;
  piso: number;
  tier: number;
  inicioEn: string | null;
};

export type EventoDadoTirado = {
  tipo: "dado_tirado";
  recompensaNombre: string;
  tipoDado: string;
  resultados: number[];
  tipoResultado: string;
  objeto?: { id: number; nombre: string; icono: string };
  cantidadOro?: number;
  lutResultados?: LutCaraResult[];
  /** Detalle de entrega por ítem (para reproducir el overlay en espectadores). */
  entregas?: Array<{ objetoId: number; solicitada: number; entregada: number }>;
  personajeNombre: string;
  personajeId: number;
};

export type EventoAsignacionManual = {
  tipo: "asignacion_manual";
  objeto?: { id: number; nombre: string; icono: string };
  cantidadOro?: number;
  cantidad?: number;
  personajeNombre: string;
  personajeId: number;
};

export type EventoPartidaCerrada = {
  tipo: "partida_cerrada";
};

export type EventoPartidaIniciada = {
  tipo: "partida_iniciada";
};

export type EventoConsumibleUsado = {
  tipo: "consumible_usado";
  eventoId?: string;
  personajeId: number;
  personajeNombre: string;
  objeto: { id: number; nombre: string; icono: string };
  restante: number;
};

export type EventoDesmembramiento = {
  tipo: "desmembramiento";
  personajeId: number;
  personajeNombre: string;
  miembro: string;
  miembroLabel: string;
  desmembrado: boolean;
};

export type EventoCaida = {
  tipo: "caida";
  personajeId: number;
  personajeNombre: string;
  /** Total de caídas tras el evento (0-3). */
  caidas: number;
  /** +1 caída marcada, -1 caída retirada por el DM. */
  delta: number;
  /** true cuando la 3.ª caída derrota al personaje y lo retira al Nexo. */
  derrotado: boolean;
  /** Total de cansancio tras el evento (la derrota suma 1; revertirla lo devuelve). */
  cansancio?: number;
};

export type EventoCansancio = {
  tipo: "cansancio";
  personajeId: number;
  personajeNombre: string;
  /** Total de cansancio tras el evento (0-6). */
  cansancio: number;
  /** +1 impuesto por el DM, -1 aliviado. */
  delta: number;
};

export type DescansoPersonajeResultado = {
  personajeId: number;
  nombre: string;
  caidasPrevias: number;
  cansancioPrevio: number;
  /** Estado tras el descanso (ausente en eventos antiguos persistidos). */
  caidas?: number;
  cansancio?: number;
  /** Sin ración: no recibió beneficio y ganó +1 cansancio. */
  sinRacion?: boolean;
  /** Descanso largo con ración: recuperó todos los espacios de conjuro. */
  conjurosRecuperados?: boolean;
};

export type EventoConjuroLanzado = {
  tipo: "conjuro_lanzado";
  personajeId: number;
  personajeNombre: string;
  conjuro: string;
  /** 0 = truco (no gasta espacio y puede repetirse). */
  spellLevel: number;
  /** Escuela del catálogo; tiñe la animación y el sonido. */
  escuela: string | null;
  /** Descripción del catálogo (HTML acotado) para el tooltip del log. */
  descripcion?: string | null;
};

export type EventoSalaAvanzada = {
  tipo: "sala_avanzada";
  /** Nº de sala explorada tras el evento (reinicia a 0 con cada descanso). */
  sala: number;
  /** true cuando toca el descanso obligatorio (SALAS_POR_DESCANSO). */
  requiereDescanso: boolean;
};

export type EventoDescansoLargo = {
  tipo: "descanso_largo";
  /** Con ración: caídas restauradas a 0 y −1 nivel de cansancio. */
  personajes: DescansoPersonajeResultado[];
};

export type EventoDescansoCorto = {
  tipo: "descanso_corto";
  /** Con ración: cura 1 caída. */
  personajes: DescansoPersonajeResultado[];
};

export type SalaEvento =
  | EventoDadoTirado
  | EventoAsignacionManual
  | EventoPartidaCerrada
  | EventoPartidaIniciada
  | EventoConsumibleUsado
  | EventoDesmembramiento
  | EventoCaida
  | EventoCansancio
  | EventoDescansoLargo
  | EventoDescansoCorto
  | EventoSalaAvanzada
  | EventoConjuroLanzado;
