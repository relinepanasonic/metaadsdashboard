-- ============================================================================
-- 0004_client_details.sql
-- Adds PIC (person in charge) and contact email to the clients roster, so
-- the Users page can create full client profiles, not just bare names.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.clients add column if not exists pic text;
alter table public.clients add column if not exists contact_email text;
