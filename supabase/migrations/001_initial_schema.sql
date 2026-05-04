-- ============================================================
-- MEA CULPA — Esquema para Supabase (PostgreSQL) · Versión 2
-- ============================================================
-- Diseñado para ser simple, escalable y fácil de mantener.
-- Catálogo global de objetos como fuente de verdad única.
-- Stats y equipamiento normalizados para queries eficientes.
-- Todo nombrado en español.
-- ============================================================

-- ============================================================
-- TABLAS BASE
-- ============================================================

-- 1. PERFILES — Extiende auth.users de Supabase.
-- Supabase gestiona auth.users (id, email, contraseña).
-- Esta tabla agrega los datos visibles del jugador.
CREATE TABLE perfiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL,
  rol             TEXT        NOT NULL DEFAULT 'Dungeon Explorer',
  nivel           INT         NOT NULL DEFAULT 1,
  hogar           TEXT        NOT NULL DEFAULT 'Sin hogar',
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CATÁLOGO GLOBAL DE OBJETOS
-- ============================================================

-- 2. OBJETOS — Fuente de verdad de todos los items del juego.
-- Cualquier objeto, sin importar su origen (tienda, drop,
-- recompensa, regalo de administrador), debe existir aquí primero.
CREATE TABLE objetos (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre             TEXT    NOT NULL,
  descripcion        TEXT    NOT NULL DEFAULT '',
  icono              TEXT    NOT NULL DEFAULT '📦',
  tipo_item          TEXT    NOT NULL CHECK (tipo_item IN (
                       'cabeza','pecho','guante','botas',
                       'collar','anillo','amuleto','arma',
                       'gema-arma','gema-capa',
                       'consumible','ingrediente','misc'
                     )),
  requiere_dos_manos BOOLEAN NOT NULL DEFAULT FALSE,
  rareza             TEXT    NOT NULL DEFAULT 'común' CHECK (rareza IN (
                       'común','poco común','raro','épico','legendario'
                     )),
  -- JSONB: bonos opcionales y variables al equip, ej: {"fuerza": 2, "destreza": 1}
  bono_estadisticas  JSONB   DEFAULT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PERSONAJES Y TABLAS RELACIONADAS
-- ============================================================

-- 3. PERSONAJES — Personajes de cada jugador (máx. 5 slots).
-- Contiene solo los datos base. Stats y equipo viven en tablas propias.
CREATE TABLE personajes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id      UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  numero_slot     INT         NOT NULL CHECK (numero_slot BETWEEN 1 AND 5),
  nombre          TEXT        NOT NULL,
  raza            TEXT        NOT NULL,
  alineamiento    TEXT        NOT NULL,
  retrato         TEXT        NOT NULL DEFAULT '/characters/profileplaceholder.webp',
  capacidad_bolsa INT         NOT NULL DEFAULT 10,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un usuario no puede tener dos personajes en el mismo slot
  UNIQUE (usuario_id, numero_slot)
);

CREATE INDEX idx_personajes_usuario ON personajes(usuario_id);

-- 4. CLASES_PERSONAJE — Multiclase (1-3 clases por personaje).
-- Normalizado para poder filtrar y ordenar personajes por clase.
CREATE TABLE clases_personaje (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personaje_id  BIGINT  NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
  nombre_clase  TEXT    NOT NULL,
  nivel         INT     NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  orden         INT     NOT NULL DEFAULT 1 CHECK (orden BETWEEN 1 AND 3),

  -- Un personaje no puede tener la misma clase dos veces
  UNIQUE (personaje_id, nombre_clase),
  -- Un personaje no puede tener dos clases en la misma posición
  UNIQUE (personaje_id, orden)
);

CREATE INDEX idx_clases_personaje ON clases_personaje(personaje_id);

