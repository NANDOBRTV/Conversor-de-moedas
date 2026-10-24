-- Conversor Sanba: perfil do revendedor e estado do acesso Premium.
-- Execute este arquivo no SQL Editor do SEU projeto Supabase.

create table if not exists public.reseller_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text,
  requested_plan text not null default 'monthly'
    check (requested_plan in ('monthly', 'one_time')),
  access_status text not null default 'pending'
    check (access_status in ('pending', 'active', 'suspended')),
  plan_name text not null default 'premium',
  membership_tier text not null default 'common' check (membership_tier in ('common', 'gold', 'diamond', 'developer')),
  access_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_username_format
    check (username = lower(username) and username ~ '^[a-z0-9_.-]{3,30}$')
);

create unique index if not exists reseller_profiles_username_lower_idx
  on public.reseller_profiles (lower(username));

alter table public.reseller_profiles enable row level security;

-- Usuários autenticados só podem ler o próprio perfil.
drop policy if exists "Resellers can read their own profile" on public.reseller_profiles;
create policy "Resellers can read their own profile"
  on public.reseller_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Não crie políticas públicas de INSERT/UPDATE/DELETE.
-- A criação de perfil e a mudança de access_status são tarefas administrativas.
-- A service_role nunca deve ser colocada no navegador.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reseller_profiles_updated_at on public.reseller_profiles;
create trigger reseller_profiles_updated_at
before update on public.reseller_profiles
for each row execute function public.set_updated_at();


-- Compatibilidade com projetos onde a tabela já existia.
alter table public.reseller_profiles add column if not exists email text;
alter table public.reseller_profiles
  add column if not exists requested_plan text not null default 'monthly';
alter table public.reseller_profiles
  add column if not exists membership_tier text not null default 'common';
alter table public.reseller_profiles drop constraint if exists reseller_profiles_membership_tier_check;
alter table public.reseller_profiles add constraint reseller_profiles_membership_tier_check
  check (membership_tier in ('common', 'gold', 'diamond', 'developer'));

-- Preenche o e-mail dos perfis criados antes deste cadastro automático.
update public.reseller_profiles as rp
set email = lower(au.email)
from auth.users as au
where rp.user_id = au.id
  and (rp.email is null or trim(rp.email) = '');


-- Perfil criado automaticamente quando alguém se cadastra pelo formulário do site.
-- O perfil começa pendente; cadastro nunca libera o painel pago automaticamente.
create or replace function public.handle_new_reseller_signup()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  chosen_username text;
  account_type text;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username','')));
  account_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'account_type','')));
  if chosen_username !~ '^[a-z0-9_.-]{3,30}$' then
    raise exception 'Nome de usuário inválido';
  end if;
  if account_type = 'customer' then
    insert into public.reseller_profiles
      (user_id,username,email,requested_plan,access_status,plan_name,membership_tier,access_until,reseller_application_status)
    values (new.id,chosen_username,lower(new.email),'monthly','active','Comum','common',null,'not_requested');
    return new;
  end if;
  if account_type <> 'reseller' then
    raise exception 'Tipo de cadastro inválido';
  end if;
  -- Cadastro aberto, sem convite e sem privilégios premium.
  -- A solicitação precisa de aprovação manual do desenvolvedor.
  insert into public.reseller_profiles
    (user_id,username,email,requested_plan,access_status,plan_name,membership_tier,access_until,
     reseller_application_status,reseller_invite_id,reseller_requested_at)
  values (new.id,chosen_username,lower(new.email),'monthly','pending','Aguardando aprovação','common',null,
     'pending',null,pg_catalog.now());
  return new;
end;
$function$;
revoke execute on function public.handle_new_reseller_signup() from public, anon, authenticated;


-- Pedidos de pagamento Mercado Pago. Somente funções server-side usam service_role para gravar.
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('gold','diamond')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','refunded','expired')),
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  preference_id text,
  payment_id text unique,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists payment_orders_user_created_idx on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders(status);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
