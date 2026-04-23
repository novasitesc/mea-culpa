-- Add a third ring slot to character equipment.

BEGIN;

ALTER TABLE equipamiento_personaje
  ADD COLUMN IF NOT EXISTS anillo3 BIGINT REFERENCES objetos(id) ON DELETE SET NULL;

COMMIT;
