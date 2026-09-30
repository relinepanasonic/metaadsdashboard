-- ============================================================================
-- DIGITAL ADS  →  ERP Supabase project  ·  PHASE 2: schema + security rules
-- ----------------------------------------------------------------------------
-- Run this in the ERP's Supabase project (htokejxhuwodgxlmadpr) → SQL Editor.
-- It is ADDITIVE: it creates new "ads_*" tables and helper functions and widens
-- the role list on workspace_members. It does not touch or read any ERP finance
-- table, and it can be re-run safely.
--
-- BEFORE RUNNING, read "0. CHECK THESE FIRST" below.
--
-- Model (matches the ERP):
--   workspace          = a company. All Digital Ads data belongs to ONE workspace:
--                        Profesor Toko Online (stored in ads_settings).
--   clients            = the ERP's own clients table (contact_type = 'client').
--                        Each advertising brand IS one of those rows.
--   ads_client_profiles= the ad-specific fields of a brand (website, Meta / Google
--                        account ids). 1:1 with clients.
--   roles              = workspace_members.role, plus client_assignments:
--        founder     hard-coded by email; everything, every workspace
--        superadmin  everything in the workspace
--        advertiser  read + write, ONLY assigned clients
--        client      read only, ONLY assigned clients (new)
--        accounting / admin   no access to any Digital Ads data
--
-- Tables that used to be keyed by client NAME are keyed by client_id here.
-- Writes from the app's background jobs (daily sync, Make.com callbacks) use the
-- service-role key, which bypasses these rules by design; the rules below protect
-- every other route in (browser sessions, the anon key).
-- ============================================================================


-- ============================================================================
-- 0. CHECK THESE FIRST
-- ============================================================================
-- (a) The founder e-mails below MUST match the ERP code's founder list. As agreed,
--     relinepanasonic@gmail.com is NOT a founder any more (it is a client).
--     If professortokoonline@gmail.com should also be a founder, add it here AND
--     in the ERP code.
create or replace function public.ads_founder_emails() returns text[]
language sql immutable as $$ select array['nicojapar@gmail.com']::text[] $$;

-- (b) The workspace that owns Digital Ads. Matched by name; if it matches zero or
--     more than one workspace, nothing is set and a NOTICE lists the candidates —
--     then set it by hand:
--       insert into public.ads_settings(key, value) values ('home_workspace_id', '<uuid>')
--       on conflict (key) do update set value = excluded.value;
create table if not exists public.ads_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

do $$
declare
  n int;
  ws uuid;
  names text;
begin
  select count(*), min(id::text)::uuid, string_agg(name, ' | ')
    into n, ws, names
  from public.workspaces
  where name ilike '%toko online%' or slug ilike '%toko%online%';

  if n = 1 then
    insert into public.ads_settings(key, value) values ('home_workspace_id', ws::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
    raise notice 'Digital Ads home workspace set to % (%)', ws, names;
  else
    raise notice 'Could not pick the home workspace automatically (% match: %). Set ads_settings.home_workspace_id by hand.', n, coalesce(names, 'none');
  end if;
end $$;

-- (c) Roles: widen workspace_members.role so advertiser, client and founder are
--     allowed. (The ERP's schema.sql only lists superadmin / accounting / admin,
--     but its code already uses advertiser and founder.)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.workspace_members'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.workspace_members drop constraint %I', c);
  end loop;
  alter table public.workspace_members
    add constraint workspace_members_role_check
    check (role in ('founder', 'superadmin', 'accounting', 'admin', 'advertiser', 'client'));
end $$;

-- !!! SECURITY WARNING — READ BEFORE GIVING ANYONE THE 'client' ROLE !!!
-- The ERP's existing security rules let ANY workspace member read the workspace's
-- finance tables. A client (or advertiser) added to workspace_members can read
-- invoices through the API unless those rules are restricted to finance roles.
-- The ERP app must be fixed first — see ERP_CLIENT_ROLE_PROMPT.md.


-- ============================================================================
-- 1. HELPER FUNCTIONS (used by every rule below)
-- ============================================================================
create or replace function public.ads_is_founder() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and lower(u.email) = any (public.ads_founder_emails())
  )
$$;

