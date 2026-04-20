BEGIN;

ALTER TABLE public.pagos_paypal
  DROP CONSTRAINT IF EXISTS pagos_paypal_concepto_check;

ALTER TABLE public.pagos_paypal
  ADD CONSTRAINT pagos_paypal_concepto_check
  CHECK (concepto IN ('ruleta_usd_spin', 'character_slot_unlock', 'character_revive'));

COMMIT;