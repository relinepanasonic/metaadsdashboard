-- ============================================================================
-- 0024 — Social Media scheduler (posts are queued here, Make.com publishes them)
-- ----------------------------------------------------------------------------
--  scheduled_posts         one row per piece of content (caption, media, time)
--  scheduled_post_targets  one row per destination account (Instagram, Facebook,
--                          Threads, TikTok) so each can succeed or fail alone
--  publish_profiles        Threads / TikTok accounts (Instagram and Facebook come
--                          from social_accounts, which already exists)
--  scheduler_state         small key/value store (when Make last checked in)
--  storage bucket          "social-media": public, so Make and Instagram can
--                          download the uploaded photos and videos
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

create table if not exists public.scheduled_posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id) on delete set null,
  caption         text not null default '',
  content_type    text not null default 'reel' check (content_type in ('reel', 'video', 'image', 'carousel', 'text')),
  media           jsonb not null default '[]'::jsonb,   -- [{ url, kind: 'image'|'video', name, size }]
  scheduled_at    timestamptz not null,
  status          text not null default 'scheduled' check (status in ('draft', 'scheduled', 'cancelled')),
  created_by      text,                                  -- username, for display
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);

create table if not exists public.scheduled_post_targets (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.scheduled_posts(id) on delete cascade,
  platform        text not null check (platform in ('instagram', 'facebook', 'threads', 'tiktok')),
  handle          text,                                  -- @username / Page name, for display
  external_id     text,                                  -- Instagram account id / Facebook Page id (when known)
  status          text not null default 'pending' check (status in ('pending', 'claimed', 'published', 'failed', 'cancelled')),
  attempts        integer not null default 0,
  claimed_at      timestamptz,
  published_at    timestamptz,
  published_url   text,
  published_id    text,
  error           text
);
create index if not exists scheduled_post_targets_post_idx on public.scheduled_post_targets (post_id);
create index if not exists scheduled_post_targets_status_idx on public.scheduled_post_targets (status);

create table if not exists public.publish_profiles (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  platform    text not null check (platform in ('threads', 'tiktok')),
  handle      text not null,
  external_id text,
  created_at  timestamptz not null default now(),
  unique (client_id, platform, handle)
);

create table if not exists public.scheduler_state (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Same permissive policy as the rest of the app (role checks live in the API).
alter table public.scheduled_posts        enable row level security;
alter table public.scheduled_post_targets enable row level security;
alter table public.publish_profiles       enable row level security;
alter table public.scheduler_state        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['scheduled_posts', 'scheduled_post_targets', 'publish_profiles', 'scheduler_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
  end loop;
end $$;

-- Public bucket for the media. 50 MB per file is the free-plan ceiling.
insert into storage.buckets (id, name, public, file_size_limit)
values ('social-media', 'social-media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists social_media_read   on storage.objects;
drop policy if exists social_media_insert on storage.objects;
drop policy if exists social_media_delete on storage.objects;
create policy social_media_read   on storage.objects for select to anon, authenticated using (bucket_id = 'social-media');
create policy social_media_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'social-media');
create policy social_media_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'social-media');
