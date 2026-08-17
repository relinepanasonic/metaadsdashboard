-- ============================================================================
-- 0001_client_assignments.sql
-- Manual campaign -> client assignment for the Meta Ads campaigns table.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

-- Roster of client names (for the dropdown options).
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Which client each campaign belongs to (overrides keyword inference).
create table if not exists public.campaign_clients (
  campaign_id   text primary key,          -- Meta campaign id
  ad_account_id text not null,             -- Meta ad account id (without act_)
  client_name   text not null,
  updated_at    timestamptz not null default now()
);

create index if not exists campaign_clients_account_idx
  on public.campaign_clients (ad_account_id);

-- Seed the client roster with the names we already infer from campaign names.
insert into public.clients (name) values
  ('Proone'), ('Timbangan ko Jhonny'), ('Occo'), ('HBO'),
  ('Panasonic'), ('New Wave'), ('Reline')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- RLS: this is an internal single-tenant tool, so allow the anon key to
-- read/write these two tables. Tighten later when you add real auth.
-- ----------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.campaign_clients enable row level security;

drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients
  for all using (true) with check (true);

drop policy if exists campaign_clients_all on public.campaign_clients;
create policy campaign_clients_all on public.campaign_clients
  for all using (true) with check (true);
