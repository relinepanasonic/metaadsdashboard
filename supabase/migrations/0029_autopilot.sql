-- Daily autopilot: one automatic blog post a day for a website, and one Threads post a day for a brand.
--   key         'blog:<site id>'  or  'threads:<client id>:<@handle>'
--   topic       Threads topic tag for the daily Threads post
--   samples     example Threads posts that worked, so the AI copies the style
--   instructions  extra rules for the writer
-- Safe to run more than once.

create table if not exists public.autopilot_settings (
  key           text primary key,
  kind          text not null check (kind in ('blog', 'threads')),
  client_id     uuid references public.clients(id) on delete cascade,
  site_id       uuid references public.search_console_sites(id) on delete cascade,
  handle        text,
  enabled       boolean not null default false,
  time_wib      text not null default '18:00',
  topic         text,
  samples       text,
  instructions  text,
  model         text,
  last_run_at   timestamptz,
  last_status   text,
  last_message  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.autopilot_settings enable row level security;
drop policy if exists autopilot_settings_all on public.autopilot_settings;
create policy autopilot_settings_all on public.autopilot_settings for all using (true) with check (true);
