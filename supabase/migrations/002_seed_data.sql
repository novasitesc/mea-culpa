-- ============================================================
-- MEA CULPA — Datos iniciales (seed)
-- ============================================================
-- Migra los datos hardcodeados de /app/api/tiendas/route.ts
-- al esquema de base de datos.
-- Ejecutar después de 001_initial_schema.sql.
-- ============================================================

BEGIN;

-- ============================================================
-- OBJETOS — Catálogo global de items del juego
-- ============================================================

INSERT INTO objetos (nombre, descripcion, icono, tipo_item, rareza) VALUES

  -- Herbalista
  ('Poción de Curación Menor',         'Restaura 2d4+2 puntos de golpe al beberla.',                                           '🧪', 'consumible',  'común'),
  ('Poción de Curación',               'Restaura 4d4+4 puntos de golpe al beberla.',                                           '⚗️', 'consumible',  'poco común'),
  ('Antídoto',                         'Neutraliza el veneno en el cuerpo del consumidor.',                                    '💊', 'consumible',  'común'),
  ('Hierba de Aura Tranquila',         'Da ventaja en la próxima tirada de concentración.',                                    '🍃', 'ingrediente', 'poco común'),
  ('Raíz de Lunar',                    'Componente para rituales de adivinación. Muy codiciada.',                              '🌙', 'ingrediente', 'raro'),

  -- Herrero
  ('Espada Corta',                     'Daño 1d6 cortante. Versátil y ligera.',                                                '🗡️', 'arma',        'común'),
  ('Espada Larga',                     'Daño 1d8 cortante o 1d10 a dos manos.',                                               '⚔️', 'arma',        'común'),
  ('Hacha de Batalla',                 'Daño 1d8 cortante. Favorita entre los guerreros del norte.',                          '🪓', 'arma',        'común'),
  ('Cota de Malla',                    'CA 16. Requiere fuerza 13.',                                                           '🔗', 'pecho',       'poco común'),
  ('Escudo de Hierro',                 '+2 CA. Resistente y bien templado.',                                                   '🛡️', 'arma',        'común'),
  ('Espada Corta +1',                  'Daño 1d6+1 cortante. Encantada levemente.',                                           '✨', 'arma',        'raro'),

  -- Mercado Negro
  ('Veneno de Sombra',                 'Aplica a un arma. El objetivo debe superar CD 13 o quedará envenenado 1 hora.',       '☠️', 'consumible',  'poco común'),
  ('Kit de Ladrón',                    'Herramientas de thieves'' tools. +2 a intentos de abrir cerraduras.',                 '🔓', 'misc',        'común'),
  ('Capa de Evasión',                  'Ventaja en las tiradas de Sigilo en oscuridad.',                                       '🌑', 'misc',        'raro'),
  ('Pergamino Maldito',                'Contiene un hechizo desconocido. Puede ser útil… o fatal.',                           '📜', 'misc',        'épico'),
  ('Bomba de Humo',                    'Llena un cubo de 3m de humo espeso durante 1 minuto.',                                '💨', 'consumible',  'común'),

  -- Templo
  ('Agua Bendita',                     'Daño 2d6 radiante a no-muertos y demonios.',                                          '💧', 'consumible',  'común'),
  ('Símbolo Sagrado de Plata',         'Foco arcano para clérigos y paladines.',                                              '✝️', 'amuleto',     'poco común'),
  ('Incienso de Purificación',         'Requerido para el ritual de consagración de área.',                                   '🪔', 'ingrediente', 'común'),
  ('Talismán Contra Muertos Vivientes','Ventaja en tiradas de salvación contra efectos de no-muertos.',                       '🧿', 'amuleto',     'raro'),

  -- Arcana Mysteria
  ('Pergamino de Misil Mágico',        'Lanza Misil Mágico una vez al leerlo (nivel 1).',                                    '📄', 'consumible',  'común'),
  ('Pergamino de Bola de Fuego',       'Lanza Bola de Fuego una vez al leerlo (nivel 3).',                                   '🔥', 'consumible',  'poco común'),
  ('Bolsa de Componentes',             'Contiene material surtido para hechizos sin coste especificado.',                     '👝', 'misc',        'común'),
  ('Varilla de Fuerza',                '10 cargas. Puede lanzar Escudo de Fuerza (1 carga) o Muro de Fuerza (5 cargas).',   '🪄', 'arma',        'épico'),
  ('Cristal de Visión Lejana',         'Una vez al día: ver un lugar conocido a distancia.',                                  '🔭', 'amuleto',     'raro');

-- ============================================================
-- TIENDAS
-- ============================================================

