-- =============================================================================
-- Migration 004 — Refonte vers profil unifié + Wallet ID
--
-- Décisions actées (session 8, 2026-05-14) :
--   1. Plus de séparation expéditeur / bénéficiaire : un seul compte qui peut
--      envoyer ET recevoir. La colonne `role` reste pour compat mais devient
--      cosmétique.
--   2. Chaque profil obtient à la création un identifiant public unique
--      `wallet_id` au format `DC-XXXX-XXXX` (alphanum sans 0/1/I/O pour éviter
--      les ambiguïtés à la lecture).
--   3. Les transferts pointent maintenant vers un `recipient_id` (un profil),
--      plus vers un `beneficiaires.id`. La table beneficiaires reste pour
--      compat avec les anciens tests (carnet d'adresses futur).
--   4. La policy phone-match de la migration 003 disparaît : le lien
--      sender→receiver passe désormais par le wallet_id, plus par le téléphone.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.
-- =============================================================================

-- ---- Étape 1 : Étendre profiles ---------------------------------------------
alter table public.profiles
  add column if not exists wallet_id        text unique,
  add column if not exists first_name       text,
  add column if not exists last_name        text,
  add column if not exists date_of_birth    date,
  add column if not exists place_of_birth   text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists pin_hash         text;

-- ---- Étape 2 : Générateur de wallet_id ---------------------------------------
-- Alphabet sans 0/1/I/O pour lisibilité humaine (Crockford-style).
-- 31 caractères ** 8 positions = ~852 milliards de combinaisons.
create or replace function public._random_alphanum(len int)
returns text
language sql
volatile
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
           1 + floor(random() * 31)::int, 1),
    ''
  )
  from generate_series(1, len);
$$;

create or replace function public.generate_wallet_id()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
begin
  for i in 1..10 loop
    candidate := 'DC-' || public._random_alphanum(4) || '-' || public._random_alphanum(4);
    if not exists (select 1 from public.profiles where wallet_id = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not generate unique wallet_id after 10 attempts';
end;
$$;

-- ---- Étape 3 : Backfill pour les profils existants ---------------------------
update public.profiles
set wallet_id = public.generate_wallet_id()
where wallet_id is null;

alter table public.profiles
  alter column wallet_id set not null;

-- ---- Étape 4 : Trigger handle_new_user mis à jour ----------------------------
-- Génère automatiquement un wallet_id à chaque création de compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, wallet_id, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'expediteur'),
    public.generate_wallet_id(),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

-- ---- Étape 5 : Transferts unifiés -------------------------------------------
alter table public.transferts
  add column if not exists recipient_id uuid references public.profiles(id);

-- Beneficiaire_id devient optionnel (le nouveau flow ne l'utilise plus).
alter table public.transferts
  alter column beneficiaire_id drop not null;

create index if not exists transferts_recipient_idx
  on public.transferts(recipient_id, created_at desc);

-- ---- Étape 6 : Nouvelle RLS, simple et propre --------------------------------
-- On retire la policy phone-match de la migration 003 (plus nécessaire).
drop policy if exists "transferts_select_involved" on public.transferts;
drop policy if exists "transferts_select_by_recipient_phone" on public.transferts;
drop function if exists public.user_can_receive_transfert(uuid);

-- Un utilisateur voit un transfert s'il est expéditeur ou destinataire.
-- Le fallback `recipient_id is null + ownership du beneficiaire` ne sert qu'à
-- ne pas casser les anciens transferts de test.
create policy "transferts_select_involved"
  on public.transferts for select
  using (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
    or (
      recipient_id is null
      and auth.uid() in (
        select owner_id from public.beneficiaires
        where id = transferts.beneficiaire_id
      )
    )
  );

-- Insertion : seul l'expéditeur peut créer son propre transfert, ET il ne
-- peut pas s'envoyer de l'argent à lui-même (anti-fraude basique).
drop policy if exists "transferts_insert_sender" on public.transferts;
create policy "transferts_insert_sender"
  on public.transferts for insert
  with check (
    auth.uid() = sender_id
    and (recipient_id is null or recipient_id <> sender_id)
  );
