-- ============================================================
-- MEA CULPA - Migracion 032
-- Auditoria de cobros masivos de impuestos desde panel admin
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.impuestos_admin_cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  monto INT NOT NULL CHECK (monto > 0),
  total_cuentas INT NOT NULL DEFAULT 0 CHECK (total_cuentas >= 0),
  total_cobrado INT NOT NULL DEFAULT 0 CHECK (total_cobrado >= 0),
  total_faltante INT NOT NULL DEFAULT 0 CHECK (total_faltante >= 0),
  muertes_aplicadas INT NOT NULL DEFAULT 0 CHECK (muertes_aplicadas >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impuestos_admin_cobros_creado_en
  ON public.impuestos_admin_cobros (creado_en DESC);

CREATE TABLE IF NOT EXISTS public.impuestos_admin_cobros_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id UUID NOT NULL REFERENCES public.impuestos_admin_cobros(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  oro_antes INT NOT NULL CHECK (oro_antes >= 0),
  monto_solicitado INT NOT NULL CHECK (monto_solicitado > 0),
  monto_cobrado INT NOT NULL CHECK (monto_cobrado >= 0),
  oro_despues INT NOT NULL CHECK (oro_despues >= 0),
  faltante INT NOT NULL CHECK (faltante >= 0),
  estado TEXT NOT NULL CHECK (
    estado IN (
      'cobrado_total',
      'cobrado_parcial_y_muerto',
      'cobrado_parcial_sin_personaje_vivo',
      'error'
    )
  ),
  personaje_id BIGINT REFERENCES public.personajes(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impuestos_admin_cobros_detalle_cobro
  ON public.impuestos_admin_cobros_detalle (cobro_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_impuestos_admin_cobros_detalle_usuario
  ON public.impuestos_admin_cobros_detalle (usuario_id, creado_en DESC);

ALTER TABLE public.impuestos_admin_cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_admin_cobros_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY impuestos_admin_cobros_select_admin ON public.impuestos_admin_cobros
  FOR SELECT
  USING (public.current_user_es_admin());

CREATE POLICY impuestos_admin_cobros_detalle_select_admin ON public.impuestos_admin_cobros_detalle
  FOR SELECT
  USING (public.current_user_es_admin());

COMMIT;
