-- ============================================================================
-- 0012_clients_registry.sql
-- Turns the existing bare-name `clients` roster into the master record for
-- each client: who owns it, its brand name, its website, and its ad
-- channel ids. This becomes the one place that connects a client to SEO #1
-- (via search_console_sites.client_id), Meta Ads (meta_ad_account_id, already
-- matched against campaign_clients/advertiser_accounts by id), and Google Ads
-- (google_ads_account_id, ready for when that integration lands).
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0011_multi_site.sql to already be applied.
-- ============================================================================

alter table public.clients
  add column if not exists owner                 text,   -- the client's own contact/business owner
  add column if not exists website_domain         text,
  add column if not exists instagram_handle       text,
  add column if not exists meta_ad_account_id     text,   -- Meta ad account id, without "act_"
  add column if not exists google_ads_account_id  text;

alter table public.search_console_sites
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists search_console_sites_client_idx on public.search_console_sites (client_id);
