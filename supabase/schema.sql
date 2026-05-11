-- =============================================================================
-- DiasporaConnect — Schéma initial (V1)
-- À exécuter dans Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table : profiles (étend auth.users de Supabase)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('expediteur', 'beneficiaire', 'admin')),
  full_name text,
  phone text,
  country text,
  kyc_status text default 'pending' check (kyc_status in ('pending', 'verified', 'rejected')),
  stellar_public_key text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Table : beneficiaires
-- ---------------------------------------------------------------------------
create table public.beneficiaires (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  operator text not null check (operator in ('mtn', 'moov', 'celtiis')),
  country text default 'BJ',
  created_at timestamptz default now()
);

create index beneficiaires_owner_idx on public.beneficiaires(owner_id);

-- ---------------------------------------------------------------------------
-- Table : transferts
-- ---------------------------------------------------------------------------
create table public.transferts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  beneficiaire_id uuid not null references public.beneficiaires(id),
  amount_eur numeric(10, 2) not null check (amount_eur > 0),
  amount_xof numeric(12, 0) not null check (amount_xof > 0),
  fee_eur numeric(10, 2) not null check (fee_eur >= 0),
  status text not null default 'pending' check (status in (
    'pending', 'stellar_pending', 'stellar_received',
    'momo_initiated', 'completed', 'failed'
  )),
  stellar_tx_hash text,
  soroban_tx_hash text,
  payout_provider_id text,
  memo bytea,
  timeline jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index transferts_sender_idx on public.transferts(sender_id, created_at desc);
create index transferts_status_idx on public.transferts(status);
create index transferts_beneficiaire_idx on public.transferts(beneficiaire_id);

-- ---------------------------------------------------------------------------
-- Table : webhook_logs (audit, pas de RLS)
-- ---------------------------------------------------------------------------
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  payload jsonb not null,
  signature_valid boolean,
  received_at timestamptz default now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.beneficiaires enable row level security;
alter table public.transferts enable row level security;
-- webhook_logs : pas de RLS, service_role uniquement

-- ---- profiles -------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---- beneficiaires --------------------------------------------------------
create policy "beneficiaires_owner_all"
  on public.beneficiaires for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---- transferts -----------------------------------------------------------
-- L'utilisateur voit les transferts où il est sender OU dont il est bénéficiaire
create policy "transferts_select_involved"
  on public.transferts for select
  using (
    auth.uid() = sender_id
    or auth.uid() in (
      select owner_id from public.beneficiaires
      where id = transferts.beneficiaire_id
    )
  );

create policy "transferts_insert_sender"
  on public.transferts for insert
  with check (auth.uid() = sender_id);

-- Pas de policy UPDATE/DELETE côté client : seul le backend (service_role) modifie.

-- =============================================================================
-- Trigger : auto-créer un profile à la création d'un user auth
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'expediteur');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
