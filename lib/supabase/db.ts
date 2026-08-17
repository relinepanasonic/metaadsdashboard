// Plain Supabase client (anon key) for reading/writing app data without auth
// cookies. Safe to use on the server for this internal tool.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_READY = Boolean(url && anon);

export const db = SUPABASE_READY ? createClient(url!, anon!) : null;