drop policy if exists "Users can read own payment orders" on public.payment_orders;
create policy "Users can read own payment orders" on public.payment_orders
for select to authenticated using (auth.uid() = user_id);
-- A política limita as linhas; a permissão SQL é necessária para a consulta via API.
grant select on public.payment_orders to authenticated;

-- ============================================================
-- Esquema completo Sanba (cliente, recargas, convites e pedidos)
-- Mantém compatibilidade com o projeto já existente. Pode ser
-- executado novamente sem apagar pedidos ou contas.
-- ============================================================

-- Convites são criados e validados somente por Edge Functions com service_role.
create table if not exists public.reseller_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_email text,
  status text not null default 'issued' check (status in ('issued','used','revoked')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id),
  used_at timestamptz
);
create index if not exists reseller_invites_status_created_idx
  on public.reseller_invites(status, created_at desc);
create index if not exists reseller_invites_created_by_idx
  on public.reseller_invites(created_by);
create index if not exists reseller_invites_used_by_idx
  on public.reseller_invites(used_by);
alter table public.reseller_invites enable row level security;
revoke all on public.reseller_invites from anon, authenticated;

-- Colunas adicionais do perfil que já são usadas pelo painel e pelas funções.
alter table public.reseller_profiles add column if not exists reseller_application_status text not null default 'not_requested';
alter table public.reseller_profiles add column if not exists reseller_invite_id uuid;
alter table public.reseller_profiles add column if not exists reseller_requested_at timestamptz;
alter table public.reseller_profiles add column if not exists reseller_reviewed_by uuid references auth.users(id);
alter table public.reseller_profiles add column if not exists reseller_reviewed_at timestamptz;
alter table public.reseller_profiles add column if not exists reseller_review_note text;
alter table public.reseller_profiles drop constraint if exists reseller_profiles_reseller_application_status_check;
alter table public.reseller_profiles add constraint reseller_profiles_reseller_application_status_check
  check (reseller_application_status in ('not_requested','pending','approved','rejected'));
alter table public.reseller_profiles drop constraint if exists reseller_profiles_reseller_invite_id_fkey;
alter table public.reseller_profiles add constraint reseller_profiles_reseller_invite_id_fkey
  foreign key (reseller_invite_id) references public.reseller_invites(id);
create index if not exists reseller_profiles_application_status_idx
  on public.reseller_profiles(reseller_application_status, reseller_requested_at desc);
create index if not exists reseller_profiles_reseller_invite_id_idx
  on public.reseller_profiles(reseller_invite_id);
create index if not exists reseller_profiles_reseller_reviewed_by_idx
  on public.reseller_profiles(reseller_reviewed_by);
alter table public.reseller_profiles enable row level security;
grant select on public.reseller_profiles to authenticated;

-- Pedidos de compra dos planos Ouro e Diamante, com confirmação manual.
create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('gold','diamond')),
  product_name text not null,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  payment_method text not null default 'whatsapp_manual' check (payment_method = 'whatsapp_manual'),
  customer_name text,
  customer_username text not null,
  customer_email text,
  whatsapp_message_sent_at timestamptz,
  admin_note text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_orders_user_created_idx
  on public.customer_orders(user_id, created_at desc);
create index if not exists customer_orders_status_created_idx
  on public.customer_orders(status, created_at desc);
create index if not exists customer_orders_approved_by_idx
  on public.customer_orders(approved_by);
alter table public.customer_orders enable row level security;
revoke all on public.customer_orders from anon;
grant select on public.customer_orders to authenticated;
drop policy if exists "Customers can read own orders" on public.customer_orders;
create policy "Customers can read own orders" on public.customer_orders
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Customers cannot insert orders directly" on public.customer_orders;
create policy "Customers cannot insert orders directly" on public.customer_orders
  for insert to authenticated with check (false);
drop policy if exists "Customers cannot update orders directly" on public.customer_orders;
create policy "Customers cannot update orders directly" on public.customer_orders
  for update to authenticated using (false) with check (false);
drop policy if exists "Customers cannot delete orders directly" on public.customer_orders;
create policy "Customers cannot delete orders directly" on public.customer_orders
  for delete to authenticated using (false);

