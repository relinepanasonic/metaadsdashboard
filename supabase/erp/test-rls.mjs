// Tests supabase/erp/001_ads_schema.sql in a throwaway in-memory Postgres (nothing touches a real database).
// Run:  npm i --no-save @electric-sql/pglite  &&  node supabase/erp/test-rls.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

const db = new PGlite();
const sql = fs.readFileSync(new URL("./001_ads_schema.sql", import.meta.url), "utf8");

// ---- stand-ins for what the ERP / Supabase already provide -------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text);
  -- Supabase's auth.uid() reads the JWT claim; here a setting stands in for it
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create table public.workspaces (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, created_at timestamptz default now());
  create table public.workspace_members (
    id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade, email text, display_name text,
    role text not null check (role in ('superadmin','accounting','admin')) default 'admin', unique(workspace_id,user_id));
  create table public.clients (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), name text not null, contact_type text default 'client');
  create table public.client_assignments (id uuid primary key default gen_random_uuid(), workspace_id uuid, client_id uuid references public.clients(id) on delete cascade, user_id uuid, unique(client_id,user_id));
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

// ---- 1. the migration itself, twice (must be re-runnable) ---------------------------
await db.exec(`insert into public.workspaces(name, slug) values ('Prof Toko Online','ptol'), ('New Wave Live Specialist','nwls'), ('PT Pintu Langit Inovasi Global','plig')`);
const notices = [];
async function runMigration(label) {
  try {
    await db.exec(sql);
    console.log(`PASS  migration ran (${label})`);
  } catch (e) {
    console.log(`FAIL  migration (${label}):`, e.message);
    process.exit(1);
  }
}
await runMigration("first run");
await runMigration("second run — idempotent");
const tables = (await db.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name like 'ads\\_%'`)).rows[0].n;
console.log("      ads_* tables:", tables);
console.log("      home workspace:", (await db.query(`select value from public.ads_settings where key='home_workspace_id'`)).rows[0]?.value ? "set" : "NOT SET");

// ---- 2. people ------------------------------------------------------------------------
const PTOL = (await db.query(`select id from public.workspaces where slug='ptol'`)).rows[0].id;
const NW = (await db.query(`select id from public.workspaces where slug='nwls'`)).rows[0].id;
const U = { founder: "00000000-0000-0000-0000-00000000000f", superadmin: "00000000-0000-0000-0000-0000000000a1", adv: "00000000-0000-0000-0000-0000000000a2", client: "00000000-0000-0000-0000-0000000000c1", acct: "00000000-0000-0000-0000-0000000000ac", otherws: "00000000-0000-0000-0000-0000000000e1", pan_client: "00000000-0000-0000-0000-0000000000c2" };
await db.exec(`
  insert into auth.users(id,email) values
   ('${U.founder}','nicojapar@gmail.com'),('${U.superadmin}','sa@x.com'),('${U.adv}','adv@x.com'),('${U.client}','client@x.com'),
   ('${U.acct}','acct@x.com'),('${U.otherws}','other@x.com'),('${U.pan_client}','relinepanasonic@gmail.com');
  insert into public.workspace_members(workspace_id,user_id,role) values
   ('${PTOL}','${U.superadmin}','superadmin'),('${PTOL}','${U.adv}','advertiser'),('${PTOL}','${U.client}','client'),
   ('${PTOL}','${U.acct}','accounting'),('${NW}','${U.otherws}','superadmin'),('${PTOL}','${U.pan_client}','client');
`);
const [PAN, PTO] = (await db.query(`insert into public.clients(workspace_id,name) values ('${PTOL}','Panasonic'),('${PTOL}','Prof Toko Online') returning id`)).rows.map((r) => r.id);
await db.exec(`
  insert into public.client_assignments(workspace_id,client_id,user_id) values
   ('${PTOL}','${PAN}','${U.adv}'), ('${PTOL}','${PAN}','${U.client}'), ('${PTOL}','${PAN}','${U.pan_client}');
  -- data as the service role would have written it (bypasses RLS: we are the table owner)
  insert into public.ads_client_profiles(client_id,workspace_id,google_ads_account_id) values ('${PAN}','${PTOL}','123-456-7890'),('${PTO}','${PTOL}',null);
  insert into public.ads_social_accounts(workspace_id,client_id,platform,external_id,handle) values
   ('${PTOL}','${PAN}','instagram','IG_PAN','@son.pawangac'),('${PTOL}','${PTO}','instagram','IG_PTO','@profesor.tokoonline');
  insert into public.ads_instagram_snapshots(ig_user_id,snapshot_date,reach) values ('IG_PAN','2026-09-01',100),('IG_PTO','2026-09-01',200);
  insert into public.ads_scheduled_posts(workspace_id,client_id,caption,scheduled_at) values ('${PTOL}','${PAN}','pan post',now()),('${PTOL}','${PTO}','pto post',now());
  insert into public.ads_google_campaign_daily(customer_id,campaign_id,date,cost) values ('1234567890','c1','2026-09-01',5);
  insert into public.ads_audience_batches(workspace_id,label) values ('${PTOL}','list');
  insert into public.ads_sites(workspace_id,client_id,domain,label) values ('${PTOL}',null,'unassigned.id','Unassigned'),('${PTOL}','${PAN}','nanocare.id','Nanocare');
  grant select,insert,update,delete on all tables in schema public to authenticated;
`);

// ---- 3. what each person can see ---------------------------------------------------------
async function as(uid, q) {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`);
  try {
    const r = await db.query(q);
    return r.rows;
  } catch (e) {
    return "ERR: " + e.message;
  } finally {
    await db.exec(`reset role; set test.uid = '';`);
  }
}
let failed = 0;
function expect(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
}
const names = async (uid, q) => { const r = await as(uid, q); return typeof r === "string" ? r : r.map((x) => Object.values(x)[0]).sort(); };

