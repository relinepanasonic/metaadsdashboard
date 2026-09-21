-- ============================================================================
-- 0021 — Google Ads data warehouse
-- ----------------------------------------------------------------------------
-- The Google Ads API is only called by the daily sync (and the "Sync now"
-- button); every page reads from these tables. That keeps the dashboard fast
-- and inside the free API quota, and it gives us history Google itself does not
-- keep in one place (impression-share trends, quality-score snapshots).
--
-- Amounts are stored in the ACCOUNT's own currency (whole units, not micros).
-- Which brand owns which account is clients.google_ads_account_id.
-- ============================================================================

-- One row per connected Google Ads account (customer id without dashes).
create table if not exists google_ads_accounts (
  customer_id     text primary key,
  name            text,
  currency        text,
  time_zone       text,
  is_manager      boolean not null default false,
  last_synced_at  timestamptz,
  last_error      text,
  first_data_date date
);

-- Campaign x day — the core fact table. Everything on the Overview, Campaigns
-- and Trend views is a sum over a date range of these rows.
create table if not exists google_ads_campaign_daily (
  customer_id     text        not null,
  campaign_id     text        not null,
  date            date        not null,
  campaign_name   text,
  status          text,            -- ENABLED | PAUSED | REMOVED
  channel_type    text,            -- SEARCH | SHOPPING | PERFORMANCE_MAX | DISPLAY | VIDEO | DEMAND_GEN ...
  bidding         text,            -- bidding strategy type
  budget          numeric,         -- daily budget, account currency
  impressions     bigint  not null default 0,
  clicks          bigint  not null default 0,
  cost            numeric not null default 0,
  conversions     numeric not null default 0,
  conv_value      numeric not null default 0,
  search_is       numeric,         -- search impression share (0..1)
  lost_is_budget  numeric,         -- share lost to budget
  lost_is_rank    numeric,         -- share lost to ad rank
  primary key (customer_id, campaign_id, date)
);
create index if not exists google_ads_campaign_daily_date_idx on google_ads_campaign_daily (customer_id, date);

-- Account x day x dimension: device, network, hour, age, gender, dow.
-- Small (a few dozen rows per day) and lets every breakdown honour the date picker.
create table if not exists google_ads_segment_daily (
  customer_id text   not null,
  date        date   not null,
  dimension   text   not null,      -- device | network | hour | age | gender
  key         text   not null,
  impressions bigint  not null default 0,
  clicks      bigint  not null default 0,
  cost        numeric not null default 0,
  conversions numeric not null default 0,
  conv_value  numeric not null default 0,
  primary key (customer_id, date, dimension, key)
);

-- Rolling "last 30 days" leaderboards: ad groups, keywords, search terms, ads.
-- Replaced wholesale on each sync. `extra` carries the per-kind detail
-- (quality score, match type, ad strength, approval status, ...).
create table if not exists google_ads_items (
  customer_id text not null,
  kind        text not null,        -- ad_group | keyword | search_term | ad
  key         text not null,
  label       text,
  parent      text,                 -- campaign name
  sub         text,                 -- ad group name
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

-- Same permissive policy as the rest of the app (role checks live in the API).
alter table google_ads_accounts       enable row level security;
alter table google_ads_campaign_daily enable row level security;
alter table google_ads_segment_daily  enable row level security;
alter table google_ads_items          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['google_ads_accounts','google_ads_campaign_daily','google_ads_segment_daily','google_ads_items'] loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_all', t);
  end loop;
end $$;
