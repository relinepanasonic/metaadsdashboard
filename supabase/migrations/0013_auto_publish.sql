-- ============================================================================
-- 0013_auto_publish.sql
-- Auto-drip publishing: approve a finished draft into a per-site queue, and
-- an hourly cron publishes the oldest approved post for each site whenever
-- that site's cadence allows it (posts/week -> minimum interval between
-- auto-publishes). Manual "Publish now" still works and is unaffected.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0012_clients_registry.sql to already be applied.
-- ============================================================================

alter table public.search_console_sites
  add column if not exists publish_cadence_per_week integer not null default 0, -- 0 = auto-publish off
  add column if not exists last_auto_published_at   timestamptz;

alter table public.saved_keywords
  add column if not exists approved_at timestamptz;

-- FIFO queue order per site.
create index if not exists saved_keywords_approved_idx on public.saved_keywords (site_id, approved_at) where status = 'approved';
