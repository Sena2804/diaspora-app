-- =============================================================================
-- Migration 011 — Jour précis pour les envois récurrents
--
-- Ajoute `day_of_period` à recurring_transfers :
--   - frequency='weekly'  → day_of_period ∈ 1..7 (ISO 8601 : 1=lundi … 7=dimanche)
--   - frequency='monthly' → day_of_period ∈ 1..30 (le 31 n'est jamais choisi
--     pour éviter le piège des mois courts)
--
-- Pour les lignes existantes (créées en session 9 sans ce champ), on backfill
-- avec la valeur correspondant au `next_run_at` actuel pour ne rien casser.
--
-- À exécuter dans Supabase SQL Editor.
-- =============================================================================

alter table public.recurring_transfers
  add column if not exists day_of_period integer check (day_of_period between 1 and 30);

-- Backfill : pour chaque ligne existante, on déduit le jour à partir de next_run_at.
-- isodow renvoie 1..7 (1=lundi), extract(day) renvoie 1..31.
update public.recurring_transfers
set day_of_period = case
  when frequency = 'weekly'  then extract(isodow from next_run_at)::int
  when frequency = 'monthly' then least(extract(day  from next_run_at)::int, 30)
end
where day_of_period is null;

-- Désormais obligatoire.
alter table public.recurring_transfers
  alter column day_of_period set not null;

-- Cohérence : si weekly, day_of_period <= 7. (Le check 1..30 ne suffit pas pour weekly.)
alter table public.recurring_transfers
  add constraint recurring_day_matches_frequency check (
    (frequency = 'weekly'  and day_of_period between 1 and 7)
    or (frequency = 'monthly' and day_of_period between 1 and 30)
  );
