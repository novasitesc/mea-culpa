-- Add explicit metadata for weapons that occupy both hands.

BEGIN;

ALTER TABLE objetos
  ADD COLUMN IF NOT EXISTS requiere_dos_manos BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE objetos
SET requiere_dos_manos = TRUE
WHERE nombre = 'Espada Larga';

COMMIT;