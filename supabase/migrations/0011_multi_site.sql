-- ============================================================================
-- 0011_multi_site.sql
-- Turns the SEO module from "one website" into "as many websites as we add".
-- search_console_sites becomes the general site registry: a site now only
-- needs a domain + label to exist (Research, Competitor Analysis, Keywords,
-- Content Engine all work per-domain with no GSC access required). GSC
-- connection (site_url + status) becomes optional extra capability on a site,
-- not a requirement to register it.
--
-- Also scopes saved_keywords (and therefore the Content Engine) to a site, so
-- the same keyword can be tracked independently across different websites,
-- and adds a per-site blog publish target so each website's own publisher
-- (its own blog-automation deployment + FTP target) can be used.
--
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

-- ---- sites: add domain + publish target, make GSC connection optional ----
alter table public.search_console_sites
  add column if not exists domain         text,
  add column if not exists publish_url    text,
  add column if not exists publish_secret text;

-- Backfill domain from whatever was in site_url for existing rows.
update public.search_console_sites
set domain = lower(regexp_replace(regexp_replace(regexp_replace(site_url, '^sc-domain:', ''), '^https?://', ''), '/+$', ''))
where domain is null and site_url is not null;

alter table public.search_console_sites alter column site_url drop not null;
alter table public.search_console_sites alter column domain set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'search_console_sites_domain_key'
  ) then
    alter table public.search_console_sites add constraint search_console_sites_domain_key unique (domain);
  end if;
end $$;

alter table public.search_console_sites drop constraint if exists search_console_sites_status_check;
alter table public.search_console_sites add constraint search_console_sites_status_check
  check (status in ('none', 'pending', 'connected', 'error'));
alter table public.search_console_sites alter column status set default 'none';

-- ---- saved_keywords: scope to a site ----
alter table public.saved_keywords
  add column if not exists site_id uuid references public.search_console_sites(id) on delete cascade;

-- Single-site installs (everyone before this migration): attach existing
-- keywords to whichever site already exists so nothing orphans.
update public.saved_keywords
set site_id = (select id from public.search_console_sites order by created_at asc limit 1)
where site_id is null;

create index if not exists saved_keywords_site_idx on public.saved_keywords (site_id);

-- Replace the old (keyword, source, context) uniqueness with one scoped per site.
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.saved_keywords'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%(keyword, source, context)%';
  if c is not null then
    execute format('alter table public.saved_keywords drop constraint %I', c);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'saved_keywords_site_keyword_source_context_key'
  ) then
    alter table public.saved_keywords
      add constraint saved_keywords_site_keyword_source_context_key unique (site_id, keyword, source, context);
  end if;
end $$;
