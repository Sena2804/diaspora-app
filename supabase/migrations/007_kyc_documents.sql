-- =============================================================================
-- Migration 007 — KYC : stockage + colonnes pour upload des pièces d'identité
--
-- Crée le bucket Supabase Storage `kyc` (privé) + RLS qui permet à chaque
-- user d'uploader / lire UNIQUEMENT ses propres fichiers (folder = son uid).
-- Ajoute les colonnes profiles pour stocker les chemins des fichiers.
-- =============================================================================

-- 1. Colonnes sur profiles
alter table public.profiles
  add column if not exists kyc_doc_recto_path text,
  add column if not exists kyc_doc_verso_path text,
  add column if not exists kyc_selfie_path    text,
  add column if not exists kyc_submitted_at   timestamptz;

-- 2. Bucket KYC (privé). Limite 5 Mo par fichier, MIME images + PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc',
  'kyc',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- 3. RLS sur storage.objects pour le bucket kyc.
-- Chaque user a son propre dossier nommé par son uid : `{uid}/recto.jpg`, etc.
drop policy if exists "kyc_upload_own" on storage.objects;
create policy "kyc_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_select_own" on storage.objects;
create policy "kyc_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_update_own" on storage.objects;
create policy "kyc_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_delete_own" on storage.objects;
create policy "kyc_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