INSERT INTO tiendas (id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo, orden) VALUES
  ('herbalista',    'La Raíz Antigua',           'Pociones, hierbas y remedios. La vieja Mira conoce cada planta del bosque.',                                            '🌿', 'Mira la Herbalista', 'Plaza del Mercado',              NULL, 1),
  ('herrero',       'La Fragua del Oso',          'Armas y armaduras forjadas con maestría. Garuk no vende chatarra.',                                                    '⚒️', 'Garuk el Herrero',   'Barrio del Artesano',            NULL, 2),
  ('mercado-negro', 'El Callejón Sin Nombre',     'Si hay que preguntar el precio, no puedes pagarlo. Entra por la puerta trasera.',                                       '🕯️', 'Shade',              'Barrio Bajo (acceso restringido)', 10,  3),
  ('templo',        'Templo de la Llama Sagrada', 'Ofrendas y servicios sagrados. La hermana Aya atiende a todos por igual.',                                             '🕍', 'Hermana Aya',        'Plaza Central',                  NULL, 4),
  ('magia',         'Arcana Mysteria',            'Pergaminos, componentes y varitas. El mago Elveth dice que tiene todo… si encuentras la tienda.',                      '🔮', 'Elveth el Arcano',   'Torre del Mago',                  5,  5);

-- ============================================================
-- ARTICULOS_TIENDA — Productos por tienda
-- (precio, stock y orden son propios de la tienda;
--  nombre, icono y tipo vienen del catálogo objetos)
-- ============================================================

INSERT INTO articulos_tienda (tienda_id, objeto_id, precio, inventario, orden)
SELECT 'herbalista', id, 50,  NULL, 1 FROM objetos WHERE nombre = 'Poción de Curación Menor'         UNION ALL
SELECT 'herbalista', id, 150, 10,   2 FROM objetos WHERE nombre = 'Poción de Curación'               UNION ALL
SELECT 'herbalista', id, 80,  NULL, 3 FROM objetos WHERE nombre = 'Antídoto'                         UNION ALL
SELECT 'herbalista', id, 120, 5,    4 FROM objetos WHERE nombre = 'Hierba de Aura Tranquila'         UNION ALL
SELECT 'herbalista', id, 300, 2,    5 FROM objetos WHERE nombre = 'Raíz de Lunar'                    UNION ALL

SELECT 'herrero',    id, 200,  NULL, 1 FROM objetos WHERE nombre = 'Espada Corta'                    UNION ALL
SELECT 'herrero',    id, 450,  5,    2 FROM objetos WHERE nombre = 'Espada Larga'                    UNION ALL
SELECT 'herrero',    id, 400,  3,    3 FROM objetos WHERE nombre = 'Hacha de Batalla'                UNION ALL
SELECT 'herrero',    id, 750,  2,    4 FROM objetos WHERE nombre = 'Cota de Malla'                   UNION ALL
SELECT 'herrero',    id, 100,  NULL, 5 FROM objetos WHERE nombre = 'Escudo de Hierro'                UNION ALL
SELECT 'herrero',    id, 1200, 1,    6 FROM objetos WHERE nombre = 'Espada Corta +1'                 UNION ALL

SELECT 'mercado-negro', id, 600,  4,    1 FROM objetos WHERE nombre = 'Veneno de Sombra'             UNION ALL
SELECT 'mercado-negro', id, 250,  NULL, 2 FROM objetos WHERE nombre = 'Kit de Ladrón'               UNION ALL
SELECT 'mercado-negro', id, 2000, 1,    3 FROM objetos WHERE nombre = 'Capa de Evasión'             UNION ALL
SELECT 'mercado-negro', id, 500,  1,    4 FROM objetos WHERE nombre = 'Pergamino Maldito'           UNION ALL
SELECT 'mercado-negro', id, 100,  8,    5 FROM objetos WHERE nombre = 'Bomba de Humo'               UNION ALL

SELECT 'templo', id, 25,  NULL, 1 FROM objetos WHERE nombre = 'Agua Bendita'                         UNION ALL
SELECT 'templo', id, 500, 3,    2 FROM objetos WHERE nombre = 'Símbolo Sagrado de Plata'             UNION ALL
SELECT 'templo', id, 150, NULL, 3 FROM objetos WHERE nombre = 'Incienso de Purificación'             UNION ALL
SELECT 'templo', id, 800, 2,    4 FROM objetos WHERE nombre = 'Talismán Contra Muertos Vivientes'   UNION ALL

SELECT 'magia', id, 75,   NULL, 1 FROM objetos WHERE nombre = 'Pergamino de Misil Mágico'            UNION ALL
SELECT 'magia', id, 600,  5,    2 FROM objetos WHERE nombre = 'Pergamino de Bola de Fuego'           UNION ALL
SELECT 'magia', id, 25,   NULL, 3 FROM objetos WHERE nombre = 'Bolsa de Componentes'                 UNION ALL
SELECT 'magia', id, 5000, 1,    4 FROM objetos WHERE nombre = 'Varilla de Fuerza'                    UNION ALL
SELECT 'magia', id, 1500, 1,    5 FROM objetos WHERE nombre = 'Cristal de Visión Lejana';

COMMIT;
