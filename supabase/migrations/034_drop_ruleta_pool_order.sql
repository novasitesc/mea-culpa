-- ============================================================
-- MEA CULPA - Migracion 034
-- Eliminar orden de ruleta_premios_pool (pool uniforme)
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_ruleta_premios_pool_categoria_activo_orden;

ALTER TABLE public.ruleta_premios_pool
  DROP COLUMN IF EXISTS orden;

CREATE INDEX IF NOT EXISTS idx_ruleta_premios_pool_categoria_activo
  ON public.ruleta_premios_pool (categoria, activo, creado_en DESC);

COMMIT;
