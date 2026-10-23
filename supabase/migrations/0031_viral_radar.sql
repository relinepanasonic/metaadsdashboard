-- Viral Radar (Social Media -> Viral Radar): finds the Reels that beat their own account's usual results in a niche,
-- decodes why they worked, and feeds the Re-Engine. One watchlist PER OWN INSTAGRAM ACCOUNT, because each account
-- has its own niche and its own winners.
--   radar_accounts  niche description + the weekly agent switch, per own IG account
--   radar_watch     the niche accounts we watch (their public professional Instagram handles)
--   radar_reels     every collected Reel with its numbers, its outlier score and (once decoded) its structure
--   radar_briefs    the weekly agent's written summary
--   radar_tests     hook A/B tests: variants linked to our own posted Reels
-- Safe to run more than once.

create table if not exists public.radar_accounts (
  account_id  uuid primary key references public.social_accounts(id) on delete cascade,
  niche       text,
  auto        boolean not null default false,
  last_run_at timestamptz,
  last_status text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.radar_watch (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.social_accounts(id) on delete cascade,
  handle            text not null,
  note              text,
  followers         integer,
  last_collected_at timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  unique (account_id, handle)
);

create table if not exists public.radar_reels (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.social_accounts(id) on delete cascade,
  watch_id      uuid not null references public.radar_watch(id) on delete cascade,
  handle        text not null,
  media_id      text not null,
  caption       text,
  permalink     text,
  thumbnail_url text,
  media_url     text,
  posted_at     timestamptz,
  views         bigint,
  likes         integer,
  comments      integer,
  followers     integer,
  outlier       numeric,
  score_basis   text,
  collected_at  timestamptz not null default now(),
  decode        jsonb,
  decode_mode   text,
  decoded_at    timestamptz,
  decode_error  text,
  unique (account_id, media_id)
);
create index if not exists radar_reels_rank_idx on public.radar_reels (account_id, outlier desc);

create table if not exists public.radar_briefs (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  summary    text not null,
  reel_ids   jsonb not null default '[]'::jsonb,
  provider   text,
  created_at timestamptz not null default now()
);
create index if not exists radar_briefs_account_idx on public.radar_briefs (account_id, created_at desc);

create table if not exists public.radar_tests (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  title      text not null,
  notes      text,
  variants   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.radar_accounts enable row level security;
alter table public.radar_watch    enable row level security;
alter table public.radar_reels    enable row level security;
alter table public.radar_briefs   enable row level security;
alter table public.radar_tests    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['radar_accounts', 'radar_watch', 'radar_reels', 'radar_briefs', 'radar_tests'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
  end loop;
end $$;
