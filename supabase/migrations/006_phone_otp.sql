-- =============================================================================
-- Migration 006 — Champs OTP pour la vérification du téléphone
--
-- Ajoute deux colonnes sur profiles pour stocker le hash du code OTP envoyé
-- + sa date d'expiration. Pas de nouvelle table : 1 OTP actif par user à la
-- fois suffit pour notre cas d'usage (vérification de numéro).
-- =============================================================================

alter table public.profiles
  add column if not exists phone_otp_hash       text,
  add column if not exists phone_otp_expires_at timestamptz;
