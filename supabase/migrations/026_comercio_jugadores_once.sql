-- ============================================================
-- MEA CULPA — Migración 026
-- Comercio entre jugadores (P2P) con regla de una sola reventa
-- ============================================================

-- 1) Extender bolsa_objetos para rastrear comercio por instancia
ALTER TABLE public.bolsa_objetos
  ADD COLUMN IF NOT EXISTS fue_comerciado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publicado_en_trade BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bolsa_publicado_trade
  ON public.bolsa_objetos (personaje_id, publicado_en_trade)
  WHERE publicado_en_trade = true;

-- 2) Permitir origen 'comercio' en el historial de transacciones de objetos
ALTER TABLE public.transacciones_objetos
  DROP CONSTRAINT IF EXISTS transacciones_objetos_origen_check;

ALTER TABLE public.transacciones_objetos
  ADD CONSTRAINT transacciones_objetos_origen_check
  CHECK (origen IN ('tienda', 'admin', 'drop', 'quest', 'comercio'));

-- 3) Publicaciones de comercio P2P
CREATE TABLE IF NOT EXISTS public.publicaciones_comercio (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_bolsa_id           BIGINT NOT NULL REFERENCES public.bolsa_objetos(id) ON DELETE CASCADE,
  vendedor_usuario_id     UUID   NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  vendedor_personaje_id   BIGINT NOT NULL REFERENCES public.personajes(id) ON DELETE CASCADE,
  comprador_usuario_id    UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  comprador_personaje_id  BIGINT REFERENCES public.personajes(id) ON DELETE SET NULL,
  precio                  INT NOT NULL CHECK (precio > 0),
  estado                  TEXT NOT NULL DEFAULT 'publicado' CHECK (estado IN ('publicado', 'solicitado', 'rechazado', 'aceptado', 'cancelado')),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_comercio_estado
  ON public.publicaciones_comercio (estado, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_publicaciones_comercio_vendedor
  ON public.publicaciones_comercio (vendedor_usuario_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_publicaciones_comercio_comprador
  ON public.publicaciones_comercio (comprador_usuario_id, actualizado_en DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_publicaciones_item_activo
  ON public.publicaciones_comercio (item_bolsa_id)
  WHERE estado IN ('publicado', 'solicitado');

DROP TRIGGER IF EXISTS trg_publicaciones_comercio_actualizado ON public.publicaciones_comercio;
CREATE TRIGGER trg_publicaciones_comercio_actualizado
  BEFORE UPDATE ON public.publicaciones_comercio
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- 4) RLS: lectura autenticada, escritura por backend (service_role)
ALTER TABLE public.publicaciones_comercio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publicaciones_comercio_select ON public.publicaciones_comercio;
CREATE POLICY publicaciones_comercio_select ON public.publicaciones_comercio
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5) RPC atómica para aceptar una solicitud de compra
CREATE OR REPLACE FUNCTION public.aceptar_publicacion_comercio(
  p_publicacion_id BIGINT,
  p_vendedor_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_bolsa_id       BIGINT;
  v_precio              INT;
  v_estado              TEXT;
  v_vendedor_usuario_id UUID;
  v_vendedor_personaje_id BIGINT;
  v_comprador_usuario_id UUID;
  v_comprador_personaje_id BIGINT;
  v_item_objeto_id      BIGINT;
  v_item_cantidad       INT;
  v_comprador_capacidad INT;
  v_comprador_count     INT;
  v_next_orden          INT;
  v_oro_comprador       INT;
  v_oro_vendedor        INT;
BEGIN
  SELECT
    pc.item_bolsa_id,
    pc.precio,
    pc.estado,
    pc.vendedor_usuario_id,
    pc.vendedor_personaje_id,
    pc.comprador_usuario_id,
    pc.comprador_personaje_id
  INTO
    v_item_bolsa_id,
    v_precio,
    v_estado,
    v_vendedor_usuario_id,
    v_vendedor_personaje_id,
    v_comprador_usuario_id,
    v_comprador_personaje_id
  FROM public.publicaciones_comercio pc
  WHERE pc.id = p_publicacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publicación no encontrada';
  END IF;

  IF v_vendedor_usuario_id <> p_vendedor_id THEN
    RAISE EXCEPTION 'No autorizado para resolver esta publicación';
  END IF;

  IF v_estado <> 'solicitado' THEN
    RAISE EXCEPTION 'La publicación no está en estado solicitado';
  END IF;

  IF v_comprador_usuario_id IS NULL OR v_comprador_personaje_id IS NULL THEN
    RAISE EXCEPTION 'La publicación no tiene comprador asignado';
  END IF;

  IF v_comprador_usuario_id = v_vendedor_usuario_id THEN
    RAISE EXCEPTION 'No se permite autocompra';
  END IF;

  -- Bloquear y validar el item publicado
  SELECT b.objeto_id, b.cantidad
  INTO v_item_objeto_id, v_item_cantidad
  FROM public.bolsa_objetos b
  WHERE b.id = v_item_bolsa_id
    AND b.personaje_id = v_vendedor_personaje_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El objeto publicado ya no está disponible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bolsa_objetos b
    WHERE b.id = v_item_bolsa_id
      AND (b.fue_comerciado = true)
  ) THEN
    RAISE EXCEPTION 'Este objeto ya fue comerciado anteriormente';
  END IF;

  -- Validar capacidad de bolsa del comprador
  SELECT p.capacidad_bolsa
  INTO v_comprador_capacidad
  FROM public.personajes p
  WHERE p.id = v_comprador_personaje_id
    AND p.usuario_id = v_comprador_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje comprador no válido';
  END IF;

  SELECT COUNT(*)
  INTO v_comprador_count
  FROM public.bolsa_objetos b
  WHERE b.personaje_id = v_comprador_personaje_id;

  IF v_comprador_count >= v_comprador_capacidad THEN
    RAISE EXCEPTION 'Bolsa llena: capacidad máxima de % slots alcanzada para el comprador', v_comprador_capacidad;
  END IF;

  -- El comprador ya pagó al momento de solicitar la compra (reserva de oro).
  SELECT oro
  INTO v_oro_comprador
  FROM public.perfiles
  WHERE id = v_comprador_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprador no encontrado';
  END IF;

  -- Aceptar transfiere el monto reservado al vendedor.
  SELECT public.modificar_oro(v_vendedor_usuario_id, v_precio, 'venta_comercio', NULL)
    INTO v_oro_vendedor;

  -- Transferir item al comprador y bloquear futura reventa
  SELECT COALESCE(MAX(b.orden), 0) + 1
  INTO v_next_orden
  FROM public.bolsa_objetos b
  WHERE b.personaje_id = v_comprador_personaje_id;

  UPDATE public.bolsa_objetos
    SET personaje_id = v_comprador_personaje_id,
        orden = v_next_orden,
        publicado_en_trade = false,
        fue_comerciado = true
  WHERE id = v_item_bolsa_id;

  -- Cerrar publicación
  UPDATE public.publicaciones_comercio
    SET estado = 'aceptado',
        actualizado_en = now()
  WHERE id = p_publicacion_id;

  -- Log de objeto para trazabilidad
  INSERT INTO public.transacciones_objetos (personaje_id, objeto_id, origen, cantidad)
  VALUES (v_comprador_personaje_id, v_item_objeto_id, 'comercio', v_item_cantidad);

  RETURN json_build_object(
    'publicacionId', p_publicacion_id,
    'estado', 'aceptado',
    'precio', v_precio,
    'buyerGold', v_oro_comprador,
    'sellerGold', v_oro_vendedor
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aceptar_publicacion_comercio(BIGINT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_publicacion_comercio(BIGINT, UUID) TO service_role;
