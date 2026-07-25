-- ============================================================
-- MEA CULPA - Migracion 056
-- Sistema RTS: unidades de ejercito.
--
-- Un regimiento se compra en la tienda como cualquier otro objeto, pero NO va
-- a la mochila: vive en su propio inventario de 5 casillas para que no se
-- mezcle con el equipo y el DM pueda matarlo en partida sin tocar la bolsa.
--
-- Reglas del inventario de ejercito:
--   · 5 casillas por personaje (orden 0-4).
--   · Una casilla = un tipo de unidad, apilable hasta 100 regimientos.
--   · Cada objeto de tipo 'ejercito' declara cuantos soldados forma un
--     regimiento, su CA y su dano; el total de soldados de una casilla es
--     soldados x cantidad.
-- ============================================================

BEGIN;

-- ── 1) Nuevo tipo de objeto ──────────────────────────────────────────────────
ALTER TABLE objetos DROP CONSTRAINT IF EXISTS objetos_tipo_item_check;

ALTER TABLE objetos
  ADD CONSTRAINT objetos_tipo_item_check
  CHECK (
    tipo_item IN (
      'cabeza','pecho','guante','botas',
      'collar','anillo','amuleto','cinturón','capa',
      'arma','gema-arma','gema-capa','accesorio-arma','accesorio-capa',
      'consumible','ingrediente','misc',
      'ejército'
    )
  );

-- ── 2) Ficha de la unidad ────────────────────────────────────────────────────
-- Nullable a proposito: solo la rellenan los objetos tipo 'ejército'.
ALTER TABLE objetos ADD COLUMN IF NOT EXISTS soldados       INT;
ALTER TABLE objetos ADD COLUMN IF NOT EXISTS clase_armadura INT;
ALTER TABLE objetos ADD COLUMN IF NOT EXISTS dano           TEXT;

COMMENT ON COLUMN objetos.soldados       IS 'Soldados que forma un regimiento de esta unidad (solo tipo_item = ejército)';
COMMENT ON COLUMN objetos.clase_armadura IS 'CA de la unidad (solo tipo_item = ejército)';
COMMENT ON COLUMN objetos.dano           IS 'Dano de la unidad en texto libre, ej: 1d6 (solo tipo_item = ejército)';

-- ── 3) Inventario de ejercito ────────────────────────────────────────────────
-- Tabla aparte de bolsa_objetos a proposito: asi la capacidad de bolsa, el
-- comercio P2P, el baul del gremio y las recompensas de dados siguen viendo
-- solo la mochila, sin tocar ni una consulta existente.
CREATE TABLE IF NOT EXISTS ejercito_objetos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personaje_id BIGINT  NOT NULL REFERENCES personajes(id) ON DELETE CASCADE,
  -- RESTRICT, no CASCADE: borrar una unidad del catálogo no puede vaciarle el
  -- ejército a los jugadores. El admin recibe el 409 de "objeto en uso".
  objeto_id    BIGINT  NOT NULL REFERENCES objetos(id)    ON DELETE RESTRICT,
  cantidad     INT     NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 100),
  -- ponytail: 5 casillas fijas en el CHECK; si algun dia se compran mas,
  -- este rango y EJERCITO_SLOTS en lib/ejercito.ts suben juntos.
  orden        INT     NOT NULL CHECK (orden BETWEEN 0 AND 4),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un tipo de unidad ocupa una sola casilla: apila, no se reparte.
  CONSTRAINT uq_ejercito_unidad UNIQUE (personaje_id, objeto_id),
  CONSTRAINT uq_ejercito_orden  UNIQUE (personaje_id, orden) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_ejercito_personaje ON ejercito_objetos(personaje_id);

ALTER TABLE ejercito_objetos ENABLE ROW LEVEL SECURITY;

-- Mismas politicas que bolsa_objetos: acceso via ownership del personaje.
DROP POLICY IF EXISTS ejercito_select ON ejercito_objetos;
CREATE POLICY ejercito_select ON ejercito_objetos FOR SELECT
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

DROP POLICY IF EXISTS ejercito_insert ON ejercito_objetos;
CREATE POLICY ejercito_insert ON ejercito_objetos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

DROP POLICY IF EXISTS ejercito_update ON ejercito_objetos;
CREATE POLICY ejercito_update ON ejercito_objetos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

DROP POLICY IF EXISTS ejercito_delete ON ejercito_objetos;
CREATE POLICY ejercito_delete ON ejercito_objetos FOR DELETE
  USING (EXISTS (SELECT 1 FROM personajes WHERE personajes.id = personaje_id AND personajes.usuario_id = auth.uid()));

-- El DM (admin) manda sobre el ejercito de cualquier personaje: es quien mata
-- las unidades cuando caen en batalla.
DROP POLICY IF EXISTS ejercito_admin_all ON ejercito_objetos;
CREATE POLICY ejercito_admin_all ON ejercito_objetos
  USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND (es_admin = true OR rol_sistema = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND (es_admin = true OR rol_sistema = 'admin'))
  );

