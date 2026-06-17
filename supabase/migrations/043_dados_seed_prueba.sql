-- Recompensas de prueba para el módulo de dados
-- Cubre los tres tipos: item_fijo, sublista y oro_dados

BEGIN;

-- ─── 1. Ítem fijo: siempre entrega una Poción de Curación (D6, gratis) ───────
INSERT INTO dados_recompensas
  (nombre, descripcion, tipo, tipo_dado, costo_oro, activo, orden, objeto_id, cantidad_dados, multiplicador_oro)
SELECT
  'Cofre del Sanador',
  'Tira el dado y recibe una Poción de Curación garantizada.',
  'item_fijo',
  'd6',
  0,
  true,
  1,
  id,
  1,
  1
FROM objetos WHERE nombre = 'Poción de Curación'
LIMIT 1;

-- ─── 2. Sublista D6: cada resultado mapea a un objeto distinto ───────────────
INSERT INTO dados_recompensas
  (nombre, descripcion, tipo, tipo_dado, costo_oro, activo, orden, objeto_id, cantidad_dados, multiplicador_oro)
VALUES
  ('Botín de Aventurero', 'Tira el D6 y descubre qué objeto del botín te corresponde.', 'sublista', 'd6', 50, true, 2, NULL, 1, 1);

-- Filas de la sublista (resultado 1–6 → objeto distinto)
INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 1, 1, 0
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Antídoto';

INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 2, 2, 1
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Poción de Curación Menor';

INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 3, 3, 2
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Kit de Ladrón';

INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 4, 4, 3
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Hierba de Aura Tranquila';

INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 5, 5, 4
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Bomba de Humo';

INSERT INTO dados_sublista_items (recompensa_id, objeto_id, valor_min, valor_max, orden)
SELECT r.id, o.id, 6, 6, 5
FROM dados_recompensas r, objetos o
WHERE r.nombre = 'Botín de Aventurero' AND o.nombre = 'Raíz de Lunar';

-- ─── 3. Oro por dados: 2D20 × 10 (cuesta 100 oro) ────────────────────────────
INSERT INTO dados_recompensas
  (nombre, descripcion, tipo, tipo_dado, costo_oro, activo, orden, objeto_id, cantidad_dados, multiplicador_oro)
VALUES
  (
    'Apuesta del Dragón',
    'Lanza 2 dados de 20 caras. Cada punto vale 10 monedas de oro.',
    'oro_dados',
    'd20',
    100,
    true,
    3,
    NULL,
    2,
    10
  );

COMMIT;
