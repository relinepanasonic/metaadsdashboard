-- Re-Engine (Social Media -> Re-Engine): turns a successful post into new content prompts for Google Flow.
--   reengine_bibles  one "Series Bible" per client: the character, apartment, products, guests and rules that
--                    every prompt is built from (so they never drift)
--   reengine_runs    every generation: the source post, the hook analysis and the finished contents
-- Safe to run more than once.

create table if not exists public.reengine_bibles (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reengine_runs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  source      jsonb not null,
  analysis    jsonb,
  items       jsonb not null default '[]'::jsonb,
  provider    text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists reengine_runs_client_idx on public.reengine_runs (client_id, created_at desc);

alter table public.reengine_bibles enable row level security;
alter table public.reengine_runs   enable row level security;
drop policy if exists reengine_bibles_all on public.reengine_bibles;
drop policy if exists reengine_runs_all   on public.reengine_runs;
create policy reengine_bibles_all on public.reengine_bibles for all using (true) with check (true);
create policy reengine_runs_all   on public.reengine_runs   for all using (true) with check (true);
