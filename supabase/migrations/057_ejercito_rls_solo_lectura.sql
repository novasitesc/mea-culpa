-- ============================================================
-- MEA CULPA — Migración 057
-- El ejército vuelve a ser de solo lectura para el cliente.
--
-- La 056 creó políticas INSERT/UPDATE/DELETE de `ejercito_objetos` para el dueño
-- del personaje. Con la anon key y su propio JWT, un jugador se fabricaba
-- unidades gratis:
--
--   POST /rest/v1/ejercito_objetos
--   {"personaje_id": <suyo>, "objeto_id": <cualquiera>, "cantidad": 999}
--   → 201 Created, sin pagar oro
--
-- Nada del frontend escribe en esta tabla: las unidades entran por
-- `comprar_en_tienda` (service_role), se leen en /api/profile y
-- /api/partidas/[id]/sala, y el DM las elimina por
-- /api/admin/personajes/ejercito. Se aplica el mismo principio que la 005:
-- el cliente lee, el servidor escribe.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS ejercito_insert ON ejercito_objetos;
DROP POLICY IF EXISTS ejercito_update ON ejercito_objetos;
DROP POLICY IF EXISTS ejercito_delete ON ejercito_objetos;

-- Se conservan:
--   ejercito_select    → el dueño ve el ejército de sus personajes
--   ejercito_admin_all → el DM manda sobre el ejército de cualquiera

COMMIT;
