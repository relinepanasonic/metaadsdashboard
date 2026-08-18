import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { token, username, email, password } = await req.json();
  if (!token || !username || !email || !password) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const { data: invite, error: inviteErr } = await db
    .from("invites")
    .select("*")
    .eq("token", token)
    .single();

  if (inviteErr || !invite) return NextResponse.json({ ok: false, error: "Invite not found." }, { status: 404 });
  if (invite.status !== "pending") return NextResponse.json({ ok: false, error: `This invite has been ${invite.status}.` }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ ok: false, error: "This invite link has expired." }, { status: 410 });

  const { data: signUpData, error: signUpError } = await db.auth.signUp({ email, password });
  if (signUpError || !signUpData.user) {
    return NextResponse.json({ ok: false, error: signUpError?.message ?? "Sign up failed" }, { status: 400 });
  }

  const userId = signUpData.user.id;

  const { error: insertError } = await db.from("app_users").insert({
    id: userId,
    username,
    email,
    role: invite.role,
    client_name: invite.role === "client" ? invite.client_name : null,
  });
  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  if (invite.role === "advertiser" && invite.ad_account_ids?.length) {
    await db.from("advertiser_accounts").insert(
      invite.ad_account_ids.map((id: string) => ({ user_id: userId, ad_account_id: id }))
    );
  }

  await db
    .from("invites")
    .update({ status: "completed", completed_user_id: userId })
    .eq("token", token);

  return NextResponse.json({ ok: true, requiresEmailConfirm: !signUpData.session });
}
