-- ============================================================================
-- 0020_confirm_founder_emails.sql
-- Marks the two Founder logins as email-confirmed so they can sign in with the
-- temporary password right away, without waiting for the confirmation email.
-- Only these two accounts are touched; the project-wide "Confirm email"
-- setting stays on for everyone else.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- After running, sign in immediately and choose your own password: until you do,
-- anyone who knows the address and the temporary password could sign in first.
-- ============================================================================

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) in ('nicojapar@gmail.com', 'relinepanasonic@gmail.com');

-- Should return 2 rows, both with a confirmed time:
select email, email_confirmed_at from auth.users
where lower(email) in ('nicojapar@gmail.com', 'relinepanasonic@gmail.com');