const brandQ = `select handle from public.ads_social_accounts order by 1`;
expect("founder sees every account (all brands)", await names(U.founder, brandQ), ["@profesor.tokoonline", "@son.pawangac"]);
expect("superadmin sees every account in the workspace", await names(U.superadmin, brandQ), ["@profesor.tokoonline", "@son.pawangac"]);
expect("advertiser sees ONLY the assigned brand", await names(U.adv, brandQ), ["@son.pawangac"]);
expect("client sees ONLY the assigned brand", await names(U.client, brandQ), ["@son.pawangac"]);
expect("relinepanasonic as a client sees ONLY Panasonic", await names(U.pan_client, brandQ), ["@son.pawangac"]);
expect("accounting sees nothing", await names(U.acct, brandQ), []);
expect("user of ANOTHER workspace sees nothing", await names(U.otherws, brandQ), []);

const snapQ = `select reach from public.ads_instagram_snapshots order by 1`;
expect("client reads only its brand's Instagram numbers", await names(U.client, snapQ), [100]);
expect("advertiser reads only its brand's Instagram numbers", await names(U.adv, snapQ), [100]);
expect("accounting reads no Instagram numbers", await names(U.acct, snapQ), []);

const postQ = `select caption from public.ads_scheduled_posts order by 1`;
expect("client can NOT see the scheduler", await names(U.client, postQ), []);
expect("advertiser sees scheduled posts of assigned brand only", await names(U.adv, postQ), ["pan post"]);
expect("superadmin sees all scheduled posts", await names(U.superadmin, postQ), ["pan post", "pto post"]);

expect("client reads Google Ads of its brand (dashes in the id are ignored)", await names(U.client, `select cost from public.ads_google_campaign_daily`), ["5"]);
expect("accounting reads no Google Ads", await names(U.acct, `select cost from public.ads_google_campaign_daily`), []);
expect("client can NOT read customer lists", await names(U.client, `select label from public.ads_audience_batches`), []);
expect("advertiser can read customer lists (staff)", await names(U.adv, `select label from public.ads_audience_batches`), ["list"]);
expect("unassigned site hidden from advertiser", await names(U.adv, `select domain from public.ads_sites order by 1`), ["nanocare.id"]);
expect("unassigned site visible to superadmin", await names(U.superadmin, `select domain from public.ads_sites order by 1`), ["nanocare.id", "unassigned.id"]);

// ---- 4. writes ----------------------------------------------------------------------------
const wr = async (uid, q) => { const r = await as(uid, q); return typeof r === "string" ? (r.includes("row-level security") ? "DENIED" : r) : "ALLOWED"; };
expect("client can NOT create a scheduled post", await wr(U.client, `insert into public.ads_scheduled_posts(workspace_id,client_id,caption,scheduled_at) values ('${PTOL}','${PAN}','x',now()) returning 1`), "DENIED");
expect("advertiser CAN schedule for an assigned brand", await wr(U.adv, `insert into public.ads_scheduled_posts(workspace_id,client_id,caption,scheduled_at) values ('${PTOL}','${PAN}','ok',now()) returning 1`), "ALLOWED");
expect("advertiser can NOT schedule for a brand it is not assigned to", await wr(U.adv, `insert into public.ads_scheduled_posts(workspace_id,client_id,caption,scheduled_at) values ('${PTOL}','${PTO}','no',now()) returning 1`), "DENIED");
expect("accounting can NOT schedule", await wr(U.acct, `insert into public.ads_scheduled_posts(workspace_id,client_id,caption,scheduled_at) values ('${PTOL}','${PAN}','no',now()) returning 1`), "DENIED");
expect("nobody in a browser can write Instagram numbers", await wr(U.superadmin, `insert into public.ads_instagram_snapshots(ig_user_id,snapshot_date) values ('IG_PAN','2026-09-02') returning 1`), "DENIED");
expect("nobody in a browser can change the home workspace", await wr(U.superadmin, `insert into public.ads_settings(key,value) values ('x','y') returning 1`), "DENIED");

// ---- 5. the widened role list --------------------------------------------------------------
const r5 = await db.query(`insert into public.workspace_members(workspace_id,user_id,role) values ('${PTOL}','${U.founder}','founder') returning role`).catch((e) => e.message);
expect("workspace_members accepts founder / client / advertiser roles", Array.isArray(r5?.rows) ? "ok" : r5, "ok");
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed ? 1 : 0);
