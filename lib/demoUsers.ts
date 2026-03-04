export type DemoUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  level: number;
  home: string;
  isAdmin: boolean;
};

export const DEMO_USERS: DemoUser[] = [
  {
    id: "1",
    email: "demo@meaculpa.com",
    password: "123456",
    name: "Usuario de prueba normal",
    role: "Dungeon Explorer",
    level: 7,
    home: "Eldergrove",
    isAdmin: false,
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
  },
];
