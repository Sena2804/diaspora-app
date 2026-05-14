-- =============================================================================
-- Migration 008 — Trigger handle_new_user étendu
--
-- Bug fixé : quand "Confirm email" est activé dans Supabase, l'utilisateur
-- n'a PAS de session immédiatement après auth.signUp(). Le client front
-- essayait alors de UPDATE sur profiles pour ajouter first_name, last_name,
-- date_of_birth, document_type, document_number, etc. → la RLS bloquait
-- silencieusement (pas d'erreur, juste 0 lignes updatées) puisque
-- auth.uid() est null.
--
-- Fix : le trigger handle_new_user (qui s'exécute en SECURITY DEFINER,
-- bypassant la RLS) lit TOUS les champs depuis new.raw_user_meta_data et
-- les insère lui-même. Le front passe juste les données via options.data
-- de supabase.auth.signUp().
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_n    text  := nullif(meta->>'first_name', '');
  last_n     text  := nullif(meta->>'last_name', '');
  full_n     text;
  dob_raw    text  := nullif(meta->>'date_of_birth', '');
  dob_val    date;
begin
  -- Construction du full_name pour rétro-compat.
  if first_n is not null or last_n is not null then
    full_n := trim(coalesce(first_n, '') || ' ' || coalesce(last_n, ''));
  end if;

  -- Parse de la date (tolérant : si format invalide on met null plutôt que crasher).
  begin
    dob_val := dob_raw::date;
  exception when others then
    dob_val := null;
  end;

  insert into public.profiles (
    id, email, role, wallet_id,
    first_name, last_name, full_name,
    date_of_birth, place_of_birth,
    phone, country,
    document_type, document_number
  )
  values (
    new.id,
    new.email,
    coalesce(meta->>'role', 'expediteur'),
    public.generate_wallet_id(),
    first_n,
    last_n,
    full_n,
    dob_val,
    nullif(meta->>'place_of_birth', ''),
    nullif(meta->>'phone', ''),
    nullif(meta->>'country', ''),
    nullif(meta->>'document_type', ''),
    nullif(meta->>'document_number', '')
  );
  return new;
end;
$$;
