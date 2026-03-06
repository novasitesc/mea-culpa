/**
 * mockDb.ts – Base de datos en memoria para simular llamadas a BD.
 * TODO: Reemplazar cada función con llamadas reales a Prisma/Supabase
 *       cuando la DB esté lista.
 *
 * NOTA: En Next.js (dev mode) el estado de módulo persiste entre requests,
 * por lo que las mutaciones funcionan correctamente durante el desarrollo.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  email: string;
  password: string; // solo en el "backend" – nunca se envía al cliente
  name: string;
  role: string;
  level: number;
  home: string;
  isAdmin: boolean;
  createdAt: string;
};

export type ItemRarity =
  | "común"
  | "poco común"
  | "raro"
  | "épico"
  | "legendario";
export type ItemCategory =
  | "consumible"
  | "arma"
  | "armadura"
  | "accesorio"
  | "ingrediente"
  | "misc";

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  category: ItemCategory;
  stock: number | null;
  icon: string;
};

export type Shop = {
  id: string;
  name: string;
  description: string;
  icon: string;
  keeper: string;
  location: string;
  minLevel?: number;
  items: ShopItem[];
  createdAt: string;
};

// ─── Datos de usuarios ───────────────────────────────────────────────────────

const _users: AdminUser[] = [
  {
    id: "1",
    email: "demo@meaculpa.com",
    password: "123456",
    name: "Usuario de prueba normal",
    role: "Dungeon Explorer",
    level: 7,
    home: "Eldergrove",
    isAdmin: false,
    createdAt: "2025-01-10T10:00:00.000Z",
  },
  {
    id: "2",
    email: "admin@meaculpa.com",
    password: "admin123",
    name: "Liza Darkwood",
    role: "Game Master",
    level: 20,
    home: "High Keep",
    isAdmin: true,
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "3",
    email: "thorin@meaculpa.com",
    password: "thorin456",
    name: "Thorin Brokenaxe",
    role: "Clan Warrior",
    level: 12,
    home: "Iron Mountains",
    isAdmin: false,
    createdAt: "2025-02-03T14:30:00.000Z",
  },
  {
    id: "4",
    email: "elara@meaculpa.com",
    password: "elara789",
    name: "Elara Moonwhisper",
    role: "Shadow Dancer",
    level: 9,
    home: "Silverveil",
    isAdmin: false,
    createdAt: "2025-02-20T09:15:00.000Z",
  },
];

// ─── Datos de tiendas ────────────────────────────────────────────────────────

const _shops: Shop[] = [
  {
    id: "herbalista",
    name: "La Raíz Antigua",
    description:
      "Pociones, hierbas y remedios. La vieja Mira conoce cada planta del bosque.",
    icon: "🌿",
    keeper: "Mira la Herbalista",
    location: "Plaza del Mercado",
    createdAt: "2025-01-01T00:00:00.000Z",
    items: [
      {
        id: "herbalista-001",
        name: "Poción de Curación Menor",
        description: "Restaura 2d4+2 puntos de golpe al beberla.",
        price: 50,
        rarity: "común",
        category: "consumible",
        stock: null,
        icon: "🧪",
      },
      {
        id: "herbalista-002",
        name: "Poción de Curación",
        description: "Restaura 4d4+4 puntos de golpe al beberla.",
        price: 150,
        rarity: "poco común",
        category: "consumible",
        stock: 10,
        icon: "⚗️",
      },
      {
        id: "herbalista-003",
        name: "Antídoto",
        description: "Neutraliza el veneno en el cuerpo del consumidor.",
        price: 80,
        rarity: "común",
        category: "consumible",
        stock: null,
        icon: "💊",
      },
      {
        id: "herbalista-004",
        name: "Hierba de Aura Tranquila",
        description: "Da ventaja en la próxima tirada de concentración.",
        price: 120,
        rarity: "poco común",
        category: "ingrediente",
        stock: 5,
        icon: "🍃",
      },
      {
        id: "herbalista-005",
        name: "Raíz de Lunar",
        description: "Componente para rituales de adivinación. Muy codiciada.",
        price: 300,
        rarity: "raro",
        category: "ingrediente",
        stock: 2,
        icon: "🌙",
      },
    ],
  },
  {
    id: "herrero",
    name: "La Fragua del Oso",
    description:
      "Armas y armaduras forjadas con maestría. Garuk no vende chatarra.",
    icon: "⚒️",
    keeper: "Garuk el Herrero",
    location: "Barrio del Artesano",
    createdAt: "2025-01-01T00:00:00.000Z",
    items: [
      {
        id: "herrero-001",
        name: "Espada Corta",
        description: "Daño 1d6 cortante. Versátil y ligera.",
        price: 200,
        rarity: "común",
        category: "arma",
        stock: null,
        icon: "🗡️",
      },
      {
        id: "herrero-002",
        name: "Espada Larga",
        description: "Daño 1d8 cortante o 1d10 a dos manos.",
        price: 450,
        rarity: "común",
        category: "arma",
        stock: 5,
        icon: "⚔️",
      },
      {
        id: "herrero-003",
        name: "Hacha de Batalla",
        description:
          "Daño 1d8 cortante. Favorita entre los guerreros del norte.",
        price: 400,
        rarity: "común",
        category: "arma",
        stock: 3,
        icon: "🪓",
      },
      {
        id: "herrero-004",
        name: "Cota de Malla",
        description: "CA 16. Requiere fuerza 13.",
        price: 750,
        rarity: "poco común",
        category: "armadura",
        stock: 2,
        icon: "🔗",
      },
      {
        id: "herrero-005",
        name: "Escudo de Hierro",
        description: "+2 CA. Resistente y bien templado.",
        price: 100,
        rarity: "común",
        category: "armadura",
        stock: null,
        icon: "🛡️",
      },
      {
        id: "herrero-006",
        name: "Espada Corta +1",
        description: "Daño 1d6+1 cortante. Encantada levemente.",
        price: 1200,
        rarity: "raro",
        category: "arma",
        stock: 1,
        icon: "✨",
      },
    ],
  },
  {
    id: "mercado-negro",
    name: "El Callejón Sin Nombre",
    description:
      "Si hay que preguntar el precio, no puedes pagarlo. Entra por la puerta trasera.",
    icon: "🕯️",
    keeper: "Shade",
    location: "Barrio Bajo (acceso restringido)",
    minLevel: 10,
    createdAt: "2025-01-05T00:00:00.000Z",
    items: [
      {
        id: "negro-001",
        name: "Veneno de Sombra",
        description:
          "Aplica a un arma. El objetivo debe superar CD 13 o quedará envenenado 1 hora.",
        price: 600,
        rarity: "poco común",
        category: "consumible",
        stock: 4,
        icon: "☠️",
      },
      {
        id: "negro-002",
        name: "Kit de Ladrón",
        description:
          "Herramientas de thieves' tools. +2 a intentos de abrir cerraduras.",
        price: 250,
        rarity: "común",
        category: "misc",
        stock: null,
        icon: "🔓",
      },
      {
        id: "negro-003",
        name: "Capa de Elvasión",
        description: "Ventaja en las tiradas de Sigilo en oscuridad.",
        price: 2000,
        rarity: "raro",
        category: "accesorio",
        stock: 1,
        icon: "🌑",
      },
      {
        id: "negro-004",
        name: "Pergamino Maldito",
        description:
          "Contiene un hechizo desconocido. Puede ser útil… o fatal.",
        price: 500,
        rarity: "épico",
        category: "misc",
        stock: 1,
        icon: "📜",
      },
      {
        id: "negro-005",
        name: "Bomba de Humo",
        description: "Llena un cubo de 3m de humo espeso durante 1 minuto.",
        price: 100,
        rarity: "común",
        category: "consumible",
        stock: 8,
        icon: "💨",
      },
    ],
  },
  {
    id: "templo",
    name: "Templo de la Llama Sagrada",
    description:
      "Ofrendas y servicios sagrados. La hermana Aya atiende a todos por igual.",
    icon: "🕍",
    keeper: "Hermana Aya",
    location: "Plaza Central",
    createdAt: "2025-01-01T00:00:00.000Z",
    items: [
      {
        id: "templo-001",
        name: "Agua Bendita",
        description: "Daño 2d6 radiante a no-muertos y demonios.",
        price: 25,
        rarity: "común",
        category: "consumible",
        stock: null,
        icon: "💧",
      },
      {
        id: "templo-002",
        name: "Símbolo Sagrado de Plata",
        description: "Foco arcano para clérigos y paladines.",
        price: 500,
        rarity: "poco común",
        category: "accesorio",
        stock: 3,
        icon: "✝️",
      },
      {
        id: "templo-003",
        name: "Incienso de Purificación",
        description: "Requerido para el ritual de consagración de área.",
        price: 150,
        rarity: "común",
        category: "ingrediente",
        stock: null,
        icon: "🪔",
      },
      {
        id: "templo-004",
        name: "Talismán Contra Muertos Vivientes",
        description:
          "Ventaja en tiradas de salvación contra efectos de no-muertos.",
        price: 800,
        rarity: "raro",
        category: "accesorio",
        stock: 2,
        icon: "🧿",
      },
    ],
  },
  {
    id: "magia",
    name: "Arcana Mysteria",
    description:
      "Pergaminos, componentes y varitas. El mago Elveth dice que tiene todo… si encuentras la tienda.",
    icon: "🔮",
    keeper: "Elveth el Arcano",
    location: "Torre del Mago",
    minLevel: 5,
    createdAt: "2025-01-03T00:00:00.000Z",
    items: [
      {
        id: "magia-001",
        name: "Pergamino de Misil Mágico",
        description: "Lanza Misil Mágico una vez al leerlo (nivel 1).",
        price: 75,
        rarity: "común",
        category: "consumible",
        stock: null,
        icon: "📄",
      },
      {
        id: "magia-002",
        name: "Pergamino de Bola de Fuego",
        description: "Lanza Bola de Fuego una vez al leerlo (nivel 3).",
        price: 600,
        rarity: "poco común",
        category: "consumible",
        stock: 5,
        icon: "🔥",
      },
      {
        id: "magia-003",
        name: "Bolsa de Componentes",
        description:
          "Contiene material surtido para hechizos sin coste especificado.",
        price: 25,
        rarity: "común",
        category: "misc",
        stock: null,
        icon: "👝",
      },
      {
        id: "magia-004",
        name: "Varilla de Fuerza",
        description:
          "10 cargas. Puede lanzar Escudo de Fuerza (1 carga) o Muro de Fuerza (5 cargas).",
        price: 5000,
        rarity: "épico",
        category: "accesorio",
        stock: 1,
        icon: "🪄",
      },
      {
        id: "magia-005",
        name: "Cristal de Visión Lejana",
        description: "Una vez al día: ver un lugar conocido a distancia.",
        price: 1500,
        rarity: "raro",
        category: "accesorio",
        stock: 1,
        icon: "🔭",
      },
    ],
  },
];

// ─── Helpers de usuario ───────────────────────────────────────────────────────
// TODO: Reemplazar con: prisma.user.findMany(), prisma.user.update(), etc.

export function db_getUsers(): Omit<AdminUser, "password">[] {
  return _users.map(({ password: _, ...u }) => u);
}

export function db_getUserById(id: string): AdminUser | undefined {
  return _users.find((u) => u.id === id);
}

export function db_updateUser(
  id: string,
  data: Partial<Omit<AdminUser, "id" | "createdAt">>,
): Omit<AdminUser, "password"> | null {
  const idx = _users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  _users[idx] = { ..._users[idx], ...data };
  const { password: _, ...result } = _users[idx];
  return result;
}

export function db_deleteUser(id: string): boolean {
  const idx = _users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  _users.splice(idx, 1);
  return true;
}

export function db_createUser(
  data: Omit<AdminUser, "id" | "createdAt">,
): Omit<AdminUser, "password"> {
  const newUser: AdminUser = {
    ...data,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  _users.push(newUser);
  const { password: _, ...result } = newUser;
  return result;
}

// ─── Helpers de tiendas ───────────────────────────────────────────────────────
// TODO: Reemplazar con: prisma.shop.findMany(), prisma.shop.update(), etc.

export function db_getShops(): Shop[] {
  return _shops;
}

export function db_getShopById(id: string): Shop | undefined {
  return _shops.find((s) => s.id === id);
}

export function db_updateShop(
  id: string,
  data: Partial<Omit<Shop, "id" | "createdAt" | "items">>,
): Shop | null {
  const idx = _shops.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  _shops[idx] = { ..._shops[idx], ...data };
  return _shops[idx];
}

export function db_createShop(
  data: Omit<Shop, "id" | "createdAt" | "items">,
): Shop {
  const newShop: Shop = {
    ...data,
    id: data.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, ""),
    createdAt: new Date().toISOString(),
    items: [],
  };
  _shops.push(newShop);
  return newShop;
}

export function db_deleteShop(id: string): boolean {
  const idx = _shops.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  _shops.splice(idx, 1);
  return true;
}
