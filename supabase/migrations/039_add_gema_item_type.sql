-- Add support for gemstone items equipable in weapon slots.

BEGIN;

ALTER TABLE objetos
  DROP CONSTRAINT IF EXISTS objetos_tipo_item_check;

ALTER TABLE objetos
  ADD CONSTRAINT objetos_tipo_item_check
  CHECK (
    tipo_item IN (
      'cabeza','pecho','guante','botas',
      'collar','anillo','amuleto','cinturón','capa',
      'arma','gema','accesorio-arma','accesorio-capa',
      'consumible','ingrediente','misc'
    )
  );

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Gema Ígnea Menor',
  'Gema para engastar en slots de arma.',
  '💠',
  'gema',
  'poco común',
  450
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Gema Ígnea Menor'
);

COMMIT;
