-- Rango de cantidad para ítems en caras LUT y subtabla
-- Permite configurar min/max de unidades al igual que el rango de oro

ALTER TABLE dados_lut_caras
  ADD COLUMN cantidad_min integer NOT NULL DEFAULT 1,
  ADD COLUMN cantidad_max integer NOT NULL DEFAULT 1;

ALTER TABLE dados_subtabla_caras
  ADD COLUMN cantidad_min integer NOT NULL DEFAULT 1,
  ADD COLUMN cantidad_max integer NOT NULL DEFAULT 1;
