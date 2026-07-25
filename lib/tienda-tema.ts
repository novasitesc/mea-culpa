// Identidad de cada puesto del mercado y voz de su tendero.
//
// Ninguna de las dos cosas está en la base de datos: se derivan del id de la
// tienda con un hash, así cada comerciante tiene siempre el mismo color y las
// mismas frases sin añadir columnas ni escribir guion tienda por tienda.
// Determinista a propósito — con Math.random() el servidor y el cliente
// pintarían cosas distintas y React se quejaría al hidratar.

/** Hash estable de una cadena (djb2). Mismo id → mismo puesto, siempre. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type TemaTienda = {
  /** Color de acento del puesto: toldo, medallón y halos. */
  accent: string;
  /** Versión apagada para fondos amplios. */
  deep: string;
};

// Paleta curada en vez de tono libre: mantiene la tienda dentro del mundo
// medieval oscuro del sitio en lugar de soltar fucsias sobre el pergamino.
// El color se busca primero por lo que vende la tienda (forja → metal frío,
// consumibles → ámbar...) y sólo si nada encaja se cae al hash del id, que
// al menos garantiza un color estable. Es color y nada más: seguimos sin
// etiquetar oficios en pantalla, que acababa llamando "Herrería" a una
// tienda llamada Ejército.
const TEMAS: { claves: string[]; tema: TemaTienda }[] = [
  // forja y metal: acero pulido, frío y duro
  {
    claves: ["forja", "herrer", "yunque", "martillo", "acero", "hierro", "fragua", "metal"],
    tema: { accent: "#9fb3c8", deep: "#141b22" },
  },
  // consumibles y taberna: ámbar de poción y cerveza
  {
    claves: ["consumible", "poci", "alquim", "taberna", "posada", "cervec", "brebaje", "vívere", "vivere", "comida", "botica", "bótica"],
    tema: { accent: "#eab308", deep: "#2a2109" },
  },
  // herbolario: verde de hoja seca
  {
    claves: ["herbol", "hierba", "botánic", "botanic", "jardín", "jardin", "semilla", "raíz", "raiz"],
    tema: { accent: "#4d7c3f", deep: "#131f11" },
  },
  // arcano: violeta de conjuro
  {
    claves: ["arcan", "magia", "mágic", "magic", "hechic", "conjuro", "místic", "mistic", "runa", "ocult"],
    tema: { accent: "#7c3aed", deep: "#1b1130" },
  },
  // joyería y banca: oro
  {
    claves: ["joy", "gema", "tesoro", "oro", "banco", "orfebr", "diamante", "corona"],
    tema: { accent: "#d4af37", deep: "#251d09" },
  },
  // armería y guerra: sangre
  {
    claves: ["armer", "arma", "espada", "guerra", "ejércit", "ejercit", "cuartel", "milic", "mercenar", "batalla"],
    tema: { accent: "#9f1239", deep: "#2a0a15" },
  },
  // escriba y biblioteca: cobre de pergamino
  {
    claves: ["pergamin", "bibliot", "escriba", "libro", "tomo", "cartógraf", "cartograf", "sastr", "cuero", "textil"],
    tema: { accent: "#a1663b", deep: "#231509" },
  },
  // reliquias y muerte: hueso
  {
    claves: ["reliqui", "hueso", "nigroman", "cripta", "tumba", "osari", "profan"],
    tema: { accent: "#8a8578", deep: "#1a1917" },
  },
  // sin temática reconocida: azul de puesto genérico (sólo por hash)
  { claves: [], tema: { accent: "#3b7ea1", deep: "#0d1c26" } },
  { claves: [], tema: { accent: "#c2410c", deep: "#2a1409" } },
];

const PALETA = TEMAS.map((t) => t.tema);

/**
 * Color del puesto. `texto` es el nombre (y opcionalmente la descripción) de la
 * tienda: si menciona su oficio manda esa temática; si no, el hash del id.
 */
export function temaTienda(shopId: string, texto?: string): TemaTienda {
  const t = texto?.toLowerCase();
  if (t) {
    for (const { claves, tema } of TEMAS) {
      if (claves.some((k) => t.includes(k))) return tema;
    }
  }
  return PALETA[hash(shopId) % PALETA.length];
}

// ── Voz del tendero ─────────────────────────────────────────────────────────

export type SituacionTendero =
  | "bienvenida"
  | "anadido"
  | "caro"
  | "sinOro"
  | "sinStock"
  | "compra"
  | "vacio";

const FRASES: Record<SituacionTendero, string[]> = {
  bienvenida: [
    "Pasa, pasa. Aquí nadie se va con las manos vacías.",
    "Cierra bien el toldo al entrar, que se cuela el frío.",
    "Mira todo lo que quieras. Tocar ya es otra cosa.",
    "Buen día. O malo, según lo que vengas buscando.",
  ],
  anadido: [
    "Buen ojo tienes.",
    "Ese lleva semanas esperándote.",
    "Ah, ese. A mí también me costó soltarlo.",
    "Marchando. ¿Algo más?",
  ],
  caro: [
    "Ese es de los caros. Y de los buenos.",
    "Cuesta lo que cuesta porque vale lo que vale.",
    "Con eso me pagas el invierno entero, forastero.",
  ],
  sinOro: [
    "Con lo que llevas encima no te alcanza, me temo.",
    "Vuelve cuando la bolsa te pese más.",
    "El fiado se lo di a otro y aún lo estoy buscando.",
  ],
  sinStock: [
    "De eso ya no queda. Se lo llevó alguien con más prisa.",
    "Último que había. Vuelve la semana que viene.",
  ],
  compra: [
    "Trato hecho. Que te dure.",
    "Un placer. Y no lo rompas el primer día.",
    "Vete con cuidado ahí fuera.",
    "Vuelve cuando quieras, sabes dónde estoy.",
  ],
  vacio: [
    "Cuando decidas, aquí sigo.",
    "El mostrador está vacío. Como mi paciencia, casi.",
  ],
};

/**
 * Frase del tendero para una situación. `variante` la hace rotar sin recurrir
 * al azar: al subirla (un contador de interacciones) el tendero no repite.
 */
export function fraseTendero(
  situacion: SituacionTendero,
  shopId: string,
  variante = 0,
): string {
  const opciones = FRASES[situacion];
  return opciones[(hash(shopId) + variante) % opciones.length];
}