-- Pedidos de recarga criados pela calculadora e atualizados pelo desenvolvedor.
create table if not exists public.recharge_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sanba_id text not null check (sanba_id ~ '^[0-9]{8}$'),
  coin_quantity bigint not null check (coin_quantity >= 1000),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('BRL','USD','VES')),
  calc_mode text not null default 'coins_to_value' check (calc_mode in ('coins_to_value','value_to_coins')),
  status text not null default 'pending' check (status in ('pending','payment_confirmed','processing','completed','cancelled','payment_rejected')),
  whatsapp_message_sent_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recharge_orders_user_created_idx
  on public.recharge_orders(user_id, created_at desc);
create index if not exists recharge_orders_status_created_idx
  on public.recharge_orders(status, created_at desc);
alter table public.recharge_orders enable row level security;
grant select, insert, update on public.recharge_orders to authenticated;
drop policy if exists "Active customers can create own recharge orders" on public.recharge_orders;
create policy "Active customers can create own recharge orders"
  on public.recharge_orders for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and admin_note is null
    and exists (
      select 1 from public.reseller_profiles rp
      where rp.user_id = (select auth.uid()) and rp.access_status = 'active'
    )
  );
drop policy if exists "Customers can read own recharge orders" on public.recharge_orders;
create policy "Customers can read own recharge orders"
  on public.recharge_orders for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.reseller_profiles rp
      where rp.user_id = (select auth.uid())
        and rp.membership_tier = 'developer'
        and rp.access_status = 'active'
        and (rp.access_until is null or rp.access_until > now())
    )
  );
drop policy if exists "Active developers can update recharge orders" on public.recharge_orders;
create policy "Active developers can update recharge orders"
  on public.recharge_orders for update to authenticated
  using (
    exists (
      select 1 from public.reseller_profiles rp
      where rp.user_id = (select auth.uid())
        and rp.membership_tier = 'developer'
        and rp.access_status = 'active'
        and (rp.access_until is null or rp.access_until > now())
    )
  )
  with check (
    exists (
      select 1 from public.reseller_profiles rp
      where rp.user_id = (select auth.uid())
        and rp.membership_tier = 'developer'
        and rp.access_status = 'active'
        and (rp.access_until is null or rp.access_until > now())
    )
  );

-- Contadores internos de proteção contra tentativas repetidas; sem acesso público.
create table if not exists public.bot_rate_limits (
  key_hash text not null,
  scope text not null check (scope in ('login_ip','login_identifier','checkout_ip','customer_order_ip')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key_hash, scope)
);
alter table public.bot_rate_limits enable row level security;
revoke all on public.bot_rate_limits from anon, authenticated;

-- As funções abaixo só podem ser chamadas por funções do servidor.
create or replace function public.check_and_consume_rate_limit(
  p_key_hash text, p_scope text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 32 or length(p_key_hash) > 128
     or p_scope not in ('login_ip','login_identifier','checkout_ip','customer_order_ip')
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit arguments';
  end if;
  insert into public.bot_rate_limits as current_limit
    (key_hash, scope, window_started_at, request_count, updated_at)
  values (p_key_hash, p_scope, now(), 1, now())
  on conflict (key_hash, scope) do update
    set window_started_at = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now() else current_limit.window_started_at end,
        request_count = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1 else current_limit.request_count + 1 end,
        updated_at = now()
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$function$;
revoke execute on function public.check_and_consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.check_and_consume_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.approve_customer_order_atomic(
  p_order_id uuid, p_admin_user_id uuid, p_note text default null
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_order public.customer_orders%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_until timestamptz;
  v_tier_label text;
begin
  if not exists (
    select 1 from public.reseller_profiles rp
    where rp.user_id = p_admin_user_id
      and rp.membership_tier = 'developer'
      and rp.access_status = 'active'
      and (rp.access_until is null or rp.access_until > pg_catalog.now())
  ) then
    raise exception 'Apenas uma conta Desenvolvedor ativa e dentro da validade pode aprovar pedidos';
  end if;
  select * into v_order from public.customer_orders co where co.id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status <> 'pending' then raise exception 'Este pedido já foi processado'; end if;
  if v_order.plan_tier not in ('gold','diamond') then raise exception 'Plano do pedido inválido'; end if;
  v_tier_label := case when v_order.plan_tier = 'gold' then 'Ouro' else 'Diamante' end;
  v_until := case when v_order.plan_tier = 'gold' then v_now + interval '30 days' else null end;
  update public.reseller_profiles
  set membership_tier = v_order.plan_tier, access_status = 'active',
      plan_name = v_tier_label, access_until = v_until, updated_at = v_now
  where user_id = v_order.user_id and membership_tier = 'common'
    and access_status = 'active' and reseller_application_status = 'approved';
  if not found then
    raise exception 'O perfil precisa ter aprovação de revendedor antes de liberar Ouro ou Diamante';
  end if;
  update public.customer_orders
  set status = 'approved',
      admin_note = nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_note,'')),500),''),
      approved_at = v_now, approved_by = p_admin_user_id, updated_at = v_now
  where id = p_order_id and status = 'pending';
  if not found then raise exception 'O pedido já foi processado por outra operação'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'status','approved','user_id',v_order.user_id,'plan_tier',v_order.plan_tier);
