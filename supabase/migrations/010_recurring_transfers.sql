-- =============================================================================
-- Migration 010 — Envois récurrents (programmations)
--
-- Permet à un utilisateur de programmer un envoi qui se répétera à intervalle
-- régulier (hebdomadaire ou mensuel). Une programmation conserve :
--   - le destinataire (wallet_id + recipient_id résolu à la création)
--   - le montant en EUR
--   - un motif optionnel
--   - la fréquence
--   - la prochaine échéance (next_run_at)
--   - un état actif/en pause
--   - le total d'envois déjà déclenchés (compteur pour la démo)
--
-- IMPORTANT : pour la finale on n'a PAS de cron job. Chaque échéance est
-- déclenchée manuellement par l'utilisateur via le bouton « Confirmer
-- l'envoi » dans /recurring (cohérent avec la spec : « toujours confirmer
-- l'envoi par notification »). Le PIN est exigé à chaque déclenchement.
-- Pour la prod il suffirait d'ajouter un cron Vercel qui POST sur
-- /api/recurring/run-due chaque heure.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.
-- =============================================================================

create table public.recurring_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipient_wallet_id text not null,
  recipient_id uuid references public.profiles(id) on delete set null,
  amount_eur numeric(10, 2) not null check (amount_eur > 0 and amount_eur <= 10000),
  motif text,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  total_runs integer not null default 0,
  created_at timestamptz not null default now()
);

create index recurring_owner_idx on public.recurring_transfers(owner_id, active);
create index recurring_next_run_idx on public.recurring_transfers(next_run_at)
  where active = true;

-- Anti auto-envoi : refuse une programmation où sender == recipient.
alter table public.recurring_transfers
  add constraint recurring_no_self check (recipient_id is null or recipient_id <> owner_id);

-- =============================================================================
-- Row Level Security : un user ne voit / mute QUE ses propres programmations.
-- =============================================================================

alter table public.recurring_transfers enable row level security;

create policy "recurring_owner_select"
  on public.recurring_transfers for select
  using (auth.uid() = owner_id);

create policy "recurring_owner_insert"
  on public.recurring_transfers for insert
  with check (auth.uid() = owner_id);

create policy "recurring_owner_update"
  on public.recurring_transfers for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "recurring_owner_delete"
  on public.recurring_transfers for delete
  using (auth.uid() = owner_id);
