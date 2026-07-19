// Motor puro de resolución de tiradas. Sin I/O: config completa + RNG → outcomes.
// Quien llama aplica los efectos (ver apply.ts) y mapea a RollResult.
import { diceMax } from "../types/dados";
import type { DiceType, LutCaraResult, LutCaraTipo, RewardType, RollResult } from "../types/dados";

/** Como Math.random: devuelve un número en [0, 1). */
export type Rng = () => number;

export type DiceOutcome =
  | { kind: "nada"; cara: number }
  // `caras` solo en oro_dados (todas las caras tiradas); en LUT/subtabla el oro es un rango plano.
  | { kind: "oro"; cara: number; caras?: number[]; cantidad: number }
  | { kind: "item"; cara: number; objetoId: number; cantidad: number }
  | {
      kind: "subtabla";
      cara: number;
      subCara: number;
      subtablaId: number;
      premio: DiceOutcome; // nada | oro | item, con cara = subCara
    };

export type LutCaraConfig = {
  numeroCara: number;
  tipo: LutCaraTipo;
  oroMin: number;
  oroMax: number;
  objetoId: number | null;
  cantidadMin: number;
  cantidadMax: number;
  subtablaId: number | null;
};

export type SubtablaCaraConfig = {
  numeroCara: number;
  tipo: "nada" | "item" | "oro";
  objetoId: number | null;
  cantidadMin: number;
  cantidadMax: number;
  oroMin: number;
  oroMax: number;
};

export type RewardConfig = {
  id: number;
  nombre: string;
  tipo: RewardType;
  tipoDado: DiceType;
  costoOro: number;
  objetoId: number | null; // item_fijo
  cantidadDados: number; // oro_dados
  multiplicadorOro: number; // oro_dados
  sublista: Array<{ objetoId: number; valorMin: number; valorMax: number }>;
  lutCaras: LutCaraConfig[];
  subtablas: Record<number, { nombre: string; caras: SubtablaCaraConfig[] }>;
};

/** Config inválida o tirada imposible; `status` es el HTTP sugerido para la ruta. */
export class DiceConfigError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = "DiceConfigError";
  }
}

export function resolveRoll(
  config: RewardConfig,
  cantidad: number,
  rng: Rng = Math.random,
): DiceOutcome[] {
  const d = (faces: number) => Math.floor(rng() * faces) + 1;
  const dado = () => d(diceMax(config.tipoDado));
  const entre = (min: number, max: number) =>
    min + Math.floor(rng() * (Math.max(min, max) - min + 1));

  switch (config.tipo) {
    case "item_fijo": {
      if (!config.objetoId) throw new DiceConfigError("Item no configurado");
      return [{ kind: "item", cara: dado(), objetoId: config.objetoId, cantidad: 1 }];
    }

    case "sublista": {
      const cara = dado();
      const match = config.sublista.find((s) => cara >= s.valorMin && cara <= s.valorMax);
      if (!match) throw new DiceConfigError("Sin item para ese resultado");
      return [{ kind: "item", cara, objetoId: match.objetoId, cantidad: 1 }];
    }

    case "oro_dados": {
      const caras = Array.from({ length: Math.max(1, config.cantidadDados) }, dado);
      const suma = caras.reduce((a, b) => a + b, 0);
      return [
        { kind: "oro", cara: caras[0], caras, cantidad: suma * Math.max(1, config.multiplicadorOro) },
      ];
    }

    case "lut":
      return Array.from({ length: cantidad }, () => resolveLutTirada(config, d, entre));

    case "subtabla":
      throw new DiceConfigError("Una subtabla no se tira directamente", 400);
  }
}

