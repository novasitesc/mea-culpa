/**
 * GUÍA DE MIGRACIÓN A BASE DE DATOS
 * 
 * Este archivo documenta cómo migrar del sistema actual en memoria a una base de datos.
 * Puedes usar cualquier ORM (Drizzle, Prisma, TypeORM) o SQL directo.
 */

// ============================================================================
// 1. ESQUEMA DE BASE DE DATOS RECOMENDADO
// ============================================================================

/*
-- Tabla de usuarios (ya la tienes o la crearás)
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  level INTEGER DEFAULT 1,
  home VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de personajes
CREATE TABLE characters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  class VARCHAR(100) NOT NULL,
  race VARCHAR(100) NOT NULL,
  alignment VARCHAR(100) NOT NULL,
  background VARCHAR(100) NOT NULL,
  portrait VARCHAR(500) DEFAULT '/characters/profileplaceholder.webp',
  
  -- Stats como JSON o columnas separadas
  stats JSON NOT NULL,
  
  -- Equipo como JSON
  armor JSON NOT NULL,
  accessories JSON NOT NULL,
  weapons JSON NOT NULL,
  bag JSON NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_characters (user_id)
);
*/

// ============================================================================
// 2. EJEMPLO CON DRIZZLE ORM (recomendado para TypeScript)
// ============================================================================

/*
// database/schema.ts
import { pgTable, varchar, integer, bigint, json, timestamp } from 'drizzle-orm/pg-core';

export const characters = pgTable('characters', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  class: varchar('class', { length: 100 }).notNull(),
  race: varchar('race', { length: 100 }).notNull(),
  alignment: varchar('alignment', { length: 100 }).notNull(),
  background: varchar('background', { length: 100 }).notNull(),
  portrait: varchar('portrait', { length: 500 }).default('/characters/profileplaceholder.webp'),
  stats: json('stats').$type<Record<string, number>>().notNull(),
  armor: json('armor').$type<ArmorSlots>().notNull(),
  accessories: json('accessories').$type<AccessorySlots>().notNull(),
  weapons: json('weapons').$type<WeaponSlots>().notNull(),
  bag: json('bag').$type<Bag>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
*/

// ============================================================================
// 3. MODIFICACIONES NECESARIAS EN LOS ENDPOINTS
// ============================================================================

/*
// app/api/profile/route.ts - GET
import { db } from '@/database/connection';
import { characters } from '@/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Consultar personajes del usuario desde BD
  const userCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId));

  return NextResponse.json({
    player: {
      name: foundUser.name,
      role: foundUser.role,
      level: foundUser.level,
      home: foundUser.home,
    },
    characters: userCharacters,
    userId,
  });
}
*/

/*
// app/api/profile/create-character/route.ts
import { db } from '@/database/connection';
import { characters } from '@/database/schema';
import { eq, count } from 'drizzle-orm';

export async function POST(request: Request) {
  // ... (validaciones existentes)
  
  // Verificar límite de personajes en BD
  const [{ count: charCount }] = await db
    .select({ count: count() })
    .from(characters)
    .where(eq(characters.userId, userId));
  
  if (charCount >= 5) {
    return NextResponse.json(
      { error: "Character limit reached. Maximum 5 characters per user." },
      { status: 400 }
    );
  }
  
  // Insertar nuevo personaje
  const [newCharacter] = await db.insert(characters).values({
    userId,
    name,
    class: className,
    race,
    alignment,
    background,
    portrait: "/characters/profileplaceholder.webp",
    stats,
    armor,
    accessories,
    weapons,
    bag: { items: [], maxSlots },
  }).returning();
  
  return NextResponse.json({
    success: true,
    message: "Character created successfully",
    character: newCharacter,
  });
}
*/

/*
// app/api/profile/update-bag/route.ts
import { db } from '@/database/connection';
import { characters } from '@/database/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  const { userId, characterId, bagItems, armor, accessories, weapons } = await request.json();
  
  // ... (validaciones)
  
  // Actualizar en BD
  await db.update(characters)
    .set({
      bag: { items: bagItems, maxSlots: bagItems.maxSlots || 10 },
      armor,
      accessories,
      weapons,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(characters.id, characterId),
        eq(characters.userId, userId)
      )
    );
  
  return NextResponse.json({
    success: true,
    message: "Character updated successfully",
  });
}
*/

// ============================================================================
// 4. PASOS PARA MIGRAR
// ============================================================================

/*
PASO 1: Instalar dependencias
  npm install drizzle-orm @libsql/client
  npm install -D drizzle-kit

PASO 2: Configurar conexión a BD
  - Crear archivo database/connection.ts
  - Configurar variables de entorno (DATABASE_URL)

PASO 3: Definir esquema
  - Crear database/schema.ts con las tablas

PASO 4: Generar y ejecutar migraciones
  npx drizzle-kit generate
  npx drizzle-kit migrate

PASO 5: Reemplazar código de los endpoints
  - Eliminar charactersByUser de route.ts
  - Reemplazar funciones helper con queries a BD
  - Actualizar create-character y update-bag

PASO 6: Probar
  - Verificar creación de personajes
  - Verificar actualización de equipo
  - Verificar límite de 5 personajes

PASO 7: (Opcional) Migrar datos de prueba
  - Insertar personajes demo en BD
*/

// ============================================================================
// 5. VENTAJAS DEL CÓDIGO ACTUAL
// ============================================================================

/*
✅ Separación clara de responsabilidades
✅ Validaciones en ambos lados (frontend/backend)
✅ Tipos TypeScript bien definidos
✅ Estructura lista para transición a BD
✅ TODOs marcados claramente
✅ Lógica de negocio (stats, equipo) independiente de almacenamiento
✅ Manejo de errores apropiado
✅ Estado local sincronizado con backend
*/
