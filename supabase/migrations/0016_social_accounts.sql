-- ============================================================================
-- 0016_social_accounts.sql
-- One client (owner/brand) can have many Instagram accounts and many Facebook
-- Pages. Replaces the single clients.instagram_user_id with a proper list:
-- social_accounts (client -> N accounts, any platform). The old clients columns
-- are left in place but no longer used; existing values are copied across.
-- Also adds Facebook Page history tables (follower snapshots + posts).
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0015_instagram.sql to already be applied.
-- ============================================================================

create table if not exists public.social_accounts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  platform     text not null check (platform in ('instagram', 'facebook')),
  external_id  text not null,      -- Instagram account id, or Facebook Page id
  handle       text,               -- @username, or the Page name
  created_at   timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists social_accounts_client_idx on public.social_accounts (client_id);

-- Carry over accounts already linked on the old single-account columns.
insert into public.social_accounts (client_id, platform, external_id, handle)
select id, 'instagram', instagram_user_id, instagram_handle
from public.clients
where instagram_user_id is not null and instagram_user_id <> ''
on conflict (platform, external_id) do nothing;

create table if not exists public.facebook_snapshots (
  id              uuid primary key default gen_random_uuid(),
  page_id         text not null,
  snapshot_date   date not null,
  followers_count integer,
  fan_count       integer,
  created_at      timestamptz not null default now(),
  unique (page_id, snapshot_date)
);

create index if not exists facebook_snapshots_idx on public.facebook_snapshots (page_id, snapshot_date desc);

create table if not exists public.facebook_posts (
  post_id         text primary key,
  page_id         text not null,
  message         text,
  permalink       text,
  posted_at       timestamptz,
  reactions_count integer,
  comments_count  integer,
  updated_at      timestamptz not null default now()
);

create index if not exists facebook_posts_idx on public.facebook_posts (page_id, posted_at desc);

alter table public.social_accounts enable row level security;
alter table public.facebook_snapshots enable row level security;
alter table public.facebook_posts enable row level security;

drop policy if exists social_accounts_all on public.social_accounts;
create policy social_accounts_all on public.social_accounts for all using (true) with check (true);

drop policy if exists facebook_snapshots_all on public.facebook_snapshots;
create policy facebook_snapshots_all on public.facebook_snapshots for all using (true) with check (true);

drop policy if exists facebook_posts_all on public.facebook_posts;
create policy facebook_posts_all on public.facebook_posts for all using (true) with check (true);
