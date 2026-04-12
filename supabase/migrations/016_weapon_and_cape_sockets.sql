-- Añade soporte de sockets para armas y capa.
-- Armas: 3 sockets por mano para items tipo 'accesorio-arma'
-- Capa:  slot principal + 3 sockets para items tipo 'accesorio-capa'

BEGIN;

-- 1) Extender tipos permitidos en objetos.tipo_item
ALTER TABLE objetos
  DROP CONSTRAINT IF EXISTS objetos_tipo_item_check;

ALTER TABLE objetos
  ADD CONSTRAINT objetos_tipo_item_check
  CHECK (
    tipo_item IN (
      'cabeza','pecho','guante','botas',
      'collar','anillo','amuleto','cinturón','capa',
      'arma','accesorio-arma','accesorio-capa',
      'consumible','ingrediente','misc'
    )
  );

-- 2) Extender equipamiento_personaje con slot de capa y sockets
ALTER TABLE equipamiento_personaje
  ADD COLUMN IF NOT EXISTS capa BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_izquierda_socket_1 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_izquierda_socket_2 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_izquierda_socket_3 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_derecha_socket_1 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_derecha_socket_2 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mano_derecha_socket_3 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capa_socket_1 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capa_socket_2 BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capa_socket_3 BIGINT REFERENCES objetos(id) ON DELETE SET NULL;



-- 4) Objetos base para probar sockets (si no existen)
INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Engaste de Rubí',
  'Accesorio para arma. Añade un pequeño bono ofensivo.',
  '💠',
  'accesorio-arma',
  'poco común',
  350
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Engaste de Rubí'
);

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Núcleo de Hielo',
  'Accesorio para arma. Potencia efectos de control.',
  '❄️',
  'accesorio-arma',
  'raro',
  600
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Núcleo de Hielo'
);

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Broche Arcano de Capa',
  'Accesorio para capa. Refuerza la defensa mágica.',
  '🪶',
  'accesorio-capa',
  'poco común',
  300
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Broche Arcano de Capa'
);

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza, precio)
SELECT
  'Forro Rúnico',
  'Accesorio para capa. Mejora la estabilidad de encantamientos.',
  '🧵',
  'accesorio-capa',
  'raro',
  550
WHERE NOT EXISTS (
  SELECT 1 FROM objetos WHERE nombre = 'Forro Rúnico'
);

COMMIT;
