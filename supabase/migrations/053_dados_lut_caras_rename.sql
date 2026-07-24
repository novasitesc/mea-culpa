-- ============================================================
-- MEA CULPA — Migración 053
-- dados_lut_caras: decir la verdad en los nombres (dado.md §8.3).
-- En caras tipo='oro', cantidad_dados guardaba oro_min y
-- multiplicador_oro guardaba oro_max; tipo_dado_oro siempre fue NULL.
-- Si algún día se quiere "NdX × multiplicador", añadir columnas
-- nuevas con ese nombre — no reciclar.
-- ============================================================

ALTER TABLE dados_lut_caras RENAME COLUMN cantidad_dados TO oro_min;
ALTER TABLE dados_lut_caras RENAME COLUMN multiplicador_oro TO oro_max;
ALTER TABLE dados_lut_caras DROP COLUMN tipo_dado_oro;
