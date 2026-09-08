-- ============================================================================
-- 0007_search_console.sql
-- Connected Google Search Console properties (one row per website staff has
-- verified + granted our shared service account read access to).
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

create table if not exists public.search_console_sites (
  id            uuid primary key default gen_random_uuid(),
  site_url      text not null unique,   -- e.g. "sc-domain:profesoronline.id" or "https://profesoronline.id/"
  label         text not null,          -- friendly display name
  status        text not null default 'pending' check (status in ('pending', 'connected', 'error')),
  last_error    text,
  last_synced_at timestamptz,
  connected_by  uuid references public.app_users(id),
  created_at    timestamptz not null default now()
);

alter table public.search_console_sites enable row level security;

drop policy if exists search_console_sites_all on public.search_console_sites;
create policy search_console_sites_all on public.search_console_sites for all using (true) with check (true);
