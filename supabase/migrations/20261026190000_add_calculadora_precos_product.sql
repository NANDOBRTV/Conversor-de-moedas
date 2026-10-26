alter table public.product_entitlements drop constraint if exists product_entitlements_product_code_check;
alter table public.product_entitlements add constraint product_entitlements_product_code_check check (product_code in ('planilha_lucro','kit_divulgacao','calculadora_precos'));
