-- ============================================================================
-- 0002_auth_roles.sql
-- Users, roles, and invite-link signup for the Meta Ads dashboard.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0001_client_assignments.sql to already be applied (uses `clients`).
-- ============================================================================

-- One row per authenticated user, linked 1:1 to Supabase Auth (auth.users).
create table if not exists public.app_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  email        text not null unique,
  role         text not null check (role in ('superadmin', 'advertiser', 'client')),
  client_name  text,              -- set when role = 'client': the single client they can see
  created_at   timestamptz not null default now()
);

-- Advertiser -> ad account assignments (many-to-many).
create table if not exists public.advertiser_accounts (
  user_id       uuid not null references public.app_users(id) on delete cascade,
  ad_account_id text not null,
  primary key (user_id, ad_account_id)
);

-- Invite links. A Superadmin or Advertiser creates one of these; the
-- recipient completes it at /invite/[token] to create their account.
create table if not exists public.invites (
  token            uuid primary key default gen_random_uuid(),
  role             text not null check (role in ('advertiser', 'client')),
  client_name      text,          -- required when role = 'client'
  ad_account_ids   text[],        -- required when role = 'advertiser'
  label            text,          -- friendly note, e.g. "Occo — client access"
  status           text not null default 'pending' check (status in ('pending', 'completed', 'revoked')),
  created_by       uuid references public.app_users(id),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '14 days'),
  completed_user_id uuid references public.app_users(id)
);

create index if not exists invites_status_idx on public.invites (status);

-- ----------------------------------------------------------------------------
-- RLS — anon key is used for both server and client reads in this app; access
-- control is enforced in application code (API routes check the caller's
-- session + role), not at the RLS layer, since this is a single internal app
-- with no direct client-side DB access to these tables.
-- ----------------------------------------------------------------------------
alter table public.app_users enable row level security;
alter table public.advertiser_accounts enable row level security;
alter table public.invites enable row level security;

drop policy if exists app_users_all on public.app_users;
create policy app_users_all on public.app_users for all using (true) with check (true);

drop policy if exists advertiser_accounts_all on public.advertiser_accounts;
create policy advertiser_accounts_all on public.advertiser_accounts for all using (true) with check (true);

drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Bootstrap: after you sign up your OWN account through Supabase Auth (or via
-- an invite), run this once to promote it to superadmin:
--
--   update public.app_users set role = 'superadmin' where email = 'you@example.com';
-- ----------------------------------------------------------------------------
