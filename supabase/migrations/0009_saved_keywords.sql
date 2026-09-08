-- ============================================================================
-- 0009_saved_keywords.sql
-- "Save keyword" button support for the SEO Research tab — lets staff bookmark
-- keywords found via Keyword Ideas, Competitor Ranked Keywords, or the
-- Keyword Gap tool, to act on later (content briefs, ad targeting, etc.).
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

create table if not exists public.saved_keywords (
  id          uuid primary key default gen_random_uuid(),
  keyword     text not null,
  volume      integer,
  difficulty  integer,             -- 0-100, null when the source doesn't have one (e.g. Gap)
  cpc_usd     numeric,
  position    integer,             -- competitor's rank, only set for Gap / Ranked Keywords saves
  source      text not null,       -- 'research' | 'gap' | 'ranked'
  context     text,                -- the seed keyword or competitor domain it came from
  saved_by    uuid references public.app_users(id),
  created_at  timestamptz not null default now(),
  unique (keyword, source, context)
);

create index if not exists saved_keywords_created_idx on public.saved_keywords (created_at desc);

alter table public.saved_keywords enable row level security;
drop policy if exists saved_keywords_all on public.saved_keywords;
create policy saved_keywords_all on public.saved_keywords for all using (true) with check (true);
