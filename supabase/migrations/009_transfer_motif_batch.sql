-- =============================================================================
-- Migration 009 — Motif + batch_id sur transferts (envoi multi-destinataires)
--
-- Permet :
--   - d'attacher un motif à chaque transfert (« écolage », « anniversaire »…)
--   - de regrouper plusieurs transferts envoyés en une seule opération
--     (batch_id partagé) — utile pour l'affichage côté sender.
-- =============================================================================

alter table public.transferts
  add column if not exists motif    text,
  add column if not exists batch_id uuid;

create index if not exists transferts_batch_idx on public.transferts(batch_id);
