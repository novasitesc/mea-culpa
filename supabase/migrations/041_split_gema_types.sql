-- Split gems into weapon and cape variants.

BEGIN;

ALTER TABLE objetos
  DROP CONSTRAINT IF EXISTS objetos_tipo_item_check;

ALTER TABLE objetos
  ADD CONSTRAINT objetos_tipo_item_check
  CHECK (
    tipo_item IN (
      'cabeza','pecho','guante','botas',
      'collar','anillo','amuleto','cinturón','capa',
      'arma','gema-arma','gema-capa','accesorio-arma','accesorio-capa',
      'consumible','ingrediente','misc'
    )
  );

UPDATE objetos
SET tipo_item = 'gema-arma'
WHERE tipo_item = 'gema';

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Gema de Capa Menor',
  'Gema para engastar en slots de capa.',
  '🪶',
  'gema-capa',
  'poco común',
  450
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Gema de Capa Menor'
);

COMMIT;
