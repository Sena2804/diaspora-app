-- =============================================================================
-- Migration 002 — Bénéficiaire peut voir les transferts dont son téléphone
-- correspond à celui enregistré par l'expéditeur.
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.
-- =============================================================================

-- Le bénéficiaire connecté voit les transferts où le téléphone du destinataire
-- (stocké dans beneficiaires.phone par l'expéditeur) correspond au téléphone
-- enregistré sur son propre profil (profiles.phone).
create policy "transferts_select_by_recipient_phone"
  on public.transferts for select
  using (
    exists (
      select 1
      from public.beneficiaires b
      join public.profiles p on p.id = auth.uid()
      where b.id = transferts.beneficiaire_id
        and b.phone is not null
        and p.phone is not null
        and b.phone = p.phone
    )
  );

-- Note : l'expéditeur garde sa propre policy `transferts_select_involved`.
-- Les deux policies se cumulent (un user voit l'union des deux SELECT autorisés).