-- ── 4) Compra en tienda ──────────────────────────────────────────────────────
-- Igual que la 054 salvo la rama nueva: las unidades de ejercito nunca entran
-- en la mochila, se apilan en las casillas de ejercito.
CREATE OR REPLACE FUNCTION public.comprar_en_tienda(
  p_usuario_id   UUID,
  p_personaje_id BIGINT,
  p_items        JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem          JSONB;
  v_articulo_id   BIGINT;
  v_qty           INT;
  v_precio        INT;
  v_stock         INT;
  v_obj_id        BIGINT;
  v_tipo_item     TEXT;
  v_total_costo   INT := 0;
  v_nuevo_oro     INT;
  v_existing_id   BIGINT;
  v_next_orden    INT;
  v_bag_count     INT;
  v_bag_capacity  INT;
  v_army_qty      INT;
  v_i             INT;
BEGIN
  -- 1. Verificar que el personaje pertenece al usuario
  SELECT capacidad_bolsa INTO v_bag_capacity
  FROM   personajes
  WHERE  id = p_personaje_id AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  -- 2. Bloquear compras si el personaje esta en una partida en progreso
  IF EXISTS (
    SELECT 1
    FROM public.partida_participantes pp
    JOIN public.partidas p ON p.id = pp.partida_id
    WHERE pp.personaje_id = p_personaje_id
      AND p.estado = 'en_progreso'
  ) THEN
    RAISE EXCEPTION 'No puedes comprar en tienda mientras el personaje esta en una expedicion en curso';
  END IF;

  -- 3. Validar stock y calcular costo total
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para articulo %', v_articulo_id;
    END IF;

    SELECT o.precio, at.inventario, at.objeto_id, o.tipo_item
    INTO   v_precio, v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Articulo % no encontrado en ninguna tienda', v_articulo_id;
    END IF;

    -- NULL = stock ilimitado; solo validar cuando es finito
    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para articulo %', v_articulo_id;
    END IF;

    v_total_costo := v_total_costo + v_precio * v_qty;
  END LOOP;

  -- 4. Verificar oro suficiente
  IF NOT EXISTS (
    SELECT 1 FROM perfiles WHERE id = p_usuario_id AND oro >= v_total_costo
  ) THEN
    RAISE EXCEPTION 'Oro insuficiente';
  END IF;

  -- 5 y 6. Reducir stock y entregar
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    SELECT at.inventario, at.objeto_id, o.tipo_item
    INTO   v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    -- Reducir stock si es finito
    IF v_stock IS NOT NULL THEN
      UPDATE articulos_tienda
        SET inventario = inventario - v_qty
      WHERE id = v_articulo_id;
    END IF;

    IF v_tipo_item = 'ejército' THEN
      -- Ejercito: inventario propio. Apila en la casilla de esa unidad
      -- (max 100) o abre la primera casilla libre de las 5.
      SELECT id, cantidad INTO v_existing_id, v_army_qty
      FROM   ejercito_objetos
      WHERE  personaje_id = p_personaje_id AND objeto_id = v_obj_id;

      IF FOUND THEN
        IF v_army_qty + v_qty > 100 THEN
          RAISE EXCEPTION 'Una casilla de ejercito admite 100 unidades como maximo (tienes % y quieres anadir %)',
            v_army_qty, v_qty;
        END IF;

        UPDATE ejercito_objetos
          SET cantidad = cantidad + v_qty
        WHERE id = v_existing_id;
      ELSE
        IF v_qty > 100 THEN
          RAISE EXCEPTION 'Una casilla de ejercito admite 100 unidades como maximo';
        END IF;

        -- Primera casilla libre: reutiliza los huecos que deja el DM al matar
        -- una unidad, en vez de seguir contando desde la ultima.
        SELECT MIN(s.orden) INTO v_next_orden
        FROM   generate_series(0, 4) AS s(orden)
        WHERE  NOT EXISTS (
          SELECT 1 FROM ejercito_objetos e
          WHERE  e.personaje_id = p_personaje_id AND e.orden = s.orden
        );

        IF v_next_orden IS NULL THEN
          RAISE EXCEPTION 'Inventario de ejercito lleno: las 5 casillas estan ocupadas';
        END IF;

        INSERT INTO ejercito_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, v_qty, v_next_orden);
      END IF;

    ELSIF v_tipo_item = 'consumible' THEN
      -- Consumible: apila en una sola fila de la bolsa
      SELECT id INTO v_existing_id
      FROM   bolsa_objetos
      WHERE  personaje_id = p_personaje_id AND objeto_id = v_obj_id;

      IF FOUND THEN
        UPDATE bolsa_objetos
          SET cantidad = cantidad + v_qty
        WHERE id = v_existing_id;
      ELSE
        -- Verificar capacidad de bolsa antes de ocupar un nuevo slot
        SELECT COUNT(*) INTO v_bag_count
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        IF v_bag_count >= v_bag_capacity THEN
          RAISE EXCEPTION 'Bolsa llena: capacidad maxima de % slots alcanzada para este personaje',
            v_bag_capacity;
        END IF;

        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_next_orden
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, v_qty, v_next_orden);
      END IF;
    ELSE
      -- No es consumible: crear una entrada por cada unidad
      FOR v_i IN 1..v_qty LOOP
        -- Verificar capacidad de bolsa antes de cada insert
        SELECT COUNT(*) INTO v_bag_count
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        IF v_bag_count >= v_bag_capacity THEN
          RAISE EXCEPTION 'Bolsa llena: capacidad maxima de % slots alcanzada para este personaje',
            v_bag_capacity;
        END IF;

        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_next_orden
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, 1, v_next_orden);
      END LOOP;
    END IF;
  END LOOP;

  -- 7. Descontar oro y registrar transaccion
  SELECT modificar_oro(p_usuario_id, -v_total_costo, 'compra_tienda', NULL)
  INTO v_nuevo_oro;

  RETURN json_build_object('oro', v_nuevo_oro);
END;
$$;

COMMIT;
