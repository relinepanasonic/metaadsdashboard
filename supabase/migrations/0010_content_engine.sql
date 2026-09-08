-- ============================================================================
-- 0010_content_engine.sql
-- Content Engine: turns a saved keyword into a published blog post.
-- Adds draft + publish state to saved_keywords so one keyword can only ever
-- become one post — this is what structurally prevents duplicate content.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.saved_keywords
  add column if not exists status        text not null default 'idea',  -- 'idea' | 'drafted' | 'published'
  add column if not exists draft_title   text,
  add column if not exists draft_slug    text,
  add column if not exists draft_meta    text,
  add column if not exists draft_excerpt text,
  add column if not exists draft_html    text,
  add column if not exists draft_tag     text,
  add column if not exists published_url text,
  add column if not exists published_at  timestamptz;

create index if not exists saved_keywords_status_idx on public.saved_keywords (status);
