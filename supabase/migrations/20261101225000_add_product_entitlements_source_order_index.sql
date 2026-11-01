-- Add the missing covering index reported by Supabase Performance Advisors.
-- Additive and idempotent: preserves existing rows, constraints, and permissions.
create index if not exists product_entitlements_source_order_id_idx
  on public.product_entitlements (source_order_id);
