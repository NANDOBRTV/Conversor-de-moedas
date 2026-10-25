-- Preserve the developer-only access rule while evaluating auth.uid() once per statement.
alter policy "developer manages reseller sales orders"
  on public.reseller_sales_orders
  using (
    exists (
      select 1
      from public.reseller_profiles p
      where p.user_id = (select auth.uid())
        and p.membership_tier = 'developer'
        and p.access_status = 'active'
        and (p.access_until is null or p.access_until > now())
    )
  )
  with check (
    exists (
      select 1
      from public.reseller_profiles p
      where p.user_id = (select auth.uid())
        and p.membership_tier = 'developer'
        and p.access_status = 'active'
        and (p.access_until is null or p.access_until > now())
    )
  );
