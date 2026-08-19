-- ============================================================================
-- 0006_audience_custom_columns.sql
-- Adds the business-specific columns from the real internal Audience
-- template (City/SC Cabang/Category/Produk/Name), on top of the Meta-shaped
-- columns already added in 0005_audience.sql.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.audience_records add column if not exists branch_city text;   -- "City" (1st column) — store/outlet city
alter table public.audience_records add column if not exists branch_name text;   -- "SC Cabang" — branch/outlet name
alter table public.audience_records add column if not exists category   text;   -- "Category"
alter table public.audience_records add column if not exists product    text;   -- "Produk"
alter table public.audience_records add column if not exists full_name  text;   -- "Name" (combined, separate from fn/ln)

create index if not exists audience_records_branch_idx on public.audience_records (branch_name);
create index if not exists audience_records_category_idx on public.audience_records (category);
