export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type RewardType = 'item_fijo' | 'sublista' | 'oro_dados'

export const DICE_TYPES: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
export const REWARD_TYPES: RewardType[] = ['item_fijo', 'sublista', 'oro_dados']

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
}

export type RollResult = {
  resultados: number[]
  tipoResultado: 'item' | 'oro'
  objeto?: { id: number; nombre: string; icono: string }
  cantidadOro?: number
}
