create table if not exists public.product_entitlements (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_code text not null check (product_code in ('planilha_lucro')), source_order_id uuid not null references public.revenue_orders(id) on delete restrict, active boolean not null default true, granted_at timestamptz not null default now(), created_at timestamptz not null default now(), unique (user_id, product_code));
create index if not exists product_entitlements_user_active_idx on public.product_entitlements (user_id, active);
alter table public.product_entitlements enable row level security;
drop policy if exists "Users can view their own product entitlements" on public.product_entitlements;
create policy "Users can view their own product entitlements" on public.product_entitlements for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.product_entitlements from anon, public;
grant select on public.product_entitlements to authenticated;
