-- ============================================================
-- MEA CULPA — Migración 011
-- Referenciar transacciones_objetos con partidas
-- ============================================================

ALTER TABLE public.transacciones_objetos
  ADD COLUMN IF NOT EXISTS partida_id UUID REFERENCES public.partidas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacciones_objetos_partida
  ON public.transacciones_objetos (partida_id);
