import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { draftPost } from "@/lib/services/contentWriter";
import { isValidModelId, DEFAULT_MODEL } from "@/lib/seo/constants";

export const maxDuration = 300;

// Drafts a post for one saved keyword and stores it against that keyword.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { id, model } = (await req.json()) as { id?: string; model?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });
  const modelId = model && isValidModelId(model) ? model : DEFAULT_MODEL;

  const { data: row, error: readErr } = await db
    .from("saved_keywords")
    .select("id,keyword,status")
    .eq("id", id)
    .single();
  if (readErr || !row) return NextResponse.json({ ok: false, error: "Keyword not found" }, { status: 404 });
  if (row.status === "published") {
    return NextResponse.json({ ok: false, error: "Kata kunci ini sudah dipublikasikan." }, { status: 409 });
  }

  try {
    const draft = await draftPost(row.keyword, modelId);

    const { error: writeErr } = await db
      .from("saved_keywords")
      .update({
        status: "drafted",
        draft_title: draft.title,
        draft_slug: draft.slug,
        draft_meta: draft.metaDescription,
        draft_excerpt: draft.excerpt,
        draft_html: draft.bodyHtml,
        draft_tag: draft.tag,
      })
      .eq("id", id);
    if (writeErr) return NextResponse.json({ ok: false, error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