-- 5. ESTADISTICAS_PERSONAJE — Atributos D&D del personaje (1:1 con personajes).
-- Columnas individuales permiten ORDER BY y WHERE por atributo de forma eficiente.
CREATE TABLE estadisticas_personaje (
  personaje_id  BIGINT PRIMARY KEY REFERENCES personajes(id) ON DELETE CASCADE,
  fuerza        INT NOT NULL DEFAULT 10 CHECK (fuerza        BETWEEN 1 AND 30),
  destreza      INT NOT NULL DEFAULT 10 CHECK (destreza      BETWEEN 1 AND 30),
  constitucion  INT NOT NULL DEFAULT 10 CHECK (constitucion  BETWEEN 1 AND 30),
  inteligencia  INT NOT NULL DEFAULT 10 CHECK (inteligencia  BETWEEN 1 AND 30),
  sabiduria     INT NOT NULL DEFAULT 10 CHECK (sabiduria     BETWEEN 1 AND 30),
  carisma       INT NOT NULL DEFAULT 10 CHECK (carisma       BETWEEN 1 AND 30)
);

-- 6. EQUIPAMIENTO_PERSONAJE — Equipo activo del personaje (1:1 con personajes).
-- Cada slot referencia objetos(id) con integridad referencial real.
-- ON DELETE SET NULL: si el objeto se elimina del catálogo, el slot queda vacío.
-- actualizado_en permite saber cuándo cambió el equipo (logs, sync, auditoría).
CREATE TABLE equipamiento_personaje (
  personaje_id   BIGINT PRIMARY KEY REFERENCES personajes(id) ON DELETE CASCADE,
  -- Armadura
  cabeza         BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  pecho          BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  guante         BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  botas          BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  -- Accesorios
  collar         BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  anillo1        BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  anillo2        BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  amuleto        BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  -- Armas
  mano_izquierda BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  mano_derecha   BIGINT REFERENCES objetos(id) ON DELETE SET NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. BOLSA_OBJETOS — Inventario del personaje.
-- Cada fila es un stack de un objeto. Referencia al catálogo global.
-- objeto_id es nullable: si un admin depreca un objeto, el slot queda en NULL
-- en lugar de bloquear la operación (ON DELETE SET NULL).
-- El UNIQUE en (personaje_id, orden) es DEFERRABLE INITIALLY DEFERRED para
-- permitir reordenamientos dentro de una transacción sin violar el constraint
-- en cada fila individual — se valida al hacer COMMIT.
CREATE TABLE bolsa_objetos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personaje_id  BIGINT  NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
  objeto_id     BIGINT           REFERENCES objetos(id)    ON DELETE SET NULL,
  cantidad      INT     NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  orden         INT     NOT NULL DEFAULT 0,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint diferido: se valida al COMMIT, no fila a fila
  CONSTRAINT uq_bolsa_orden UNIQUE (personaje_id, orden) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_bolsa_personaje ON bolsa_objetos(personaje_id);

-- ============================================================
-- TIENDAS
-- ============================================================

-- 8. TIENDAS — Tiendas disponibles en el juego.
CREATE TABLE tiendas (
  id            TEXT PRIMARY KEY,  -- slug legible, ej: "herbalista"
  nombre        TEXT    NOT NULL,
  descripcion   TEXT    NOT NULL DEFAULT '',
  icono         TEXT    NOT NULL DEFAULT '🏪',
  tendero       TEXT    NOT NULL,
  ubicacion     TEXT    NOT NULL,
  nivel_minimo  INT     DEFAULT NULL,  -- NULL = sin restricción de nivel
  orden         INT     NOT NULL DEFAULT 0,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ARTICULOS_TIENDA — Productos disponibles en cada tienda.
-- Solo guarda datos propios de la tienda (precio, stock, orden).
-- Nombre, descripción, icono y tipo viven en objetos(id).
CREATE TABLE articulos_tienda (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tienda_id   TEXT    NOT NULL REFERENCES tiendas(id)  ON DELETE CASCADE,
  objeto_id   BIGINT  NOT NULL REFERENCES objetos(id)  ON DELETE RESTRICT,
  precio      INT     NOT NULL CHECK (precio >= 0),
  inventario  INT     DEFAULT NULL,  -- NULL = stock ilimitado
  orden       INT     NOT NULL DEFAULT 0,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un objeto no puede aparecer dos veces en la misma tienda
  UNIQUE (tienda_id, objeto_id)
);

CREATE INDEX idx_articulos_tienda ON articulos_tienda(tienda_id);

-- ============================================================
-- TRIGGERS: actualizar actualizado_en automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_perfiles_actualizado
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_personajes_actualizado
  BEFORE UPDATE ON personajes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_equipamiento_actualizado
  BEFORE UPDATE ON equipamiento_personaje
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo ve y modifica sus propios datos.
-- Las tablas de solo lectura (objetos, tiendas, artículos)
-- son públicas para todos los usuarios autenticados.
-- ============================================================

ALTER TABLE perfiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE personajes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases_personaje      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estadisticas_personaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamiento_personaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE bolsa_objetos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE objetos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulos_tienda      ENABLE ROW LEVEL SECURITY;

-- Perfiles: solo el dueño
CREATE POLICY perfiles_select ON perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY perfiles_insert ON perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY perfiles_update ON perfiles FOR UPDATE USING (auth.uid() = id);

-- Personajes: solo el dueño
CREATE POLICY personajes_select ON personajes FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY personajes_insert ON personajes FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY personajes_update ON personajes FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY personajes_delete ON personajes FOR DELETE USING (auth.uid() = usuario_id);

-- Clases del personaje: via ownership del personaje
CREATE POLICY clases_select ON clases_personaje FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY clases_insert ON clases_personaje FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY clases_update ON clases_personaje FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY clases_delete ON clases_personaje FOR DELETE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- Estadísticas del personaje: via ownership del personaje
CREATE POLICY stats_select ON estadisticas_personaje FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY stats_insert ON estadisticas_personaje FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY stats_update ON estadisticas_personaje FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY stats_delete ON estadisticas_personaje FOR DELETE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- Equipamiento del personaje: via ownership del personaje
CREATE POLICY equip_select ON equipamiento_personaje FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY equip_insert ON equipamiento_personaje FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY equip_update ON equipamiento_personaje FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY equip_delete ON equipamiento_personaje FOR DELETE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- Bolsa de objetos: via ownership del personaje
CREATE POLICY bolsa_select ON bolsa_objetos FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY bolsa_insert ON bolsa_objetos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY bolsa_update ON bolsa_objetos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
CREATE POLICY bolsa_delete ON bolsa_objetos FOR DELETE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- Objetos, Tiendas y Artículos: lectura pública (catálogos del juego)
CREATE POLICY objetos_select          ON objetos          FOR SELECT USING (true);
CREATE POLICY tiendas_select          ON tiendas          FOR SELECT USING (true);
CREATE POLICY articulos_tienda_select ON articulos_tienda FOR SELECT USING (true);

-- ============================================================
-- 10. TRANSACCIONES_OBJETOS — Historial de cómo cada personaje
-- obtuvo sus objetos (tienda, drop, quest, regalo de admin, etc.).
-- Solo inserción — nunca se modifica ni elimina; es un log inmutable.
-- ============================================================
CREATE TABLE transacciones_objetos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personaje_id  BIGINT      NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
  objeto_id     BIGINT      NOT NULL REFERENCES objetos(id)    ON DELETE RESTRICT,
  origen        TEXT        NOT NULL CHECK (origen IN ('tienda','admin','drop','quest')),
  cantidad      INT         NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacciones_personaje ON transacciones_objetos(personaje_id);
CREATE INDEX idx_transacciones_objeto    ON transacciones_objetos(objeto_id);

ALTER TABLE transacciones_objetos ENABLE ROW LEVEL SECURITY;

-- El jugador puede ver el historial de sus propios personajes
CREATE POLICY transacciones_select ON transacciones_objetos FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));
-- Solo el backend (service_role) puede insertar — no el cliente directo
CREATE POLICY transacciones_insert ON transacciones_objetos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- ============================================================
-- TRIGGER: Crear perfil automáticamente al registrar usuario.
-- Se ejecuta vía trigger en auth.users de Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION crear_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, rol, nivel, hogar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'Dungeon Explorer',
    1,
    'Sin hogar'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER al_crear_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION crear_perfil_usuario();


