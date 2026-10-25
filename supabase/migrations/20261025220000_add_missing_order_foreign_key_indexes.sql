-- Add covering indexes for foreign keys flagged by Supabase Performance Advisors.
-- Idempotent and additive; no existing data or permissions are changed.
create index if not exists reseller_sales_orders_created_by_idx
  on public.reseller_sales_orders (created_by);

create index if not exists revenue_orders_user_id_idx
  on public.revenue_orders (user_id);
