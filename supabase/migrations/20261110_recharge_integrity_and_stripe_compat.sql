-- SECURITY PATCH 2026-11-10 - review in staging before applying to production.
-- Values are the current reference prices from index.html. Future price changes
-- MUST update this table and the site's displayed prices together.
BEGIN;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_provider_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_provider_check
  CHECK (provider IN ('mercadopago','stripe'));
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_stripe_session_unique_idx
  ON public.payment_orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.recharge_reference_prices (
  currency text PRIMARY KEY CHECK (currency IN ('BRL','USD','VES')),
  price_per_1500 numeric(18,6) NOT NULL CHECK (price_per_1500 > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recharge_reference_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recharge_reference_prices FROM PUBLIC, anon, authenticated;
INSERT INTO public.recharge_reference_prices (currency,price_per_1500)
VALUES ('BRL',6),('USD',0.99),('VES',1450)
ON CONFLICT (currency) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_recharge_order_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_price numeric;
  v_expected numeric;
  v_recent integer;
BEGIN
  IF NEW.sanba_id = '00000000' OR NEW.coin_quantity < 1000 OR NEW.coin_quantity > 10000000 THEN
    RAISE EXCEPTION 'ID ou quantidade de moedas inválido';
  END IF;
  IF NEW.status <> 'pending' OR NEW.admin_note IS NOT NULL
     OR NEW.whatsapp_message_sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Novo pedido deve estar pendente e sem campos administrativos';
  END IF;
  SELECT price_per_1500 INTO v_price FROM public.recharge_reference_prices
  WHERE currency = NEW.currency;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Moeda sem preço autorizado'; END IF;
  v_expected := pg_catalog.ceil((NEW.coin_quantity::numeric * v_price / 1500) * 100) / 100;
  IF NEW.amount <> v_expected THEN
    RAISE EXCEPTION 'Valor de pedido divergente do preço validado pelo servidor';
  END IF;
  SELECT pg_catalog.count(*) INTO v_recent FROM public.recharge_orders
  WHERE user_id = NEW.user_id AND created_at > pg_catalog.now() - interval '1 minute';
  IF v_recent >= 8 THEN
    RAISE EXCEPTION 'Limite de pedidos por minuto atingido';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_recharge_order_integrity()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS recharge_orders_integrity ON public.recharge_orders;
CREATE TRIGGER recharge_orders_integrity BEFORE INSERT ON public.recharge_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_recharge_order_integrity();

-- The caller may not rewrite amounts, ownership, currency or quantities.
REVOKE UPDATE ON public.recharge_orders FROM authenticated;
GRANT UPDATE (status, admin_note) ON public.recharge_orders TO authenticated;
-- Expired/suspended accounts must never insert orders.
DROP POLICY IF EXISTS "Active customers can create own recharge orders" ON public.recharge_orders;
CREATE POLICY "Active customers can create own recharge orders"
ON public.recharge_orders FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND status = 'pending' AND admin_note IS NULL
  AND EXISTS (
    SELECT 1 FROM public.reseller_profiles rp
    WHERE rp.user_id = (SELECT auth.uid()) AND rp.access_status = 'active'
      AND (rp.access_until IS NULL OR rp.access_until > pg_catalog.now())
  )
);
COMMIT;
