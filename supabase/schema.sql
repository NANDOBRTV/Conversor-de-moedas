-- Conversor Sanba: perfil do revendedor e estado do acesso Premium.
-- Execute este arquivo no SQL Editor do SEU projeto Supabase.

create table if not exists public.reseller_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  access_status text not null default 'pending'
    check (access_status in ('pending', 'active', 'suspended')),
  plan_name text not null default 'premium',
  access_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_username_format check (username = lower(username) and username ~ '^[a-z0-9_.-]{3,30}
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
-- A criação de perfil e a mudança de access_status são tarefas administrativas
-- feitas pelo painel seguro do Supabase (service role nunca vai para o navegador).

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
)
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
-- A criação de perfil e a mudança de access_status são tarefas administrativas
-- feitas pelo painel seguro do Supabase (service role nunca vai para o navegador).

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
