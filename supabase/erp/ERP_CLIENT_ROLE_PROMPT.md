# Prompt for the ERP app ("Accounting Prof") — and any other app that shares this login

Paste everything below into the Claude session that works on the ERP repo.

---

I am connecting my Digital Ads app to this ERP. Both must share the SAME users, roles and clients. The Digital Ads app is moving into THIS Supabase project (its tables are `ads_*`, added by `supabase/erp/001_ads_schema.sql` — do not edit or drop them). This app must be adjusted so the shared login is safe. **Read the relevant guide in `node_modules/next/dist/docs/` first (this Next.js version has breaking changes), inspect the current code, then propose a short plan and WAIT for my approval before changing the database or code.**

## 1. Add a `client` role (read-only, by assignment)
- `workspace_members.role` now allows: `founder`, `superadmin`, `accounting`, `admin`, `advertiser`, `client`. (The Digital Ads schema file already widened the CHECK constraint — verify it in the live DB.)
- `client` = a brand's own login. It sees ONLY the clients it is assigned to in `client_assignments`, read-only, and ONLY inside the Digital Ads app. **A `client` (and an `advertiser`) must have NO access to any finance module of this ERP.**
- Show and manage the `client` role in the Team / Invite UI and in the Assignments page (`/productivity/assignments`), exactly like `advertiser`. Only superadmin/founder can invite or assign.

## 2. CRITICAL — close the finance data hole BEFORE creating any client user
Today the security rules on the ERP tables allow any row of the workspace to any `workspace_members` member. Once a `client`/`advertiser` is a member, they could read ledger, invoices, payroll, bank statements, etc. by calling the API directly, even if the UI hides the menu.
- Audit EVERY table and RLS policy (including storage buckets and RPC/functions). Restrict finance tables to roles `superadmin`, `accounting`, `admin` (and the founder via the service role).
- Add a route guard so `client` and `advertiser` are redirected away from every finance route; the only ERP pages they may open are `/productivity/pabrik-sosmed/*`.
- Remove the fallback that treats "non-superadmin with no membership rows" as `accounting` for anyone who is not a real finance user, or make sure such users cannot reach finance data.
- Write tests: a `client` and an `advertiser` get 0 rows from every finance table; an `accounting` user still works.

## 3. Founder list
- Hard-coded founders are now ONLY `nicojapar@gmail.com`. **Remove `relinepanasonic@gmail.com` from the founder list** — it becomes a normal user with role `client`, assigned to the client "Panasonic". Update every place the list appears (workspace-context, actions, middleware, any SQL functions). The Digital Ads SQL uses `public.ads_founder_emails()`; keep it identical.
- If `professortokoonline@gmail.com` must be a founder, tell me and add it to BOTH lists.

## 4. Share the login across subdomains
- The Digital Ads app runs on `digitalads.profesoronline.id`; this ERP on `accounting.profesoronline.id`. Configure the Supabase SSR cookie options in `src/lib/supabase/{client,server}.ts` and `src/middleware.ts` with `domain: '.profesoronline.id'`, `secure: true`, `sameSite: 'lax'` so one sign-in works on both. Also share the `active_workspace_id` cookie the same way. Show me the change before applying it (it logs everyone out once).

## 5. Pabrik Sosmed pages
- `/productivity/pabrik-sosmed/dashboard` and `/upload` currently show placeholders. Replace each with a full-height `<iframe>` of the Digital Ads app: `https://digitalads.profesoronline.id/social-media?embed=1` (Dashboard) and `https://digitalads.profesoronline.id/social-media/schedule?embed=1` (Upload). No extra login: the shared cookie handles it.
- Allow these pages to the `client` and `advertiser` roles as well as superadmin/founder.

## 6. Rules to keep
- Do not invent role names. Do not duplicate the users / workspaces / clients / client_assignments tables.
- Enforce every rule server-side and in RLS, never only in the UI.
- Ask me about anything ambiguous instead of guessing.
