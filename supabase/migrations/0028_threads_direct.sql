-- Threads posting straight from this app (no Make.com):
--   * publish_profiles keeps each connected Threads account's login token (stored encrypted by the app)
--   * scheduled_posts.topic is the Threads topic tag for a post
--   * threads_topics is the per-brand dropdown of topics you use often
-- Safe to run more than once.

alter table public.publish_profiles add column if not exists access_token text;
alter table public.publish_profiles add column if not exists token_expires_at timestamptz;

alter table public.scheduled_posts add column if not exists topic text;

create table if not exists public.threads_topics (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (client_id, name)
);

alter table public.threads_topics enable row level security;
drop policy if exists threads_topics_all on public.threads_topics;
create policy threads_topics_all on public.threads_topics for all using (true) with check (true);
