-- ============================================================
-- MEA CULPA - Migracion 060
-- Bloqueo de tiendas durante partida en Base de Datos
--
-- Crea tabla `partidas_tiendas_abiertas` para registrar de 
-- forma segura qué tienda está abierta en una expedición.
-- Sustituye el bypass `p_en_partida` en la funcion `comprar_en_tienda`.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.partidas_tiendas_abiertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partida_id UUID NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  tienda_id TEXT NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,
  jugadores_permitidos JSONB,
  expira_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partida_id, tienda_id)
);

-- Habilitar RLS pero es gestionado por API Server Role
ALTER TABLE public.partidas_tiendas_abiertas ENABLE ROW LEVEL SECURITY;

-- Limpiar la funcion anterior que tenia un default (provoca el error 42P13)
DROP FUNCTION IF EXISTS public.comprar_en_tienda(uuid, bigint, jsonb, boolean);

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
  
  v_partida_id    UUID;
  v_tienda_id     TEXT;
  v_tienda_abierta RECORD;
BEGIN
  -- 1. Verificar que el personaje pertenece al usuario
  SELECT capacidad_bolsa INTO v_bag_capacity
  FROM   personajes
  WHERE  id = p_personaje_id AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  -- 2. Verificar si el personaje esta en una partida en progreso
  SELECT p.id INTO v_partida_id
  FROM public.partida_participantes pp
  JOIN public.partidas p ON p.id = pp.partida_id
  WHERE pp.personaje_id = p_personaje_id
    AND p.estado = 'en_progreso'
  LIMIT 1;

  -- 3. Validar stock, calcular costo total, y verificar acceso si esta en partida
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para articulo %', v_articulo_id;
    END IF;

    SELECT o.precio, at.inventario, at.objeto_id, o.tipo_item, at.tienda_id
    INTO   v_precio, v_stock, v_obj_id, v_tipo_item, v_tienda_id
    FROM   articulos_tienda at
    INNER JOIN objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Articulo % no encontrado en ninguna tienda', v_articulo_id;
    END IF;
    
    -- VALIDACION DE TIENDA EN PARTIDA
    IF v_partida_id IS NOT NULL THEN
      -- Buscar si existe esta tienda abierta para esta partida
      SELECT * INTO v_tienda_abierta
      FROM public.partidas_tiendas_abiertas
      WHERE partida_id = v_partida_id AND tienda_id = v_tienda_id
      LIMIT 1;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'No puedes comprar en tienda mientras el personaje esta en una expedicion en curso (tienda no abierta)';
      END IF;
      
      -- Verificar expiracion
      IF v_tienda_abierta.expira_en IS NOT NULL AND v_tienda_abierta.expira_en < now() THEN
        RAISE EXCEPTION 'La tienda ya cerro';
      END IF;
      
      -- Verificar si tiene permiso
      IF v_tienda_abierta.jugadores_permitidos IS NOT NULL AND jsonb_array_length(v_tienda_abierta.jugadores_permitidos) > 0 THEN
        IF NOT (v_tienda_abierta.jugadores_permitidos @> to_jsonb(p_personaje_id)) THEN
          RAISE EXCEPTION 'No tienes permiso para comprar en esta tienda';
        END IF;
      END IF;
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
      SELECT id INTO v_existing_id
      FROM   bolsa_objetos
      WHERE  personaje_id = p_personaje_id AND objeto_id = v_obj_id;

      IF FOUND THEN
        UPDATE bolsa_objetos
          SET cantidad = cantidad + v_qty
        WHERE id = v_existing_id;
      ELSE
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
      FOR v_i IN 1..v_qty LOOP
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

-- Para asegurar la retrocompatibilidad
CREATE OR REPLACE FUNCTION public.comprar_en_tienda(
  p_usuario_id   UUID,
  p_personaje_id BIGINT,
  p_items        JSONB,
  p_en_partida   BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignoramos el p_en_partida de forma deliberada y llamamos a la nueva funcion segura.
  RETURN public.comprar_en_tienda(p_usuario_id, p_personaje_id, p_items);
END;
$$;

COMMIT;
