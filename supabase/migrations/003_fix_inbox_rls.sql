-- =============================================================================
-- Migration 003 — Correction de la RLS du flow bénéficiaire
--
-- Bug constaté : la policy 002 (`transferts_select_by_recipient_phone`)
-- contient un sous-select sur `public.beneficiaires`. Ce sous-select est
-- lui-même filtré par la RLS de `beneficiaires` (`auth.uid() = owner_id`),
-- or le bénéficiaire ne possède pas cette ligne (c'est l'expéditeur qui l'a
-- créée). Résultat : le EXISTS renvoie toujours faux côté receveur et le
-- transfert reste invisible dans /wallet, même quand les téléphones matchent.
--
-- Correctif : encapsuler la vérification dans une fonction SECURITY DEFINER
-- qui s'exécute avec les privilèges du propriétaire (postgres) et bypasse
-- donc la RLS de `beneficiaires` pour ce check précis.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.
-- =============================================================================

-- Drop l'ancienne policy cassée.
drop policy if exists "transferts_select_by_recipient_phone" on public.transferts;

-- Fonction helper : renvoie true si l'utilisateur connecté a un téléphone
-- profil qui matche celui du bénéficiaire du transfert passé en paramètre.
-- SECURITY DEFINER → s'exécute en bypass RLS, donc on peut lire la ligne
-- `beneficiaires` même si le caller n'en est pas owner.
-- STABLE → résultat ne change pas dans une même requête, Postgres peut cacher.
create or replace function public.user_can_receive_transfert(t_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.beneficiaires b
    join public.transferts t on t.id = t_id and t.beneficiaire_id = b.id
    join public.profiles p on p.id = auth.uid()
    where b.phone is not null
      and p.phone is not null
      and b.phone = p.phone
  );
$$;

grant execute on function public.user_can_receive_transfert(uuid) to authenticated;

-- Recréation de la policy avec l'appel à la fonction.
create policy "transferts_select_by_recipient_phone"
  on public.transferts for select
  using (public.user_can_receive_transfert(transferts.id));
