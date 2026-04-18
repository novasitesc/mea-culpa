-- ============================================================
-- MEA CULPA - Migracion 019
-- Descanso obligatorio tras partida finalizada
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.descansos_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  personaje_id BIGINT NOT NULL REFERENCES public.personajes(id) ON DELETE CASCADE,
  partida_id UUID REFERENCES public.partidas(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (personaje_id)
);

CREATE INDEX IF NOT EXISTS idx_descansos_pendientes_usuario
  ON public.descansos_pendientes (usuario_id, creado_en);

COMMIT;
