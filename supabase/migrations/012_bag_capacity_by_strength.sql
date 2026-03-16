-- Recalcula la capacidad de bolsa con base en fuerza (no constitución)
-- Regla: base 10 + floor((fuerza - 10) / 2), mínimo 10.

CREATE OR REPLACE FUNCTION sync_capacidad_bolsa_from_fuerza()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE personajes
  SET capacidad_bolsa = GREATEST(10 + FLOOR((NEW.fuerza - 10) / 2.0)::INT, 10)
  WHERE id = NEW.personaje_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_capacidad_bolsa_from_fuerza ON estadisticas_personaje;

CREATE TRIGGER trg_sync_capacidad_bolsa_from_fuerza
AFTER INSERT OR UPDATE OF fuerza ON estadisticas_personaje
FOR EACH ROW
EXECUTE FUNCTION sync_capacidad_bolsa_from_fuerza();

-- Backfill para mantener consistencia en personajes ya existentes.
UPDATE personajes p
SET capacidad_bolsa = GREATEST(10 + FLOOR((ep.fuerza - 10) / 2.0)::INT, 10)
FROM estadisticas_personaje ep
WHERE ep.personaje_id = p.id;
