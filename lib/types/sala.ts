import type { LutCaraResult } from "./dados";

export type SalaParticipante = {
  id: string;
  personajeId: number;
  usuarioId: string;
  muerto: boolean;
  nombre: string;
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

export type SalaEvento = EventoDadoTirado | EventoAsignacionManual | EventoPartidaCerrada;
