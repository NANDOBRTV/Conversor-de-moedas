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
as $$
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

-- Preenche o e-mail dos perfis criados antes deste cadastro automático.
update public.reseller_profiles as rp
set email = lower(au.email)
from auth.users as au
where rp.user_id = au.id
  and (rp.email is null or trim(rp.email) = '');


-- Perfil criado automaticamente quando alguém se cadastra pelo formulário do site.
-- O perfil começa pendente; cadastro nunca libera o painel pago automaticamente.
create or replace function public.handle_new_reseller_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
  chosen_plan text;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  chosen_plan := coalesce(new.raw_user_meta_data ->> 'requested_plan', 'monthly');

  if chosen_username !~ '^[a-z0-9_.-]{3,30}$' then
    raise exception 'Nome de usuário inválido';
  end if;

  if chosen_plan not in ('monthly', 'one_time') then
    chosen_plan := 'monthly';
  end if;

  insert into public.reseller_profiles
    (user_id, username, email, requested_plan, access_status, plan_name)
  values
    (new.id, chosen_username, lower(new.email), chosen_plan, 'pending', 'pendente');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_reseller on auth.users;
create trigger on_auth_user_created_reseller
after insert on auth.users
for each row execute procedure public.handle_new_reseller_signup();
