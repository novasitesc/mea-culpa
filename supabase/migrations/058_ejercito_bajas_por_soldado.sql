-- ============================================================
-- MEA CULPA — Migración 058
-- Las bajas de ejército se cuentan por SOLDADO, no por regimiento.
--
-- Modelo anterior: `ejercito_objetos.cantidad` son regimientos y
-- `objetos.soldados` los soldados de cada uno. El DM solo podía restar
-- regimientos, así que "matar 1" en un regimiento de ogros se llevaba a los 20
-- soldados de golpe: no había forma de ir bajándolos de a pocos.
--
-- Se añade el contador de caídos de la casilla. Los soldados en pie son
--
--     cantidad * objetos.soldados - soldados_caidos
--
-- Guardar los CAÍDOS (y no los vivos) tiene una ventaja concreta: comprar más
-- regimientos sigue siendo un `cantidad = cantidad + n` en `comprar_en_tienda`,
-- sin tocar la RPC — la capacidad sube y los caídos se quedan como estaban.
-- ============================================================

BEGIN;

ALTER TABLE ejercito_objetos
  ADD COLUMN IF NOT EXISTS soldados_caidos INT NOT NULL DEFAULT 0
    CHECK (soldados_caidos >= 0);

COMMENT ON COLUMN ejercito_objetos.soldados_caidos IS
  'Soldados muertos en esta casilla. En pie = cantidad * objetos.soldados - soldados_caidos. La casilla se libera cuando no queda nadie.';

COMMIT;
