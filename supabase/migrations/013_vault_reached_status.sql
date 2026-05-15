-- =============================================================================
-- Migration 013 — Statut 'reached' pour les coffres
--
-- Quand le solde d'une caisse atteint ou dépasse son objectif, on bascule
-- son statut à 'reached' (au lieu de garder 'active'). Sémantique :
--   - active    : prélèvements en cours, retrait pas encore disponible
--   - paused    : l'utilisateur a mis en pause, prélèvements stoppés
--   - reached   : objectif atteint, prélèvements stoppés, RETRAIT DÉBLOQUÉ
--   - withdrawn : l'utilisateur a retiré son épargne, caisse clôturée
--
-- Ce changement est nécessaire pour gérer le cas où l'utilisateur ajoute
-- manuellement une grosse somme qui dépasse l'objectif : on doit arrêter
-- les échéances automatiques (sinon on continuerait à prélever) ET débloquer
-- le retrait immédiatement.
-- =============================================================================

-- Drop l'ancien check (le nom auto-généré par Postgres est `vaults_status_check`).
-- Si le nom diffère, le DO bloc cherche dynamiquement.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.vaults'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%in%';
  if cname is not null then
    execute format('alter table public.vaults drop constraint %I', cname);
  end if;
end $$;

alter table public.vaults
  add constraint vaults_status_check
  check (status in ('active', 'paused', 'reached', 'withdrawn'));

-- Backfill : les caisses dont le solde atteint déjà l'objectif basculent
-- en 'reached' (utile si on a déjà fait des tests avec balance >= goal).
update public.vaults
set status = 'reached'
where status = 'active'
  and balance_xof >= goal_xof;
