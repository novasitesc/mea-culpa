export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type RewardType = 'item_fijo' | 'sublista' | 'oro_dados' | 'lut' | 'subtabla'
export type LutCaraTipo = 'oro' | 'item' | 'subtabla' | 'nada'

export const DICE_TYPES: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
export const REWARD_TYPES: RewardType[] = ['item_fijo', 'sublista', 'oro_dados', 'lut', 'subtabla']

export function diceMax(type: DiceType): number {
  return parseInt(type.slice(1), 10)
}

export function rollDie(type: DiceType): number {
  return Math.floor(Math.random() * diceMax(type)) + 1
}

export type SublistaItem = {
  id: number
  objetoId: number
  objetoNombre: string
  objetoIcono: string
  valorMin: number
  valorMax: number
  orden: number
}

export type LutCara = {
  id: number
  recompensaId: number
  numeroCara: number
  tipo: LutCaraTipo
  cantidadDados: number | null
  tipoDadoOro: DiceType | null
  multiplicadorOro: number
  objetoId: number | null
  objetoNombre: string | null
  objetoIcono: string | null
  cantidadMin: number
  cantidadMax: number
  subtablaId: number | null
  subtablaNombre: string | null
}

export type SubtablaCara = {
  id: number
  recompensaId: number
  numeroCara: number
  tipo: 'nada' | 'item' | 'oro'
  objetoId: number | null
  objetoNombre: string | null
  objetoIcono: string | null
  cantidadMin: number
  cantidadMax: number
  oroMin: number
  oroMax: number
}

export type DadoRecompensa = {
  id: number
  nombre: string
  descripcion: string | null
  tipo: RewardType
  tipoDado: DiceType
  costoOro: number
  objetoId: number | null
  objetoNombre: string | null
  objetoIcono: string | null
  cantidadDados: number
  multiplicadorOro: number
  sublistaItems: SublistaItem[]
  lutCaras?: LutCara[]
  subtablaCaras?: SubtablaCara[]
}

export type LutCaraResult = {
  cara: number
  tipo: LutCaraTipo
  objeto?: { id: number; nombre: string; icono: string }
  cantidadObjeto?: number
  oroDetalle?: {
    formula: string
    dados: number[]
    total: number
    multiplicador: number
    cantidadOro: number
  }
  subRoll?: {
    subtablaNombre: string
    subtablaId: number
    cara: number
    objeto: { id: number; nombre: string; icono: string } | null
    cantidadObjeto?: number
    cantidadOro?: number
  }
}

export type RollResult = {
  resultados: number[]
  tipoResultado: 'item' | 'oro' | 'nada' | 'subtabla'
  objeto?: { id: number; nombre: string; icono: string }
  cantidadOro?: number
  lutResultados?: LutCaraResult[]
  cantidad?: number
  // Extensiones aditivas (tiradas idempotentes):
  rollId?: string
  entregas?: Array<{ objetoId: number; solicitada: number; entregada: number }>
  replayed?: boolean
}
