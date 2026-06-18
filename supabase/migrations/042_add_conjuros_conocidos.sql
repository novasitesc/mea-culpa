-- ============================================================
-- MEA CULPA — Adición de Conjuros Conocidos y Catálogo Normalizado
-- ============================================================
-- Migración 042: Agrega soporte para guardar conjuros por personaje
-- e implementa el catálogo de conjuros normalizado (Opción 2).
-- ============================================================

BEGIN;

-- 1. Agregar columna JSONB a personajes para almacenar su lista actual de SpellEntry
ALTER TABLE personajes 
ADD COLUMN IF NOT EXISTS conjuros_conocidos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Tabla maestra de Conjuros (Catálogo Global)
CREATE TABLE IF NOT EXISTS conjuros (
    nombre            TEXT PRIMARY KEY,
    nivel             INT NOT NULL CHECK (nivel BETWEEN 0 AND 9),
    escuela           TEXT NOT NULL,
    categoria         TEXT NOT NULL,
    alcance           TEXT NOT NULL,
    duracion          TEXT NOT NULL,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla intermedia para Clases permitidas (Relación Muchos a Muchos)
CREATE TABLE IF NOT EXISTS conjuro_clases (
    conjuro_nombre    TEXT REFERENCES conjuros(nombre) ON DELETE CASCADE,
    nombre_clase      TEXT NOT NULL,
    PRIMARY KEY (conjuro_nombre, nombre_clase)
);

-- 4. Tabla intermedia para Libros / Origen (Relación Muchos a Muchos)
CREATE TABLE IF NOT EXISTS conjuro_libros (
    conjuro_nombre    TEXT REFERENCES conjuros(nombre) ON DELETE CASCADE,
    libro_origen      TEXT NOT NULL,
    PRIMARY KEY (conjuro_nombre, libro_origen)
);

-- ============================================================
-- SEGURIDAD (Row Level Security - RLS)
-- ============================================================
ALTER TABLE conjuros ENABLE ROW LEVEL SECURITY;
ALTER TABLE conjuro_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conjuro_libros ENABLE ROW LEVEL SECURITY;

-- Catálogos públicos de sólo lectura para cualquier cliente autenticado
CREATE POLICY conjuros_select ON conjuros FOR SELECT USING (true);
CREATE POLICY conjuro_clases_select ON conjuro_clases FOR SELECT USING (true);
CREATE POLICY conjuro_libros_select ON conjuro_libros FOR SELECT USING (true);

COMMIT;
