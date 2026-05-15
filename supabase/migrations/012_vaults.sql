-- =============================================================================
-- Migration 012 — Coffres-forts (caisses d'épargne)
--
-- Permet à un utilisateur d'épargner vers un objectif. Chaque caisse a :
--   - un nom + un objectif XOF + (optionnel) une date cible
--   - une règle de prélèvement mensuel : (monthly_amount_xof, day_of_month)
--   - un solde courant (balance_xof) qui peut être NÉGATIF si l'utilisateur
--     a sauté des échéances (debt_xof traque le cumul des skips)
--   - un statut : active | paused | withdrawn
--
-- Chaque opération sur le solde laisse une trace dans vault_contributions
-- (kind : manual | scheduled | skip | withdrawal).
--
-- À exécuter dans Supabase SQL Editor.
-- =============================================================================

create table public.vaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  goal_xof numeric(12, 0) not null check (goal_xof > 0),
  target_date date,
  monthly_amount_xof numeric(12, 0) not null check (monthly_amount_xof > 0),
  day_of_month integer not null check (day_of_month between 1 and 30),
  next_charge_at timestamptz not null,
  last_charge_at timestamptz,
  -- balance_xof peut devenir négatif si l'utilisateur skippe des échéances
  -- avec du retard de prélèvement (cas "S'il n'y a pas d'argent c'est -10$").
  balance_xof numeric(12, 0) not null default 0,
  debt_xof numeric(12, 0) not null default 0 check (debt_xof >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'withdrawn')),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index vaults_owner_idx on public.vaults(owner_id, status);
create index vaults_next_charge_idx on public.vaults(next_charge_at)
  where status = 'active';

create table public.vault_contributions (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  -- Signé : positif = ajout vers la caisse, négatif = retrait / skip.
  amount_xof numeric(12, 0) not null,
  kind text not null check (kind in ('manual', 'scheduled', 'skip', 'withdrawal')),
  note text,
  occurred_at timestamptz not null default now()
);

create index vault_contributions_vault_idx on public.vault_contributions(vault_id, occurred_at desc);

-- =============================================================================
-- Row Level Security : on lit/écrit uniquement ses propres caisses + leurs contribs.
-- =============================================================================

alter table public.vaults enable row level security;
alter table public.vault_contributions enable row level security;

create policy "vaults_owner_select"
  on public.vaults for select using (auth.uid() = owner_id);
create policy "vaults_owner_insert"
  on public.vaults for insert with check (auth.uid() = owner_id);
create policy "vaults_owner_update"
  on public.vaults for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "vaults_owner_delete"
  on public.vaults for delete using (auth.uid() = owner_id);

-- Pour les contributions, on remonte vers la caisse pour vérifier l'ownership.
create policy "vault_contributions_owner_select"
  on public.vault_contributions for select
  using (
    exists (
      select 1 from public.vaults v
      where v.id = vault_contributions.vault_id and v.owner_id = auth.uid()
    )
  );
-- Insert : volontairement non autorisé en direct depuis le client — on passe
-- toujours par les routes API (qui utilisent le service-role pour garantir
-- la cohérence balance/contribution).
