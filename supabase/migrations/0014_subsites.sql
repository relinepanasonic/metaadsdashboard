-- ============================================================================
-- 0014_subsites.sql
-- Sub-sites: a "site" that is really just a page-path slice of a parent
-- site's Search Console property (e.g. nanocare.id/product-a/ as its own SEO
-- entity, without needing its own verified GSC property). It inherits the
-- parent's GSC connection and scopes traffic queries to that path prefix.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0013_auto_publish.sql to already be applied.
-- ============================================================================

alter table public.search_console_sites
  add column if not exists parent_site_id uuid references public.search_console_sites(id) on delete cascade,
  add column if not exists path_prefix    text; -- e.g. "/product-a/" — required together with parent_site_id

alter table public.search_console_sites drop constraint if exists search_console_sites_subsite_pair_check;
alter table public.search_console_sites add constraint search_console_sites_subsite_pair_check
  check ((parent_site_id is null) = (path_prefix is null));

create index if not exists search_console_sites_parent_idx on public.search_console_sites (parent_site_id);