function resolveLutTirada(
  config: RewardConfig,
  d: (faces: number) => number,
  entre: (min: number, max: number) => number,
): DiceOutcome {
  const cara = d(20);
  const c = config.lutCaras.find((x) => x.numeroCara === cara);
  if (!c || c.tipo === "nada") return { kind: "nada", cara };

  if (c.tipo === "item" && c.objetoId) {
    return { kind: "item", cara, objetoId: c.objetoId, cantidad: entre(c.cantidadMin, c.cantidadMax) };
  }

  if (c.tipo === "oro") {
    return { kind: "oro", cara, cantidad: entre(c.oroMin, c.oroMax) };
  }

  if (c.tipo === "subtabla" && c.subtablaId != null) {
    const subCara = d(20);
    const sc = config.subtablas[c.subtablaId]?.caras.find((x) => x.numeroCara === subCara);
    let premio: DiceOutcome = { kind: "nada", cara: subCara };
    if (sc?.tipo === "item" && sc.objetoId) {
      premio = { kind: "item", cara: subCara, objetoId: sc.objetoId, cantidad: entre(sc.cantidadMin, sc.cantidadMax) };
    } else if (sc?.tipo === "oro") {
      premio = { kind: "oro", cara: subCara, cantidad: entre(sc.oroMin, sc.oroMax) };
    }
    return { kind: "subtabla", cara, subCara, subtablaId: c.subtablaId, premio };
  }

  // Cara con config incompleta (item sin objeto, subtabla sin id): igual que hoy, nada.
  return { kind: "nada", cara };
}

// ── Mapper único DiceOutcome[] → RollResult (puro; los objetos llegan ya cargados) ──

export type ObjetoInfo = { id: number; nombre: string; icono: string };

/** IDs de objeto referidos por los outcomes, incluidos los premios anidados de subtabla. */
export function collectObjetoIds(outcomes: DiceOutcome[]): number[] {
  const ids = new Set<number>();
  const walk = (o: DiceOutcome) => {
    if (o.kind === "item") ids.add(o.objetoId);
    else if (o.kind === "subtabla") walk(o.premio);
  };
  outcomes.forEach(walk);
  return [...ids];
}

export function toRollResult(
  config: RewardConfig,
  outcomes: DiceOutcome[],
  objetos: Map<number, ObjetoInfo>,
  cantidad: number,
): RollResult {
  if (config.tipo === "lut") {
    const lutResultados = outcomes.map((o) => outcomeToLutResult(config, o, objetos));
    const first = lutResultados[0];
    return {
      // Todas las caras primarias (antes solo la 1ª): la UI puede animar N dados.
      resultados: outcomes.map((o) => o.cara),
      tipoResultado: first?.tipo ?? "nada",
      objeto: first?.objeto,
      cantidadOro: first?.oroDetalle?.cantidadOro,
      lutResultados,
      cantidad,
    };
  }

  const o = outcomes[0];
  if (o.kind === "oro") {
    return { resultados: o.caras ?? [o.cara], tipoResultado: "oro", cantidadOro: o.cantidad };
  }
  return {
    resultados: [o.cara],
    tipoResultado: "item",
    objeto: o.kind === "item" ? objetos.get(o.objetoId) : undefined,
  };
}

function outcomeToLutResult(
  config: RewardConfig,
  o: DiceOutcome,
  objetos: Map<number, ObjetoInfo>,
): LutCaraResult {
  switch (o.kind) {
    case "nada":
      return { cara: o.cara, tipo: "nada" };
    case "item":
      return { cara: o.cara, tipo: "item", objeto: objetos.get(o.objetoId), cantidadObjeto: o.cantidad };
    case "oro": {
      const c = config.lutCaras.find((x) => x.numeroCara === o.cara);
      return {
        cara: o.cara,
        tipo: "oro",
        oroDetalle: {
          formula: `${c?.oroMin ?? 0}–${c?.oroMax ?? 0}`,
          dados: [o.cantidad],
          total: o.cantidad,
          multiplicador: 1,
          cantidadOro: o.cantidad,
        },
      };
    }
    case "subtabla": {
      const p = o.premio;
      return {
        cara: o.cara,
        tipo: "subtabla",
        subRoll: {
          subtablaNombre: config.subtablas[o.subtablaId]?.nombre ?? "Sub-tabla",
          subtablaId: o.subtablaId,
          cara: o.subCara,
          objeto: p.kind === "item" ? (objetos.get(p.objetoId) ?? null) : null,
          cantidadObjeto: p.kind === "item" ? p.cantidad : undefined,
          cantidadOro: p.kind === "oro" ? p.cantidad : undefined,
        },
      };
    }
  }
}
