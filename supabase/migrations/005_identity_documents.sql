-- =============================================================================
-- Migration 005 — Documents d'identité (NPI / CIN / Passeport / Titre séjour)
--
-- Ajoute deux champs sur profiles pour stocker le numéro de la pièce
-- déclarée à l'inscription. La photo du document (upload) viendra plus tard
-- dans un batch dédié au KYC complet.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.
-- =============================================================================

alter table public.profiles
  add column if not exists document_type   text
    check (document_type in ('NPI', 'CIN', 'PASSPORT', 'RESIDENCE_PERMIT', 'DRIVER_LICENSE')),
  add column if not exists document_number text;

-- Trigger : on s'assure que les valeurs sont stockées en majuscules et sans
-- espaces pour la cohérence (les regexes regex coté front travaillent en
-- case-insensitive, mais la DB est plus propre normalisée).
create or replace function public.normalize_document_number()
returns trigger
language plpgsql
as $$
begin
  if new.document_number is not null then
    new.document_number := upper(regexp_replace(new.document_number, '\s+', '', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_normalize_doc on public.profiles;
create trigger profiles_normalize_doc
  before insert or update of document_number on public.profiles
  for each row execute function public.normalize_document_number();
