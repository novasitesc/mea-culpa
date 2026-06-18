-- Agregar soporte de oro a dados_subtabla_caras
ALTER TABLE dados_subtabla_caras
  ADD COLUMN tipo    TEXT NOT NULL DEFAULT 'nada' CHECK (tipo IN ('nada', 'item', 'oro')),
  ADD COLUMN oro_min INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN oro_max INTEGER NOT NULL DEFAULT 0;

-- Migrar filas existentes: si tienen objeto_id asignado → 'item', si no → 'nada'
UPDATE dados_subtabla_caras
  SET tipo = CASE WHEN objeto_id IS NOT NULL THEN 'item' ELSE 'nada' END;
