-- ============================================================
-- MEA CULPA — Migración 010
-- Partidas administradas por staff + recompensas registradas
-- ============================================================

-- ============================================================
-- 1. PARTIDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partidas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT        NOT NULL,
  comentario    TEXT        NOT NULL DEFAULT '',
  creada_por    UUID        REFERENCES public.perfiles(id) ON DELETE SET NULL,
  estado        TEXT        NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','finalizada')),
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partidas_creada_en
  ON public.partidas (creada_en DESC);

-- ============================================================
-- 2. PARTICIPANTES DE PARTIDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partida_participantes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id    UUID        NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  personaje_id  BIGINT      NOT NULL REFERENCES public.personajes(id) ON DELETE RESTRICT,
  usuario_id    UUID        REFERENCES public.perfiles(id) ON DELETE SET NULL,
  invitado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  oro_delta     INT         NOT NULL DEFAULT 0 CHECK (oro_delta >= 0),
  comentario    TEXT        NOT NULL DEFAULT '',
  muerto        BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_partida_participantes_partida
  ON public.partida_participantes (partida_id);

CREATE INDEX IF NOT EXISTS idx_partida_participantes_personaje
  ON public.partida_participantes (personaje_id);

-- ============================================================
-- 3. RLS (solo admins)
-- ============================================================
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partida_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY partidas_admin_select ON public.partidas
  FOR SELECT USING (public.current_user_es_admin());

CREATE POLICY partidas_admin_insert ON public.partidas
  FOR INSERT WITH CHECK (public.current_user_es_admin());

CREATE POLICY partidas_admin_update ON public.partidas
  FOR UPDATE USING (public.current_user_es_admin()) WITH CHECK (public.current_user_es_admin());

CREATE POLICY partida_participantes_admin_select ON public.partida_participantes
  FOR SELECT USING (public.current_user_es_admin());

CREATE POLICY partida_participantes_admin_insert ON public.partida_participantes
  FOR INSERT WITH CHECK (public.current_user_es_admin());

CREATE POLICY partida_participantes_admin_update ON public.partida_participantes
  FOR UPDATE USING (public.current_user_es_admin()) WITH CHECK (public.current_user_es_admin());