end;
$function$;
revoke execute on function public.approve_customer_order_atomic(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.approve_customer_order_atomic(uuid,uuid,text) to service_role;

create or replace function public.set_recharge_orders_updated_at()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
drop trigger if exists recharge_orders_updated_at on public.recharge_orders;
create trigger recharge_orders_updated_at
before update on public.recharge_orders
for each row execute function public.set_recharge_orders_updated_at();
revoke execute on function public.set_recharge_orders_updated_at() from public, anon, authenticated;

-- Cadastro de revendedor é aberto, mas toda solicitação fica pendente de aprovação manual.
-- Convites administrativos continuam opcionais e não são exigidos para cadastrar.
create or replace function public.handle_new_reseller_signup()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  chosen_username text;
  account_type text;
  invite_hash text;
  chosen_invite public.reseller_invites%rowtype;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username','')));
  account_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'account_type','')));
  if chosen_username !~ '^[a-z0-9_.-]{3,30}$' then
    raise exception 'Nome de usuário inválido';
  end if;
  if account_type = 'customer' then
    insert into public.reseller_profiles
      (user_id,username,email,requested_plan,access_status,plan_name,membership_tier,access_until,reseller_application_status)
    values (new.id,chosen_username,lower(new.email),'monthly','active','Comum','common',null,'not_requested');
    return new;
  end if;
  if account_type <> 'reseller' then
    raise exception 'Tipo de cadastro inválido. Para se tornar revendedor, use um convite individual.';
  end if;
  invite_hash := lower(trim(coalesce(new.raw_user_meta_data ->> 'reseller_invite_hash','')));
  if invite_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'É necessário um convite válido para solicitar cadastro de revendedor';
  end if;
  select * into chosen_invite from public.reseller_invites
  where token_hash = invite_hash and status = 'issued'
    and expires_at > pg_catalog.now()
    and (invited_email is null or lower(invited_email) = lower(new.email))
  for update;
  if not found then
    raise exception 'Convite inválido, vencido, já utilizado ou destinado a outro e-mail';
  end if;
  update public.reseller_invites
    set status = 'used', used_by = new.id, used_at = pg_catalog.now()
    where id = chosen_invite.id and status = 'issued';
  if not found then raise exception 'Este convite já foi utilizado'; end if;
  insert into public.reseller_profiles
    (user_id,username,email,requested_plan,access_status,plan_name,membership_tier,access_until,
     reseller_application_status,reseller_invite_id,reseller_requested_at)
  values (new.id,chosen_username,lower(new.email),'monthly','pending','Aguardando aprovação','common',null,
     'pending',chosen_invite.id,pg_catalog.now());
  return new;
end;
$function$;
revoke execute on function public.handle_new_reseller_signup() from public, anon, authenticated;

-- Pedido de pagamento Mercado Pago é mantido para a futura ativação; a página atual
-- continua usando confirmação manual por WhatsApp e não deve iniciar checkout automático.