-- The caller's role in a workspace ('founder' beats everything).
create or replace function public.ads_workspace_role(ws uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select case
    when public.ads_is_founder() then 'founder'
    else (select m.role from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() limit 1)
  end
$$;

create or replace function public.ads_is_assigned(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and exists (
    select 1 from public.client_assignments a where a.client_id = cid and a.user_id = auth.uid()
  )
$$;

-- May the caller SEE data of this client? (client_id may be null = unassigned data)
create or replace function public.ads_can_read(ws uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.ads_workspace_role(ws)
    when 'founder'    then true
    when 'superadmin' then true
    when 'advertiser' then public.ads_is_assigned(cid)
    when 'client'     then public.ads_is_assigned(cid)
    else false
  end
$$;

-- May the caller CHANGE data of this client? Clients are read-only.
create or replace function public.ads_can_write(ws uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.ads_workspace_role(ws)
    when 'founder'    then true
    when 'superadmin' then true
    when 'advertiser' then public.ads_is_assigned(cid)
    else false
  end
$$;

-- Workspace-wide staff (for data that is not tied to one client).
create or replace function public.ads_is_staff(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ads_workspace_role(ws) in ('founder', 'superadmin', 'advertiser')
$$;

create or replace function public.ads_is_admin(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ads_workspace_role(ws) in ('founder', 'superadmin')
$$;

-- The home workspace (null until step 0b succeeded).
create or replace function public.ads_home_workspace() returns uuid
language sql stable as $$ select (select value::uuid from public.ads_settings where key = 'home_workspace_id') $$;


-- ============================================================================
-- 2. BRANDS, ACCOUNTS AND PROFILES
-- ============================================================================
-- Ad-specific fields of an ERP client (the brand's name / owner / e-mail live on
-- clients itself: name, contact_name, email).
create table if not exists public.ads_client_profiles (
  client_id             uuid primary key references public.clients(id) on delete cascade,
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  pic                   text,
  website_domain        text,
  meta_ad_account_id    text,          -- Meta ad account id, without "act_"
  google_ads_account_id text,
  updated_at            timestamptz not null default now()
);
create index if not exists ads_client_profiles_ws_idx on public.ads_client_profiles (workspace_id);

-- Instagram accounts and Facebook Pages linked to a brand. These also feed the
-- Social Media dashboard.
create table if not exists public.ads_social_accounts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  platform     text not null check (platform in ('instagram', 'facebook')),
  external_id  text not null,
  handle       text,
  created_at   timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists ads_social_accounts_client_idx on public.ads_social_accounts (client_id);
create index if not exists ads_social_accounts_ext_idx on public.ads_social_accounts (external_id);

-- Threads / X / TikTok / YouTube accounts (posting only).
create table if not exists public.ads_publish_profiles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  platform     text not null check (platform in ('threads', 'x', 'tiktok', 'youtube')),
  handle       text not null,
  external_id  text,
  created_at   timestamptz not null default now(),
  unique (client_id, platform, handle)
);

-- Which brand a Meta campaign belongs to (was keyed by client NAME).
create table if not exists public.ads_campaign_clients (
  campaign_id   text primary key,
  ad_account_id text not null,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  client_name   text,                 -- display copy, kept while the app is being moved over
  updated_at    timestamptz not null default now()
);
create index if not exists ads_campaign_clients_account_idx on public.ads_campaign_clients (ad_account_id);
create index if not exists ads_campaign_clients_client_idx on public.ads_campaign_clients (client_id);


-- ============================================================================
-- 3. SOCIAL MEDIA HISTORY (filled by the daily sync)
-- ============================================================================
create table if not exists public.ads_instagram_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  ig_user_id         text not null,
  snapshot_date      date not null,
  followers_count    integer,
  media_count        integer,
  reach              integer,
  views              integer,
  profile_views      integer,
  accounts_engaged   integer,
  total_interactions integer,
  website_clicks     integer,
  profile_links_taps integer,
  follows            integer,
  unfollows          integer,
  created_at         timestamptz not null default now(),
  unique (ig_user_id, snapshot_date)
);
create index if not exists ads_instagram_snapshots_idx on public.ads_instagram_snapshots (ig_user_id, snapshot_date desc);

create table if not exists public.ads_instagram_posts (
  media_id            text primary key,
  ig_user_id          text not null,
  caption             text,
  media_type          text,
  media_product_type  text,
  permalink           text,
  posted_at           timestamptz,
  like_count          integer,
  comments_count      integer,
  thumbnail_url       text,
  media_url           text,
  reach               integer,
  views               integer,
  saved               integer,
  shares              integer,
  reposts             integer,
  total_interactions  integer,
  avg_watch_time_ms   integer,
  total_watch_ms      bigint,
  skip_rate           numeric,
  follows             integer,
  profile_visits      integer,
  insights_updated_at timestamptz,
  updated_at          timestamptz not null default now()
);
create index if not exists ads_instagram_posts_idx on public.ads_instagram_posts (ig_user_id, posted_at desc);

create table if not exists public.ads_instagram_demographics (
  id             uuid primary key default gen_random_uuid(),
  ig_user_id     text not null,
  snapshot_month text not null,
  audience       text not null check (audience in ('followers', 'engaged')),
  breakdown      text not null check (breakdown in ('age', 'gender', 'city', 'country')),
  key            text not null,
  value          integer not null,
  updated_at     timestamptz not null default now(),
  unique (ig_user_id, snapshot_month, audience, breakdown, key)
);
create index if not exists ads_instagram_demographics_idx on public.ads_instagram_demographics (ig_user_id, snapshot_month desc);

create table if not exists public.ads_instagram_stories (
  story_id           text primary key,
  ig_user_id         text not null,
  posted_at          timestamptz,
  media_type         text,
  permalink          text,
  thumbnail_url      text,
  reach              integer,
  views              integer,
  replies            integer,
  shares             integer,
  total_interactions integer,
  follows            integer,
  profile_visits     integer,
  taps_forward       integer,
  taps_back          integer,
  exits              integer,
  swipes_forward     integer,
  updated_at         timestamptz not null default now()
);
create index if not exists ads_instagram_stories_idx on public.ads_instagram_stories (ig_user_id, posted_at desc);

create table if not exists public.ads_facebook_snapshots (
  id              uuid primary key default gen_random_uuid(),
  page_id         text not null,
  snapshot_date   date not null,
  followers_count integer,
  fan_count       integer,
  created_at      timestamptz not null default now(),
  unique (page_id, snapshot_date)
);
create index if not exists ads_facebook_snapshots_idx on public.ads_facebook_snapshots (page_id, snapshot_date desc);

create table if not exists public.ads_facebook_posts (
  post_id         text primary key,
  page_id         text not null,
  message         text,
  permalink       text,
  posted_at       timestamptz,
  reactions_count integer,
  comments_count  integer,
  updated_at      timestamptz not null default now()
);
create index if not exists ads_facebook_posts_idx on public.ads_facebook_posts (page_id, posted_at desc);


-- ============================================================================
-- 4. GOOGLE ADS WAREHOUSE (was migration 0021, never run on the old project)
-- ============================================================================
create table if not exists public.ads_google_accounts (
  customer_id     text primary key,
  name            text,
  currency        text,
  time_zone       text,
  is_manager      boolean not null default false,
  last_synced_at  timestamptz,
  last_error      text,
  first_data_date date
);

create table if not exists public.ads_google_campaign_daily (
  customer_id    text        not null,
  campaign_id    text        not null,
  date           date        not null,
  campaign_name  text,
  status         text,
  channel_type   text,
  bidding        text,
  budget         numeric,
  impressions    bigint  not null default 0,
  clicks         bigint  not null default 0,
  cost           numeric not null default 0,
  conversions    numeric not null default 0,
  conv_value     numeric not null default 0,
  search_is      numeric,
  lost_is_budget numeric,
  lost_is_rank   numeric,
  primary key (customer_id, campaign_id, date)
);
create index if not exists ads_google_campaign_daily_date_idx on public.ads_google_campaign_daily (customer_id, date);

create table if not exists public.ads_google_segment_daily (
  customer_id text   not null,
  date        date   not null,
  dimension   text   not null,
  key         text   not null,
  impressions bigint  not null default 0,
  clicks      bigint  not null default 0,
  cost        numeric not null default 0,
  conversions numeric not null default 0,
  conv_value  numeric not null default 0,
  primary key (customer_id, date, dimension, key)
);

create table if not exists public.ads_google_items (
  customer_id text not null,
  kind        text not null,
  key         text not null,
  label       text,
  parent      text,
  sub         text,
  status      text,
  impressions bigint  not null default 0,
  clicks      bigint  not null default 0,
  cost        numeric not null default 0,
  conversions numeric not null default 0,
  conv_value  numeric not null default 0,
  extra       jsonb   not null default '{}'::jsonb,
  synced_at   timestamptz not null default now(),
  primary key (customer_id, kind, key)
);


-- ============================================================================
-- 5. SCHEDULER (Make.com publishes what is queued here)
-- ============================================================================
create table if not exists public.ads_scheduled_posts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  caption      text not null default '',
  content_type text not null default 'reel' check (content_type in ('reel', 'video', 'image', 'carousel', 'text')),
  media        jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  status       text not null default 'scheduled' check (status in ('draft', 'scheduled', 'cancelled')),
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ads_scheduled_posts_due_idx on public.ads_scheduled_posts (status, scheduled_at);

create table if not exists public.ads_scheduled_post_targets (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.ads_scheduled_posts(id) on delete cascade,
  platform      text not null check (platform in ('instagram', 'facebook', 'threads', 'x', 'tiktok', 'youtube')),
  handle        text,
  external_id   text,
  status        text not null default 'pending' check (status in ('pending', 'claimed', 'published', 'failed', 'cancelled')),
  attempts      integer not null default 0,
  claimed_at    timestamptz,
  published_at  timestamptz,
  published_url text,
  published_id  text,
  error         text
);
create index if not exists ads_scheduled_post_targets_post_idx on public.ads_scheduled_post_targets (post_id);
create index if not exists ads_scheduled_post_targets_status_idx on public.ads_scheduled_post_targets (status);

create table if not exists public.ads_scheduler_state (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 6. SEO
-- ============================================================================
create table if not exists public.ads_sites (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  client_id                 uuid references public.clients(id) on delete set null,
  site_url                  text,
  domain                    text not null,
  label                     text not null,
  status                    text not null default 'none' check (status in ('none', 'pending', 'connected', 'error')),
  last_error                text,
  last_synced_at            timestamptz,
  connected_by              uuid references auth.users(id) on delete set null,
  publish_url               text,
  publish_secret            text,          -- server-only: never select this column for a browser
  publish_cadence_per_week  integer not null default 0,
  last_auto_published_at    timestamptz,
  parent_site_id            uuid references public.ads_sites(id) on delete cascade,
  path_prefix               text,
  created_at                timestamptz not null default now(),
  unique (domain),
  check ((parent_site_id is null) = (path_prefix is null))
);
create index if not exists ads_sites_client_idx on public.ads_sites (client_id);
create index if not exists ads_sites_parent_idx on public.ads_sites (parent_site_id);

create table if not exists public.ads_saved_keywords (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid references public.ads_sites(id) on delete cascade,
  keyword      text not null,
  volume       integer,
  difficulty   integer,
  cpc_usd      numeric,
  position     integer,
  source       text not null,
  context      text,
  status       text not null default 'idea',
  draft_title  text,
  draft_slug   text,
  draft_meta   text,
  draft_excerpt text,
  draft_html   text,
  draft_tag    text,
  published_url text,
  published_at timestamptz,
  approved_at  timestamptz,
  saved_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (site_id, keyword, source, context)
);
create index if not exists ads_saved_keywords_created_idx on public.ads_saved_keywords (created_at desc);
create index if not exists ads_saved_keywords_status_idx on public.ads_saved_keywords (status);
create index if not exists ads_saved_keywords_site_idx on public.ads_saved_keywords (site_id);


-- ============================================================================
-- 7. CUSTOMER LISTS (Meta Ads → Audience) — workspace staff only
-- ============================================================================
create table if not exists public.ads_audience_batches (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label        text not null,
  row_count    integer not null default 0,
  uploaded_by  uuid references auth.users(id) on delete set null,
  uploaded_at  timestamptz not null default now()
);

create table if not exists public.ads_audience_records (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.ads_audience_batches(id) on delete cascade,
  email1 text, email2 text, email3 text,
  phone1 text, phone2 text, phone3 text,
  madid text, fn text, ln text, zip text, ct text, st text, country text,
  dob text, doby integer, gen text, age integer, uid text, value numeric,
  branch_city text, branch_name text, category text, product text, full_name text,
  created_at  timestamptz not null default now()
);
create index if not exists ads_audience_records_batch_idx on public.ads_audience_records (batch_id);
create index if not exists ads_audience_records_country_idx on public.ads_audience_records (country);
create index if not exists ads_audience_records_value_idx on public.ads_audience_records (value);
create index if not exists ads_audience_records_branch_idx on public.ads_audience_records (branch_name);
create index if not exists ads_audience_records_category_idx on public.ads_audience_records (category);


-- ============================================================================
-- 8. SECURITY RULES (row level security)
-- ============================================================================
-- Pattern: read = ads_can_read(workspace, client); write = ads_can_write(...).
-- Tables keyed by an account id look the brand up through ads_social_accounts.
-- Tables with no policy for a command deny it (only the service role can write them).

do $$
declare t text;
begin
  foreach t in array array[
    'ads_settings','ads_client_profiles','ads_social_accounts','ads_publish_profiles','ads_campaign_clients',
    'ads_instagram_snapshots','ads_instagram_posts','ads_instagram_demographics','ads_instagram_stories',
    'ads_facebook_snapshots','ads_facebook_posts',
    'ads_google_accounts','ads_google_campaign_daily','ads_google_segment_daily','ads_google_items',
    'ads_scheduled_posts','ads_scheduled_post_targets','ads_scheduler_state',
    'ads_sites','ads_saved_keywords','ads_audience_batches','ads_audience_records'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- helper to (re)create a policy without errors on re-run
create or replace function public.ads__policy(tbl text, pol text, cmd text, using_sql text, check_sql text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', pol, tbl);
  if check_sql is null then
    execute format('create policy %I on public.%I for %s to authenticated using (%s)', pol, tbl, cmd, using_sql);
  else
    execute format('create policy %I on public.%I for %s to authenticated %s with check (%s)', pol, tbl, cmd,
                   case when cmd = 'insert' then '' else 'using (' || using_sql || ')' end, check_sql);
  end if;
end $$;

-- ads_settings: everyone signed in may read (needed to find the home workspace); nobody writes from a browser.
select public.ads__policy('ads_settings', 'ads_settings_read', 'select', 'true');

-- Tables that carry workspace_id + client_id directly ------------------------------
select public.ads__policy('ads_client_profiles', 'ads_client_profiles_read',  'select', 'public.ads_can_read(workspace_id, client_id)');
select public.ads__policy('ads_client_profiles', 'ads_client_profiles_ins',   'insert', null, 'public.ads_is_admin(workspace_id)');
select public.ads__policy('ads_client_profiles', 'ads_client_profiles_upd',   'update', 'public.ads_can_write(workspace_id, client_id)', 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_client_profiles', 'ads_client_profiles_del',   'delete', 'public.ads_is_admin(workspace_id)');

select public.ads__policy('ads_social_accounts', 'ads_social_accounts_read', 'select', 'public.ads_can_read(workspace_id, client_id)');
select public.ads__policy('ads_social_accounts', 'ads_social_accounts_ins',  'insert', null, 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_social_accounts', 'ads_social_accounts_del',  'delete', 'public.ads_can_write(workspace_id, client_id)');

select public.ads__policy('ads_publish_profiles', 'ads_publish_profiles_read', 'select', 'public.ads_can_read(workspace_id, client_id)');
select public.ads__policy('ads_publish_profiles', 'ads_publish_profiles_ins',  'insert', null, 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_publish_profiles', 'ads_publish_profiles_del',  'delete', 'public.ads_can_write(workspace_id, client_id)');

select public.ads__policy('ads_campaign_clients', 'ads_campaign_clients_read', 'select', 'public.ads_can_read(workspace_id, client_id)');
select public.ads__policy('ads_campaign_clients', 'ads_campaign_clients_ins',  'insert', null, 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_campaign_clients', 'ads_campaign_clients_upd',  'update', 'public.ads_can_write(workspace_id, client_id)', 'public.ads_can_write(workspace_id, client_id)');

select public.ads__policy('ads_scheduled_posts', 'ads_scheduled_posts_read', 'select', 'public.ads_can_write(workspace_id, client_id)');  -- clients never see the scheduler
select public.ads__policy('ads_scheduled_posts', 'ads_scheduled_posts_ins',  'insert', null, 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_scheduled_posts', 'ads_scheduled_posts_upd',  'update', 'public.ads_can_write(workspace_id, client_id)', 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_scheduled_posts', 'ads_scheduled_posts_del',  'delete', 'public.ads_can_write(workspace_id, client_id)');

-- Targets follow their post.
select public.ads__policy('ads_scheduled_post_targets', 'ads_sched_targets_read', 'select',
  'exists (select 1 from public.ads_scheduled_posts p where p.id = post_id and public.ads_can_write(p.workspace_id, p.client_id))');
select public.ads__policy('ads_scheduled_post_targets', 'ads_sched_targets_ins', 'insert', null,
  'exists (select 1 from public.ads_scheduled_posts p where p.id = post_id and public.ads_can_write(p.workspace_id, p.client_id))');
select public.ads__policy('ads_scheduled_post_targets', 'ads_sched_targets_upd', 'update',
  'exists (select 1 from public.ads_scheduled_posts p where p.id = post_id and public.ads_can_write(p.workspace_id, p.client_id))',
  'exists (select 1 from public.ads_scheduled_posts p where p.id = post_id and public.ads_can_write(p.workspace_id, p.client_id))');
select public.ads__policy('ads_scheduled_post_targets', 'ads_sched_targets_del', 'delete',
  'exists (select 1 from public.ads_scheduled_posts p where p.id = post_id and public.ads_can_write(p.workspace_id, p.client_id))');

-- Scheduler state (Make's last check-in): workspace staff can read.
select public.ads__policy('ads_scheduler_state', 'ads_scheduler_state_read', 'select', 'public.ads_is_staff(public.ads_home_workspace())');

-- SEO: sites belong to a brand (or are unassigned = admins only). Keywords follow the site.
select public.ads__policy('ads_sites', 'ads_sites_read', 'select', 'public.ads_can_read(workspace_id, client_id)');
select public.ads__policy('ads_sites', 'ads_sites_ins',  'insert', null, 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_sites', 'ads_sites_upd',  'update', 'public.ads_can_write(workspace_id, client_id)', 'public.ads_can_write(workspace_id, client_id)');
select public.ads__policy('ads_sites', 'ads_sites_del',  'delete', 'public.ads_is_admin(workspace_id)');

select public.ads__policy('ads_saved_keywords', 'ads_keywords_read', 'select',
  'exists (select 1 from public.ads_sites s where s.id = site_id and public.ads_can_read(s.workspace_id, s.client_id))');
select public.ads__policy('ads_saved_keywords', 'ads_keywords_ins', 'insert', null,
  'exists (select 1 from public.ads_sites s where s.id = site_id and public.ads_can_write(s.workspace_id, s.client_id))');
select public.ads__policy('ads_saved_keywords', 'ads_keywords_upd', 'update',
  'exists (select 1 from public.ads_sites s where s.id = site_id and public.ads_can_write(s.workspace_id, s.client_id))',
  'exists (select 1 from public.ads_sites s where s.id = site_id and public.ads_can_write(s.workspace_id, s.client_id))');
select public.ads__policy('ads_saved_keywords', 'ads_keywords_del', 'delete',
  'exists (select 1 from public.ads_sites s where s.id = site_id and public.ads_can_write(s.workspace_id, s.client_id))');

-- Customer lists: staff only, never clients.
select public.ads__policy('ads_audience_batches', 'ads_audience_batches_read', 'select', 'public.ads_is_staff(workspace_id)');
select public.ads__policy('ads_audience_batches', 'ads_audience_batches_ins',  'insert', null, 'public.ads_is_staff(workspace_id)');
select public.ads__policy('ads_audience_batches', 'ads_audience_batches_del',  'delete', 'public.ads_is_staff(workspace_id)');
select public.ads__policy('ads_audience_records', 'ads_audience_records_read', 'select',
  'exists (select 1 from public.ads_audience_batches b where b.id = batch_id and public.ads_is_staff(b.workspace_id))');
select public.ads__policy('ads_audience_records', 'ads_audience_records_ins', 'insert', null,
  'exists (select 1 from public.ads_audience_batches b where b.id = batch_id and public.ads_is_staff(b.workspace_id))');
select public.ads__policy('ads_audience_records', 'ads_audience_records_del', 'delete',
  'exists (select 1 from public.ads_audience_batches b where b.id = batch_id and public.ads_is_staff(b.workspace_id))');

-- Tables keyed by an account id: read through the brand that owns the account ------
-- (written only by the daily sync with the service role, so no write policies)
select public.ads__policy('ads_instagram_snapshots', 'ads_ig_snap_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''instagram'' and a.external_id = ig_user_id and public.ads_can_read(a.workspace_id, a.client_id))');
select public.ads__policy('ads_instagram_posts', 'ads_ig_posts_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''instagram'' and a.external_id = ig_user_id and public.ads_can_read(a.workspace_id, a.client_id))');
select public.ads__policy('ads_instagram_demographics', 'ads_ig_demo_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''instagram'' and a.external_id = ig_user_id and public.ads_can_read(a.workspace_id, a.client_id))');
select public.ads__policy('ads_instagram_stories', 'ads_ig_stories_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''instagram'' and a.external_id = ig_user_id and public.ads_can_read(a.workspace_id, a.client_id))');
select public.ads__policy('ads_facebook_snapshots', 'ads_fb_snap_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''facebook'' and a.external_id = page_id and public.ads_can_read(a.workspace_id, a.client_id))');
select public.ads__policy('ads_facebook_posts', 'ads_fb_posts_read', 'select',
  'exists (select 1 from public.ads_social_accounts a where a.platform = ''facebook'' and a.external_id = page_id and public.ads_can_read(a.workspace_id, a.client_id))');

-- Google Ads: read through the brand whose profile holds that customer id.
select public.ads__policy('ads_google_accounts', 'ads_g_accounts_read', 'select',
  'exists (select 1 from public.ads_client_profiles p where regexp_replace(coalesce(p.google_ads_account_id, ''''), ''[^0-9]'', '''', ''g'') = customer_id and public.ads_can_read(p.workspace_id, p.client_id)) or public.ads_is_admin(public.ads_home_workspace())');
select public.ads__policy('ads_google_campaign_daily', 'ads_g_campaign_read', 'select',
  'exists (select 1 from public.ads_client_profiles p where regexp_replace(coalesce(p.google_ads_account_id, ''''), ''[^0-9]'', '''', ''g'') = customer_id and public.ads_can_read(p.workspace_id, p.client_id)) or public.ads_is_admin(public.ads_home_workspace())');
select public.ads__policy('ads_google_segment_daily', 'ads_g_segment_read', 'select',
  'exists (select 1 from public.ads_client_profiles p where regexp_replace(coalesce(p.google_ads_account_id, ''''), ''[^0-9]'', '''', ''g'') = customer_id and public.ads_can_read(p.workspace_id, p.client_id)) or public.ads_is_admin(public.ads_home_workspace())');
select public.ads__policy('ads_google_items', 'ads_g_items_read', 'select',
  'exists (select 1 from public.ads_client_profiles p where regexp_replace(coalesce(p.google_ads_account_id, ''''), ''[^0-9]'', '''', ''g'') = customer_id and public.ads_can_read(p.workspace_id, p.client_id)) or public.ads_is_admin(public.ads_home_workspace())');


-- ============================================================================
-- 9. MEDIA BUCKET for scheduled posts (public read: Instagram and Make fetch by URL)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('social-media', 'social-media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists social_media_read   on storage.objects;
drop policy if exists social_media_insert on storage.objects;
drop policy if exists social_media_delete on storage.objects;
create policy social_media_read   on storage.objects for select to anon, authenticated using (bucket_id = 'social-media');
-- uploads need a signed-in user (the shared ERP login); no anonymous uploads any more
create policy social_media_insert on storage.objects for insert to authenticated with check (bucket_id = 'social-media');
create policy social_media_delete on storage.objects for delete to authenticated using (bucket_id = 'social-media');


-- ============================================================================
-- 10. SELF-CHECK — prints what was created
-- ============================================================================
do $$
declare n int;
begin
  select count(*) into n from information_schema.tables where table_schema = 'public' and table_name like 'ads\_%';
  raise notice 'Digital Ads schema ready: % ads_* tables. Home workspace: %', n, coalesce(public.ads_home_workspace()::text, 'NOT SET — see step 0b');
end $$;
