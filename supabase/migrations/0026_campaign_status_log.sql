-- ============================================================================
-- 0026 — who switched which Meta campaign on or off
-- ----------------------------------------------------------------------------
-- Written by /api/meta/campaign-status every time someone pauses or resumes a
-- campaign from the Meta Ads page. Optional: the switch works without it, you just
-- lose the history. Run in Supabase (ProfMetaAds) → SQL Editor.
-- ============================================================================

create table if not exists public.campaign_status_log (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   text not null,
  campaign_name text,
  ad_account_id text,
  from_status   text,
  to_status     text not null,
  changed_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists campaign_status_log_idx on public.campaign_status_log (campaign_id, created_at desc);

alter table public.campaign_status_log enable row level security;
drop policy if exists campaign_status_log_all on public.campaign_status_log;
create policy campaign_status_log_all on public.campaign_status_log for all using (true) with check (true);
