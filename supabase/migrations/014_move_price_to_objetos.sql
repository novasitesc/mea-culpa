-- ============================================================
-- MEA CULPA — Migración 014
-- Mover precio desde articulos_tienda hacia objetos.
-- ============================================================

BEGIN;

-- 1) Precio base en el catálogo global de objetos
ALTER TABLE objetos
  ADD COLUMN IF NOT EXISTS precio INT NOT NULL DEFAULT 0 CHECK (precio >= 0);

-- 2) Migrar precios históricos (si existen) desde artículos de tienda
UPDATE objetos o
SET    precio = src.precio
FROM (
  SELECT objeto_id, MAX(precio) AS precio
  FROM   articulos_tienda
  GROUP  BY objeto_id
) AS src
WHERE  o.id = src.objeto_id;

-- 3) Actualizar RPC de compra para usar precio del objeto
CREATE OR REPLACE FUNCTION public.comprar_en_tienda(
  p_usuario_id   UUID,
  p_personaje_id BIGINT,
  p_items        JSONB   -- [{articulo_tienda_id: BIGINT, qty: INT}]
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
  v_total_costo   INT := 0;
  v_nuevo_oro     INT;
  v_existing_id   BIGINT;
  v_next_orden    INT;
  v_bag_count     INT;
  v_bag_capacity  INT;
BEGIN
  SELECT capacidad_bolsa INTO v_bag_capacity
  FROM   personajes
  WHERE  id = p_personaje_id AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para articulo %', v_articulo_id;
    END IF;

    SELECT o.precio, at.inventario, at.objeto_id
    INTO   v_precio, v_stock, v_obj_id
    FROM   articulos_tienda at
    JOIN   objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Articulo % no encontrado en ninguna tienda', v_articulo_id;
    END IF;

    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para articulo %', v_articulo_id;
    END IF;

    v_total_costo := v_total_costo + v_precio * v_qty;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM perfiles WHERE id = p_usuario_id AND oro >= v_total_costo
  ) THEN
    RAISE EXCEPTION 'Oro insuficiente';
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    SELECT at.inventario, at.objeto_id
    INTO   v_stock, v_obj_id
    FROM   articulos_tienda at
    WHERE  at.id = v_articulo_id;

    IF v_stock IS NOT NULL THEN
      UPDATE articulos_tienda
      SET    inventario = inventario - v_qty
      WHERE  id = v_articulo_id;
    END IF;

    SELECT id INTO v_existing_id
    FROM   bolsa_objetos
    WHERE  personaje_id = p_personaje_id AND objeto_id = v_obj_id;

    IF FOUND THEN
      UPDATE bolsa_objetos
      SET    cantidad = cantidad + v_qty
      WHERE  id = v_existing_id;
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
  END LOOP;

  SELECT modificar_oro(p_usuario_id, -v_total_costo, 'compra_tienda', NULL)
  INTO v_nuevo_oro;

  RETURN json_build_object('oro', v_nuevo_oro);
END;
$$;

-- 4) El precio deja de ser dato propio de la tienda
ALTER TABLE articulos_tienda
  DROP COLUMN IF EXISTS precio;

COMMIT;
