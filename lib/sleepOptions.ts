export type SleepOption = {
  id: string;
  name: string;
  description: string;
  cost: number;
  homeLabel: string;
};

export const SLEEP_OPTIONS: SleepOption[] = [
  {
    id: "paja_establo",
    name: "Paja del establo",
    description: "Una noche fria, sin lujos, pero bajo techo.",
    cost: 1,
    homeLabel: "Establo",
  },
  {
    id: "posada_ruta",
    name: "Posada de ruta",
    description: "Habitacion simple, comida caliente y cama segura.",
    cost: 5,
    homeLabel: "Posada",
  },
  {
    id: "suite_gremio",
    name: "Suite del gremio",
    description: "Descanso de elite para aventureros con oro.",
    cost: 10,
    homeLabel: "Suite del Gremio",
  },
];
