-- Agrega el nuevo tipo de objeto "cinturón" y el slot de equipamiento "cinturon"

BEGIN;

ALTER TABLE objetos
  DROP CONSTRAINT IF EXISTS objetos_tipo_item_check;

ALTER TABLE objetos
  ADD CONSTRAINT objetos_tipo_item_check
  CHECK (
    tipo_item IN (
      'cabeza','pecho','guante','botas',
      'collar','anillo','amuleto','cinturón','arma',
      'consumible','ingrediente','misc'
    )
  );

ALTER TABLE equipamiento_personaje
  ADD COLUMN IF NOT EXISTS cinturon BIGINT REFERENCES objetos(id) ON DELETE SET NULL;

COMMIT;
