-- ============================================================
-- MEA CULPA — Migración 005
-- Cierre de vulnerabilidades de integridad de juego.
--
-- Principio: el cliente (anon/authenticated) solo puede leer.
-- Toda escritura pasa por API routes con service_role.
-- ============================================================

-- ============================================================
-- 1. PERFILES — el cliente no puede escribir ningún campo.
--    El perfil se crea por trigger y se edita solo desde el servidor.
-- ============================================================
DROP POLICY IF EXISTS perfiles_insert ON perfiles;
DROP POLICY IF EXISTS perfiles_update ON perfiles;

-- (perfiles_select se conserva: el usuario puede leer su propio perfil)

-- ============================================================
-- 2. PERSONAJES — el cliente no puede insertar ni modificar.
--    La creación y edición pasan por /api/profile/create-character
--    y otras rutas protegidas con service_role.
-- ============================================================
DROP POLICY IF EXISTS personajes_insert ON personajes;
DROP POLICY IF EXISTS personajes_update ON personajes;
DROP POLICY IF EXISTS personajes_delete ON personajes;

-- ============================================================
-- 3. CLASES_PERSONAJE — solo lectura para el cliente.
-- ============================================================
DROP POLICY IF EXISTS clases_insert ON clases_personaje;
DROP POLICY IF EXISTS clases_update ON clases_personaje;
DROP POLICY IF EXISTS clases_delete ON clases_personaje;

-- ============================================================
-- 4. ESTADÍSTICAS_PERSONAJE — solo lectura para el cliente.
-- ============================================================
DROP POLICY IF EXISTS stats_insert ON estadisticas_personaje;
DROP POLICY IF EXISTS stats_update ON estadisticas_personaje;
DROP POLICY IF EXISTS stats_delete ON estadisticas_personaje;

-- ============================================================
-- 5. EQUIPAMIENTO_PERSONAJE — solo lectura para el cliente.
-- ============================================================
DROP POLICY IF EXISTS equip_insert ON equipamiento_personaje;
DROP POLICY IF EXISTS equip_update ON equipamiento_personaje;
DROP POLICY IF EXISTS equip_delete ON equipamiento_personaje;

-- ============================================================
-- 6. BOLSA_OBJETOS — solo lectura para el cliente.
--    Los objetos se añaden solo desde /api/tiendas (compra) o admin.
-- ============================================================
DROP POLICY IF EXISTS bolsa_insert ON bolsa_objetos;
DROP POLICY IF EXISTS bolsa_update ON bolsa_objetos;
DROP POLICY IF EXISTS bolsa_delete ON bolsa_objetos;

-- ============================================================
-- 7. TRANSACCIONES_OBJETOS — nadie puede insertar desde el cliente.
--    Es un log inmutable que solo escribe service_role.
-- ============================================================
DROP POLICY IF EXISTS transacciones_insert ON transacciones_objetos;

-- ============================================================
-- RESULTADO FINAL DE POLÍTICAS
-- Todas las tablas quedan en modo lectura para el cliente.
-- El service_role (API routes) bypasea RLS y puede hacer todo.
-- ============================================================
--
-- perfiles              → SELECT (dueño)
-- personajes            → SELECT (dueño)
-- clases_personaje      → SELECT (dueño via personaje)
-- estadisticas_personaje→ SELECT (dueño via personaje)
-- equipamiento_personaje→ SELECT (dueño via personaje)
-- bolsa_objetos         → SELECT (dueño via personaje)
-- transacciones_objetos → SELECT (dueño via personaje)
-- objetos               → SELECT (público)
-- tiendas               → SELECT (público)
-- articulos_tienda      → SELECT (público)
